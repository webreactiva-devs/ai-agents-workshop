import { query } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';
import { checkOutputCoherence } from '../common/guardrails/output-coherence.js';
import { llmJudgeCoherence } from '../common/guardrails/llm-judge.js';

export async function runLevel2(prompt: string) {
  const logger = createLogger({ agentLevel: 2 });
  const server = createWeatherMcpServer(logger);

  // Input guardrail
  const inputCheck = checkInputTopic(prompt);
  if (!inputCheck.allowed) {
    console.log(inputCheck.message);
    logger.warn('level2:input-guardrail-blocked', { prompt, message: inputCheck.message });
    return;
  }

  const systemPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  });

  logger.info('level2:start', { prompt });

  let result = '';
  const conversationContext = prompt;

  for await (const msg of query({
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
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
    }
  }

  // Output guardrail
  const coherenceCheck = checkOutputCoherence(result, conversationContext);
  if (!coherenceCheck.coherent) {
    logger.warn('level2:output-guardrail', { message: coherenceCheck.message });
    console.log(`[OUTPUT GUARDRAIL WARNING] ${coherenceCheck.message}`);
  }

  // Optional LLM judge
  if (process.env.ENABLE_LLM_JUDGE === 'true') {
    logger.info('level2:llm-judge:start');
    const judgeResult = await llmJudgeCoherence(conversationContext, result);
    logger.info('level2:llm-judge:result', { ...judgeResult });
    console.log(`[LLM JUDGE] pass=${judgeResult.pass} score=${judgeResult.score} — ${judgeResult.reasoning}`);
  }

  console.log('\n' + result);
  logger.info('level2:result', { result });
}
