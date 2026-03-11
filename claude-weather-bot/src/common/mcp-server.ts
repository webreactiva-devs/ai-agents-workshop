import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherTools } from './tools.js';
import type { Logger } from './logger.js';

export function createWeatherMcpServer(logger?: Logger) {
  const tools = createWeatherTools(logger);

  return createSdkMcpServer({
    name: 'weather',
    tools: [tools.getWeatherByCity, tools.deriveSignals, tools.recommendClothing],
  });
}
