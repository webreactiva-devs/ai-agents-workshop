import { decode } from '@msgpack/msgpack';
import { execFileSync } from 'node:child_process';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type RawProjectRecord = {
  id: string;
  packageName: string;
  directory: string;
  dbPath?: string;
};

type SpanRow = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  startedAt: string;
  endedAt: string | null;
  threadId: string | null;
  runId: string | null;
  resourceId: string | null;
  input_hex?: string | null;
  output_hex?: string | null;
  attributes_hex?: string | null;
  metadata_hex?: string | null;
  error_hex?: string | null;
};

type TraceSummaryRow = {
  traceId: string;
  rootName: string | null;
  startedAt: string;
  endedAt: string | null;
  spanCount: number;
  toolCalls: number;
  threadId: string | null;
  runId: string | null;
  userInputHex: string | null;
  finalOutputHex: string | null;
};

type WorkflowSnapshotRow = {
  workflow_name: string;
  run_id: string;
  snapshot: string;
  createdAt: string;
  updatedAt: string | null;
  resourceId: string | null;
};

type DecodedValue = unknown;

type ProjectSummary = {
  id: string;
  packageName: string;
  directory: string;
  dbPath: string | null;
  hasDatabase: boolean;
  traceCount: number;
  workflowCount: number;
  latestActivityAt: string | null;
};

type TraceSummary = {
  traceId: string;
  rootName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  spanCount: number;
  toolCalls: number;
  threadId: string | null;
  runId: string | null;
  userInputPreview: string | null;
  finalOutputPreview: string | null;
  routePreview: string[];
  tokenUsage: TokenUsage | null;
};

type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
};

type SpanNode = {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  spanType: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  threadId: string | null;
  runId: string | null;
  resourceId: string | null;
  input: DecodedValue | null;
  output: DecodedValue | null;
  attributes: DecodedValue | null;
  metadata: DecodedValue | null;
  error: DecodedValue | null;
  inputPreview: string | null;
  outputPreview: string | null;
  tokenUsage: TokenUsage | null;
  children: SpanNode[];
};

type TraceDetail = {
  traceId: string;
  projectId: string;
  rootName: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  spanCount: number;
  toolCalls: number;
  rootIds: string[];
  userInputPreview: string | null;
  finalOutputPreview: string | null;
  routePreview: string[];
  tokenUsage: TokenUsage | null;
  spans: SpanNode[];
  workflows: WorkflowSnapshotSummary[];
};

type WorkflowSnapshotSummary = {
  workflowName: string;
  runId: string;
  createdAt: string;
  updatedAt: string | null;
  resourceId: string | null;
  preview: string | null;
  snapshot: unknown;
};

const SERVER_DIR = resolve(fileURLToPath(new URL('.', import.meta.url)));
const ROOT_DIR = resolve(SERVER_DIR, '../../..');
const APPS_DIR = join(ROOT_DIR, 'apps');
const PUBLIC_DIR = join(ROOT_DIR, 'apps', 'mastra-scouter', 'public');
const PORT = Number(process.env.SCOUTER_PORT ?? 4311);
const TRACE_LIMIT = Number(process.env.SCOUTER_TRACE_LIMIT ?? 10);
const STATIC_CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function listProjects(): RawProjectRecord[] {
  return readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = join(APPS_DIR, entry.name);
      const packagePath = join(directory, 'package.json');
      try {
        const pkg = readJsonFile<{ name: string }>(packagePath);
        const publicDir = join(directory, 'src', 'mastra', 'public');
        const dbFiles = statSafe(publicDir)
          ? readdirSync(publicDir)
              .filter((file) => file.endsWith('.db'))
              .sort()
          : [];

        return {
          id: entry.name,
          packageName: pkg.name,
          directory,
          dbPath: dbFiles[0] ? join(publicDir, dbFiles[0]) : undefined,
        };
      } catch {
        return {
          id: entry.name,
          packageName: entry.name,
          directory,
        };
      }
    })
    .filter((project) => project.id !== 'mastra-scouter')
    .sort((left, right) => left.id.localeCompare(right.id));
}

