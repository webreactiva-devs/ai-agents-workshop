import fs from 'node:fs';
import path from 'node:path';

export function createToolTrace(logDir?: string) {
  const dir = logDir ?? process.cwd();
  const filePath = path.join(dir, 'mcp-tool-trace.jsonl');

  return function trace(
    toolId: string,
    phase: 'call' | 'result' | 'error',
    data: Record<string, unknown>,
  ): void {
    const entry = {
      timestamp: new Date().toISOString(),
      toolId,
      phase,
      ...data,
    };
    const line = JSON.stringify(entry);
    console.log(`[mcp-trace] ${line}`);
    fs.appendFileSync(filePath, line + '\n');
  };
}

export const toolTrace = createToolTrace();
