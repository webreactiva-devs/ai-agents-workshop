import { query } from '@anthropic-ai/claude-agent-sdk';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';

export async function runLevel5(prompt: string) {
  const logger = createLogger({ agentLevel: 5 });

  const inputCheck = checkInputTopic(prompt);
  if (!inputCheck.allowed) {
    console.log(inputCheck.message);
    logger.warn('level5:input-guardrail-blocked', { prompt, message: inputCheck.message });
    return;
  }

  const mcpServerUrl = process.env.MCP_SERVER_URL ?? 'http://127.0.0.1:8788/sse';

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: true,
    mentionTrace: true,
  });

  logger.info('level5:start', { prompt, mcpServerUrl });
  logger.info('level5:mcp-connecting', { url: mcpServerUrl });

  for await (const msg of query({
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
    },
  })) {
    if (msg.type === 'assistant') {
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'tool_use') {
            logger.info('level5:tool-call', {
              toolName: block.name,
              toolUseId: block.id,
              input: block.input as Record<string, unknown>,
            });
          } else if (block.type === 'text' && block.text) {
            logger.debug('level5:assistant-text', { text: block.text });
          }
        }
      }
    } else if (msg.type === 'user' && msg.tool_use_result != null) {
      const resultPreview = typeof msg.tool_use_result === 'string'
        ? msg.tool_use_result.slice(0, 200)
        : JSON.stringify(msg.tool_use_result).slice(0, 200);
      logger.info('level5:tool-result', { preview: resultPreview });
    } else if (msg.type === 'result' && msg.subtype === 'success') {
      logger.info('level5:done', {
        numTurns: msg.num_turns,
        durationMs: msg.duration_ms,
        durationApiMs: msg.duration_api_ms,
        totalCostUsd: msg.total_cost_usd,
        usage: msg.usage,
      });
      logger.info('level5:result', { result: msg.result });
      console.log('\n' + msg.result);
    }
  }
}