function statSafe(filePath: string) {
  try {
    return statSync(filePath);
  } catch {
    return null;
  }
}

function runSql<T>(dbPath: string, sql: string): T[] {
  const result = execFileSync('sqlite3', ['-readonly', '-json', dbPath, sql], {
    encoding: 'utf8',
  }).trim();

  if (!result) {
    return [];
  }

  return JSON.parse(result) as T[];
}

function decodeHexBlob(value: string | null | undefined): DecodedValue | null {
  if (!value) {
    return null;
  }

  const buffer = Buffer.from(value, 'hex');

  try {
    return decode(buffer);
  } catch {
    const preview = extractReadableText(buffer);
    return preview || null;
  }
}

function extractReadableText(buffer: Buffer): string | null {
  const decoded = buffer
    .toString('utf8')
    .replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!decoded) {
    return null;
  }

  const segments = decoded.match(/[\p{L}\p{N}][\p{L}\p{N}\p{P}\p{Zs}]{3,}/gu) ?? [];
  const joined = segments.join(' ').trim();

  if (!joined) {
    return compactWhitespace(decoded, 220);
  }

  return compactWhitespace(joined, 220);
}

function normalizePreviewText(value: string | null, kind: 'input' | 'output' | 'generic' = 'generic'): string | null {
  if (!value) {
    return null;
  }

  let normalized = value.replace(/\\n/g, '\n');
  const focusTokens = kind === 'input' ? ['Gtext ', 'text ', 'wcontent ', 'content '] : ['Gtext ', 'text ', 'wpayload ', 'payload '];

  for (const token of focusTokens) {
    const index = normalized.lastIndexOf(token);
    if (index >= 0) {
      normalized = normalized.slice(index + token.length);
      break;
    }
  }

  normalized = normalized
    .replace(/\b(?:Grole|role|wcontent|content|Gtype|type|Gtext|text|messages|wpayload|payload)\b/g, ' ')
    .replace(/^[A-Za-z0-9]{1,2}(?=[A-ZÁÉÍÓÚÜ¿¡])/u, '')
    .replace(/^[A-Za-z0-9]{1,2}\s+/u, '')
    .replace(/[A-Z](?=(role|content|type|text|messages|payload|usage|inputTokens|outputTokens|reasoning))/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return null;
  }

  return compactWhitespace(normalized, 220);
}

function parseTokenUsage(source: unknown): TokenUsage | null {
  const text = typeof source === 'string' ? source : stringifyPreview(source);
  if (!text) {
    return null;
  }

  const inputTokens = matchNumber(text, /inputTokens\D*(\d+)/);
  const outputTokens = matchNumber(text, /outputTokens\D*(\d+)/);
  const reasoningTokens = matchNumber(text, /reasoning\D*(\d+)/);

  if (inputTokens == null && outputTokens == null && reasoningTokens == null) {
    return null;
  }

  const totalTokens = [inputTokens, outputTokens]
    .filter((value): value is number => value != null)
    .reduce((sum, value) => sum + value, 0);

  return {
    inputTokens,
    outputTokens,
    reasoningTokens,
    totalTokens: totalTokens || null,
  };
}

function matchNumber(value: string, regex: RegExp): number | null {
  const match = value.match(regex);
  return match ? Number(match[1]) : null;
}

