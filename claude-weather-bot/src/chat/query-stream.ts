/**
 * Chat Query Stream
 * Wraps claude-agent-sdk query() as an async generator of SSE events
 * Each level mirrors its original implementation exactly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';

export interface SSEEvent {
  type: 'text' | 'tool_use' | 'result' | 'error' | 'heartbeat';
  data: string;
}

export interface ChatQueryOptions {
  message: string;
  level: string;
  abortController?: AbortController;
}

/**
 * Descripciones de cada nivel para el selector
 */
export const CHAT_LEVELS: Record<string, string> = {
  level1: 'Agente básico + 1 tool',
  level2: 'Política + guardrails',
  level3: 'Memoria via filesystem',
  level4: 'Skill (dress-advisor)',
  level5: 'MCP server externo + trazas',
  level6: 'Multi-agente orquestador',
};

// Paths for memory and skill
const MEMORY_DIR = path.join(process.cwd(), 'memory');
const SKILL_PATH = path.join(process.cwd(), 'skills', 'dress-advisor.md');

function loadMemory(userId: string): string {
  const filePath = path.join(MEMORY_DIR, `${userId}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

function loadSkill(): string {
  if (fs.existsSync(SKILL_PATH)) {
    return fs.readFileSync(SKILL_PATH, 'utf-8');
  }
  return '';
}

/**
 * Streams query() results as SSE events.
 * Each level replicates its CLI counterpart faithfully.
 */
export async function* chatQueryStream(
  options: ChatQueryOptions
): AsyncGenerator<SSEEvent> {
  const { message, level, abortController } = options;

  // Verify authentication
  const hasApiKey = !!process.env['ANTHROPIC_API_KEY'];
  const hasOAuthToken = !!process.env['CLAUDE_CODE_OAUTH_TOKEN'];

  if (!hasApiKey && !hasOAuthToken) {
    yield { type: 'error', data: 'No hay autenticación configurada. Define ANTHROPIC_API_KEY o CLAUDE_CODE_OAUTH_TOKEN.' };
    return;
  }

  // Input guardrail for levels 2+
  if (['level2', 'level3', 'level4', 'level5', 'level6'].includes(level)) {
    const inputCheck = checkInputTopic(message);
    if (!inputCheck.allowed) {
      yield { type: 'error', data: inputCheck.message || 'Entrada no permitida por el guardrail.' };
      return;
    }
  }

  const levelNum = parseInt(level.replace('level', ''), 10);
  const logger = createLogger({ agentLevel: levelNum });

  try {
    if (level === 'level1') {
      yield* runLevel1Stream(message, logger, abortController);
    } else if (level === 'level2') {
      yield* runLevel2Stream(message, logger, abortController);
    } else if (level === 'level3') {
      yield* runLevel3Stream(message, logger, abortController);
    } else if (level === 'level4') {
      yield* runLevel4Stream(message, logger, abortController);
    } else if (level === 'level5') {
      yield* runLevel5Stream(message, logger, abortController);
    } else if (level === 'level6') {
      yield* runLevel6Stream(message, logger, abortController);
    } else {
      yield { type: 'error', data: `Nivel desconocido: ${level}` };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    yield { type: 'error', data: errorMsg };
  }
}

// ============================================================================
// Helper: iterate query() and yield SSE events
// ============================================================================

async function* iterateQuery(
  queryIter: AsyncIterable<any>,
): AsyncGenerator<SSEEvent> {
  for await (const msg of queryIter) {
    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if ('text' in block) {
          yield { type: 'text', data: block.text };
        } else if ('name' in block) {
          yield { type: 'tool_use', data: block.name };
        }
      }
    } else if (msg.type === 'result') {
      const resultData = {
        subtype: msg.subtype,
        duration_ms: msg.duration_ms,
        total_cost_usd: msg.total_cost_usd,
        usage: msg.usage,
        ...(msg.subtype === 'success' && { result: msg.result }),
      };
      yield { type: 'result', data: JSON.stringify(resultData) };
    }
  }
}

// ============================================================================
// Level 1: Basic agent + 1 tool
// ============================================================================

async function* runLevel1Stream(
  prompt: string,
  logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const server = createWeatherMcpServer(logger);

  const systemPrompt = buildWeatherInstructions({
    includePolicy: false,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  });

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt,
      model: 'haiku',
      mcpServers: { weather: server },
      allowedTools: ['mcp__weather__getWeatherByCity'],
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}

// ============================================================================
// Level 2: Policy + guardrails
// ============================================================================

async function* runLevel2Stream(
  prompt: string,
  logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const server = createWeatherMcpServer(logger);

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  });

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt,
      model: 'haiku',
      mcpServers: { weather: server },
      allowedTools: [
        'mcp__weather__getWeatherByCity',
        'mcp__weather__deriveSignals',
        'mcp__weather__recommendClothing',
      ],
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}

// ============================================================================
// Level 3: Memory via filesystem
// ============================================================================

async function* runLevel3Stream(
  prompt: string,
  logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const server = createWeatherMcpServer(logger);
  const userId = 'default';
  const existingMemory = loadMemory(userId);

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  });

  const fullSystemPrompt = existingMemory
    ? `${systemPrompt}\n\n## User Memory\n${existingMemory}`
    : systemPrompt;

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt: fullSystemPrompt,
      model: 'haiku',
      mcpServers: { weather: server },
      allowedTools: [
        'mcp__weather__getWeatherByCity',
        'mcp__weather__deriveSignals',
        'mcp__weather__recommendClothing',
      ],
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}

// ============================================================================
// Level 4: Skill-based (dress-advisor)
// ============================================================================

async function* runLevel4Stream(
  prompt: string,
  logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const server = createWeatherMcpServer(logger);
  const userId = 'default';
  const existingMemory = loadMemory(userId);
  const skillContent = loadSkill();

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: true,
    mentionMcp: false,
    mentionTrace: false,
  });

  const parts = [systemPrompt];
  if (existingMemory) parts.push(`## User Memory\n${existingMemory}`);
  if (skillContent) parts.push(`## Dress Advisor Skill\n${skillContent}`);

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt: parts.join('\n\n'),
      model: 'haiku',
      mcpServers: { weather: server },
      allowedTools: [
        'mcp__weather__getWeatherByCity',
        'mcp__weather__deriveSignals',
        'mcp__weather__recommendClothing',
      ],
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}

