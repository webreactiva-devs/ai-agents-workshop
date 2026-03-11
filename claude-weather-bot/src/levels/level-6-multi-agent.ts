import { query } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';
import { checkOutputCoherence } from '../common/guardrails/output-coherence.js';
import { runAllEvals, saveEvalReport } from '../common/evals/index.js';

export async function runLevel6(prompt: string) {
  const logger = createLogger({ agentLevel: 6 });
  const server = createWeatherMcpServer(logger);

  const inputCheck = checkInputTopic(prompt);
  if (!inputCheck.allowed) {
    console.log(inputCheck.message);
    return;
  }

  const orchestratorPrompt = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: true,
  });

  const interpreterInstructions = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
    isWeatherInterpreter: true,
  });

  const recommenderInstructions = buildWeatherInstructions({
    includePolicy: true,
    includeMemory: false,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
    isRecommender: true,
  });

  logger.info('level6:start', { prompt });

  const fullPrompt = `Process this request using two steps:
1. First, use the "interpreter" agent to get and analyze weather data
2. Then, use the "recommender" agent to generate clothing advice based on the weather analysis

User request: ${prompt}`;

  let result = '';
  const conversationContext = prompt;

  logger.info('level6:agents', {
    orchestrator: { model: 'sonnet' },
    subagents: {
      interpreter: { model: 'haiku', tools: ['getWeatherByCity', 'deriveSignals'] },
      recommender: { model: 'haiku', tools: ['recommendClothing'] },
    },
  });

  for await (const msg of query({
    prompt: fullPrompt,
    options: {
      systemPrompt: orchestratorPrompt,
      model: 'sonnet',
      mcpServers: { weather: server },
      allowedTools: [
        'mcp__weather__getWeatherByCity',
        'mcp__weather__deriveSignals',
        'mcp__weather__recommendClothing',
      ],
      agents: {
        interpreter: {
          description: 'Weather data interpreter — fetches and analyzes weather data for a location.',
          prompt: interpreterInstructions,
          tools: ['mcp__weather__getWeatherByCity', 'mcp__weather__deriveSignals'],
          model: 'haiku',
        },
        recommender: {
          description: 'Clothing recommender — generates outfit advice from weather signals.',
          prompt: recommenderInstructions,
          tools: ['mcp__weather__recommendClothing'],
          model: 'haiku',
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
            const isSubagent = block.name.startsWith('agent:') || block.name === 'interpreter' || block.name === 'recommender';
            if (isSubagent) {
              logger.info('level6:subagent-call', { agent: block.name, toolUseId: block.id });
            } else {
              logger.info('level6:tool-call', { toolName: block.name, toolUseId: block.id });
            }
          }
        }
      }
    } else if (msg.type === 'user' && msg.tool_use_result != null) {
      const preview = JSON.stringify(msg.tool_use_result).slice(0, 200);
      logger.info('level6:tool-result', { preview });
    } else if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
      logger.info('level6:done', {
        numTurns: msg.num_turns,
        durationMs: msg.duration_ms,
        totalCostUsd: msg.total_cost_usd,
      });
    }
  }

  // Output guardrail
  const coherenceCheck = checkOutputCoherence(result, conversationContext);
  if (!coherenceCheck.coherent) {
    logger.warn('level6:output-guardrail', { message: coherenceCheck.message });
    console.log(`[OUTPUT GUARDRAIL WARNING] ${coherenceCheck.message}`);
  }

  // Response first
  console.log('\n' + result);
  logger.info('level6:result', { result });

  // Evals after response (LLM-based via OpenAI gpt-4.1-mini)
  logger.info('level6:evals:start');
  const report = await runAllEvals(result, conversationContext);

  console.log('\n--- Eval Results (gpt-5-mini) ---');
  for (const e of report.evals) {
    const bar = '█'.repeat(Math.round(e.score * 10)) + '░'.repeat(10 - Math.round(e.score * 10));
    console.log(`  ${e.name.padEnd(16)} ${bar} ${e.score.toFixed(2)}  ${e.reason}`);
  }
  console.log(`  ${'average'.padEnd(16)} ${''.padEnd(11)} ${report.avgScore.toFixed(2)}`);

  saveEvalReport(report, { agentLevel: 6, prompt });
  logger.info('level6:evals:done', { avgScore: report.avgScore });
}