function mergeTokenUsage(usages: Array<TokenUsage | null>): TokenUsage | null {
  const aggregate = usages.reduce<TokenUsage>(
    (sum, usage) => ({
      inputTokens: (sum.inputTokens ?? 0) + (usage?.inputTokens ?? 0),
      outputTokens: (sum.outputTokens ?? 0) + (usage?.outputTokens ?? 0),
      reasoningTokens: (sum.reasoningTokens ?? 0) + (usage?.reasoningTokens ?? 0),
      totalTokens: (sum.totalTokens ?? 0) + (usage?.totalTokens ?? 0),
    }),
    { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 },
  );

  if (!aggregate.inputTokens && !aggregate.outputTokens && !aggregate.reasoningTokens && !aggregate.totalTokens) {
    return null;
  }

  return aggregate;
}

function stringifyPreview(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return compactWhitespace(value, 220);
  }

  try {
    return compactWhitespace(JSON.stringify(value), 220);
  } catch {
    return compactWhitespace(String(value), 220);
  }
}

function compactWhitespace(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength - 1)}…`;
}

function toDurationMs(startedAt: string, endedAt: string | null): number | null {
  if (!endedAt) {
    return null;
  }

  const duration = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(duration) ? Math.max(duration, 0) : null;
}

function getTraceRows(dbPath: string): TraceSummaryRow[] {
  return runSql<TraceSummaryRow>(
    dbPath,
    `
      SELECT
        traceId,
        COALESCE(MAX(CASE WHEN parentSpanId IS NULL THEN name END), MAX(name)) AS rootName,
        MIN(startedAt) AS startedAt,
        MAX(endedAt) AS endedAt,
        COUNT(*) AS spanCount,
        SUM(CASE WHEN spanType = 'tool_call' THEN 1 ELSE 0 END) AS toolCalls,
        MAX(threadId) AS threadId,
        MAX(runId) AS runId,
        MAX(CASE WHEN spanType = 'agent_run' THEN hex(input) END) AS userInputHex,
        MAX(CASE WHEN spanType = 'agent_run' THEN hex(output) END) AS finalOutputHex
      FROM mastra_ai_spans
      GROUP BY traceId
      ORDER BY MIN(startedAt) DESC
      LIMIT ${TRACE_LIMIT}
    `,
  );
}

function getSpansForTrace(dbPath: string, traceId: string): SpanRow[] {
  return runSql<SpanRow>(
    dbPath,
    `
      SELECT
        traceId,
        spanId,
        parentSpanId,
        name,
        spanType,
        startedAt,
        endedAt,
        threadId,
        runId,
        resourceId,
        hex(input) AS input_hex,
        hex(output) AS output_hex,
        hex(attributes) AS attributes_hex,
        hex(metadata) AS metadata_hex,
        hex(error) AS error_hex
      FROM mastra_ai_spans
      WHERE traceId = '${escapeSqlLiteral(traceId)}'
      ORDER BY startedAt ASC
    `,
  );
}

function getWorkflowSnapshots(dbPath: string): WorkflowSnapshotSummary[] {
  const rows = runSql<WorkflowSnapshotRow>(
    dbPath,
    `
      SELECT workflow_name, run_id, snapshot, createdAt, updatedAt, resourceId
      FROM mastra_workflow_snapshot
      ORDER BY createdAt DESC
      LIMIT 20
    `,
  );

  return rows.map((row) => {
    const snapshot = parseJsonSafe(row.snapshot);
    return {
      workflowName: row.workflow_name,
      runId: row.run_id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resourceId: row.resourceId,
      preview: stringifyPreview(snapshot ?? row.snapshot),
      snapshot,
    };
  });
}

type WorkingMemoryRow = {
  id: string;
  workingMemory: string | null;
  createdAt: string;
  updatedAt: string;
};

type WorkingMemoryEntry = {
  resourceId: string;
  workingMemory: string | null;
  createdAt: string;
  updatedAt: string;
};

function getWorkingMemory(dbPath: string): WorkingMemoryEntry[] {
  try {
    const rows = runSql<WorkingMemoryRow>(
      dbPath,
      `SELECT id, workingMemory, createdAt, updatedAt FROM mastra_resources ORDER BY updatedAt DESC`,
    );
    return rows.map((row) => ({
      resourceId: row.id,
      workingMemory: row.workingMemory,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}

function parseJsonSafe(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function escapeSqlLiteral(value: string) {
  return value.replaceAll("'", "''");
}

function buildRoutePreview(spans: SpanRow[]): string[] {
  return spans
    .filter((span) => span.spanType !== 'model_chunk')
    .slice(0, 12)
    .map((span) => `${span.spanType}:${span.name}`);
}

function buildSpanTree(spans: SpanRow[]): { roots: SpanNode[]; rootIds: string[] } {
  const nodes = new Map<string, SpanNode>();

  for (const span of spans) {
    const input = decodeHexBlob(span.input_hex);
    const output = decodeHexBlob(span.output_hex);
    const attributes = decodeHexBlob(span.attributes_hex);
    const metadata = decodeHexBlob(span.metadata_hex);
    const error = decodeHexBlob(span.error_hex);
    const tokenUsage = parseTokenUsage(attributes);

    nodes.set(span.spanId, {
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      spanType: span.spanType,
      startedAt: span.startedAt,
      endedAt: span.endedAt,
      durationMs: toDurationMs(span.startedAt, span.endedAt),
      threadId: span.threadId,
      runId: span.runId,
      resourceId: span.resourceId,
      input,
      output,
      attributes,
      metadata,
      error,
      inputPreview: normalizePreviewText(stringifyPreview(input), 'input'),
      outputPreview: normalizePreviewText(stringifyPreview(output), 'output'),
      tokenUsage,
      children: [],
    });
  }

  const roots: SpanNode[] = [];

  for (const node of nodes.values()) {
    if (node.parentSpanId && nodes.has(node.parentSpanId)) {
      nodes.get(node.parentSpanId)?.children.push(node);
      continue;
    }

    roots.push(node);
  }

  for (const node of nodes.values()) {
    node.children.sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  roots.sort((left, right) => left.startedAt.localeCompare(right.startedAt));

  return {
    roots,
    rootIds: roots.map((root) => root.spanId),
  };
}

function getProjectSummaries(): ProjectSummary[] {
  return listProjects().map((project) => {
    if (!project.dbPath) {
      return {
        id: project.id,
        packageName: project.packageName,
        directory: project.directory,
        dbPath: null,
        hasDatabase: false,
        traceCount: 0,
        workflowCount: 0,
        latestActivityAt: null,
      };
    }

    try {
      const traces = getTraceRows(project.dbPath);
      const workflows = getWorkflowSnapshots(project.dbPath);
      const latestTrace = traces[0];

      return {
        id: project.id,
        packageName: project.packageName,
        directory: project.directory,
        dbPath: project.dbPath,
        hasDatabase: true,
        traceCount: traces.length,
        workflowCount: workflows.length,
        latestActivityAt: latestTrace?.startedAt ?? workflows[0]?.createdAt ?? null,
      };
    } catch {
      return {
        id: project.id,
        packageName: project.packageName,
        directory: project.directory,
        dbPath: project.dbPath,
        hasDatabase: true,
        traceCount: 0,
        workflowCount: 0,
        latestActivityAt: null,
      };
    }
  });
}

function getTraceSummaries(projectId: string): TraceSummary[] {
  const project = listProjects().find((item) => item.id === projectId);
  if (!project?.dbPath) {
    throw new Error(`No database found for project "${projectId}"`);
  }

  return getTraceRows(project.dbPath).map((row) => ({
    routePreview: [],
    traceId: row.traceId,
    rootName: row.rootName ?? 'trace',
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMs: toDurationMs(row.startedAt, row.endedAt),
    spanCount: Number(row.spanCount),
    toolCalls: Number(row.toolCalls),
    threadId: row.threadId,
    runId: row.runId,
    userInputPreview: normalizePreviewText(stringifyPreview(decodeHexBlob(row.userInputHex)), 'input'),
    finalOutputPreview: normalizePreviewText(stringifyPreview(decodeHexBlob(row.finalOutputHex)), 'output'),
    tokenUsage: null,
  }));
}

function getTraceDetail(projectId: string, traceId: string): TraceDetail {
  const project = listProjects().find((item) => item.id === projectId);
  if (!project?.dbPath) {
    throw new Error(`No database found for project "${projectId}"`);
  }

  const spans = getSpansForTrace(project.dbPath, traceId);
  if (spans.length === 0) {
    throw new Error(`Trace "${traceId}" not found for project "${projectId}"`);
  }

  const tree = buildSpanTree(spans);
  const root = spans[0];
  const agentRun = spans.find((span) => span.spanType === 'agent_run');
  const tokenUsage = mergeTokenUsage(
    Array.from((function flatten(nodes: SpanNode[]): SpanNode[] {
      return nodes.flatMap((node) => [node, ...flatten(node.children)]);
    })(tree.roots)).map((node) => node.tokenUsage),
  );
  const workflows = getWorkflowSnapshots(project.dbPath).filter((workflow) => workflow.runId === root.runId);

  return {
    traceId,
    projectId,
    rootName: spans.find((span) => !span.parentSpanId)?.name ?? root.name,
    startedAt: root.startedAt,
    endedAt: spans.at(-1)?.endedAt ?? null,
    durationMs: toDurationMs(root.startedAt, spans.at(-1)?.endedAt ?? null),
    spanCount: spans.length,
    toolCalls: spans.filter((span) => span.spanType === 'tool_call').length,
    rootIds: tree.rootIds,
    userInputPreview: normalizePreviewText(stringifyPreview(decodeHexBlob(agentRun?.input_hex)), 'input'),
    finalOutputPreview: normalizePreviewText(stringifyPreview(decodeHexBlob(agentRun?.output_hex)), 'output'),
    routePreview: buildRoutePreview(spans),
    tokenUsage,
    spans: tree.roots,
    workflows,
  };
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload, null, 2));
}

function sendNotFound(response: ServerResponse) {
  sendJson(response, 404, { error: 'Not found' });
}

function serveStatic(requestPath: string, response: ServerResponse) {
  const normalized = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR) || !statSafe(filePath)?.isFile()) {
    sendNotFound(response);
    return;
  }

  response.writeHead(200, {
    'Content-Type': STATIC_CONTENT_TYPES[extname(filePath)] ?? 'application/octet-stream',
  });
  response.end(readFileSync(filePath));
}

function handleApiRequest(request: IncomingMessage, response: ServerResponse) {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  const segments = requestUrl.pathname.split('/').filter(Boolean);

  try {
    if (requestUrl.pathname === '/api/projects') {
      sendJson(response, 200, { projects: getProjectSummaries() });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'projects' && segments[2] && segments.length === 4 && segments[3] === 'memory') {
      const project = listProjects().find((item) => item.id === segments[2]);
      if (!project?.dbPath) {
        sendJson(response, 200, { memory: [] });
        return;
      }
      sendJson(response, 200, { memory: getWorkingMemory(project.dbPath) });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'projects' && segments[2] && segments.length === 4 && segments[3] === 'traces') {
      const traces = getTraceSummaries(segments[2]);
      sendJson(response, 200, { traces });
      return;
    }

    if (segments[0] === 'api' && segments[1] === 'projects' && segments[2] && segments[3] === 'traces' && segments[4]) {
      sendJson(response, 200, { trace: getTraceDetail(segments[2], segments[4]) });
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    sendJson(response, 500, { error: message });
    return;
  }

  sendNotFound(response);
}

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
  if (requestUrl.pathname.startsWith('/api/')) {
    handleApiRequest(request, response);
    return;
  }

  serveStatic(requestUrl.pathname, response);
});

server.listen(PORT, () => {
  console.log(`Mastra Scouter listening on http://localhost:${PORT}`);
});
