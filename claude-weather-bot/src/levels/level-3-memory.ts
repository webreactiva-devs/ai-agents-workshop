import fs from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';
import { checkOutputCoherence } from '../common/guardrails/output-coherence.js';

const MEMORY_DIR = path.join(process.cwd(), 'memory');

function loadMemory(userId: string): string {
  const filePath = path.join(MEMORY_DIR, `${userId}.md`);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return '';
}

function saveMemory(userId: string, content: string): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
  }
  const filePath = path.join(MEMORY_DIR, `${userId}.md`);
  fs.writeFileSync(filePath, content, 'utf-8');
}

export async function runLevel3(prompt: string, userId: string = 'default') {
  const logger = createLogger({ agentLevel: 3 });
  const server = createWeatherMcpServer(logger);

  const inputCheck = checkInputTopic(prompt);
  if (!inputCheck.allowed) {
    console.log(inputCheck.message);
    return;
  }

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

  logger.info('level3:start', { prompt, userId, hasMemory: existingMemory.length > 0 });

  let result = '';
  const conversationContext = prompt;

  for await (const msg of query({
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
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      result = msg.result;
    }
  }

  const coherenceCheck = checkOutputCoherence(result, conversationContext);
  if (!coherenceCheck.coherent) {
    logger.warn('level3:output-guardrail', { message: coherenceCheck.message });
  }

  // Save memory for future sessions
  const memoryContent = existingMemory
    ? `${existingMemory}\n\n## Session ${new Date().toISOString()}\nQuery: ${prompt}\n`
    : `# User Preferences\n\n## Session ${new Date().toISOString()}\nQuery: ${prompt}\n`;
  saveMemory(userId, memoryContent);
  logger.info('level3:memory-saved', { userId });

  console.log('\n' + result);
  logger.info('level3:result', { result });
}