// ============================================================================
// Level 5: External MCP server + traces
// ============================================================================

async function* runLevel5Stream(
  prompt: string,
  _logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const mcpServerUrl = process.env['MCP_SERVER_URL'] ?? 'http://127.0.0.1:8788/sse';

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: true,
    mentionTrace: true,
  });

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt,
      model: 'haiku',
      mcpServers: {
        'weather-external': {
          type: 'sse',
          url: mcpServerUrl,
        },
      },
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}

// ============================================================================
// Level 6: Multi-agent orchestrator
// ============================================================================

async function* runLevel6Stream(
  userMessage: string,
  logger: ReturnType<typeof createLogger>,
  abortController?: AbortController,
): AsyncGenerator<SSEEvent> {
  const server = createWeatherMcpServer(logger);

  const orchestratorPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: true,
  });

  const agents: Record<string, AgentDefinition> = {
    interpreter: {
      description: 'Weather data interpreter — fetches and analyzes weather data for a location.',
      prompt: buildWeatherInstructions({
        includePolicy: true,
        includeMemory: false,
        mentionSkill: false,
        mentionMcp: false,
        mentionTrace: false,
        isWeatherInterpreter: true,
      }),
      tools: ['mcp__weather__getWeatherByCity', 'mcp__weather__deriveSignals'],
      model: 'haiku',
    },
    recommender: {
      description: 'Clothing recommender — generates outfit advice from weather signals.',
      prompt: buildWeatherInstructions({
        includePolicy: true,
        includeMemory: false,
        mentionSkill: false,
        mentionMcp: false,
        mentionTrace: false,
        isRecommender: true,
      }),
      tools: ['mcp__weather__recommendClothing'],
      model: 'haiku',
    },
  };

  const prompt = `Process this request using two steps:
1. First, use the "interpreter" agent to get and analyze weather data
2. Then, use the "recommender" agent to generate clothing advice based on the weather analysis

User request: ${userMessage}`;

  yield* iterateQuery(query({
    prompt,
    options: {
      systemPrompt: orchestratorPrompt,
      model: 'sonnet',
      mcpServers: { weather: server },
      allowedTools: [
        'mcp__weather__getWeatherByCity',
        'mcp__weather__deriveSignals',
        'mcp__weather__recommendClothing',
      ],
      agents,
      permissionMode: 'bypassPermissions',
      abortController,
    },
  }));
}
