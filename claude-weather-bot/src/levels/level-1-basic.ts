import { query } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';

export async function runLevel1(prompt: string) {
  const logger = createLogger({ agentLevel: 1 });
  const server = createWeatherMcpServer(logger);

  const systemPrompt = buildWeatherInstructions({
    includePolicy: false,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  });

  logger.info('level1:start', { prompt });

  for await (const msg of query({
    prompt,
    options: {
      systemPrompt,
      model: 'haiku',
      mcpServers: { weather: server },
      allowedTools: ['mcp__weather__getWeatherByCity'],
      permissionMode: 'bypassPermissions',
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log('\n' + msg.result);
      logger.info('level1:result', { result: msg.result });
    }
  }
}
