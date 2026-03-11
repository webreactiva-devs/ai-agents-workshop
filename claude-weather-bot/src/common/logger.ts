import fs from 'node:fs';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export function createLogger(options?: { level?: string; filePath?: string; agentLevel?: number }): Logger {
  const minLevel = (options?.level ?? process.env.LOG_LEVEL ?? 'info') as LogLevel;
  const logFile = options?.filePath ?? path.join(process.cwd(), 'logs', 'agent.jsonl');
  const agentLevel = options?.agentLevel;

  const dir = path.dirname(logFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (LOG_ORDER[level] < LOG_ORDER[minLevel]) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      ...(agentLevel != null && { agentLevel }),
      message,
      ...data,
    };
    const line = JSON.stringify(entry);

    fs.appendFileSync(logFile, line + '\n');
    const prefix = agentLevel != null ? `[${level.toUpperCase()}][L${agentLevel}]` : `[${level.toUpperCase()}]`;
    process.stderr.write(`${prefix} ${message}\n`);
  }

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
  };
}
