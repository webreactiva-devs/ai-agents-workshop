import fs from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { createWeatherMcpServer } from '../common/mcp-server.js';
import { createLogger } from '../common/logger.js';
import { buildWeatherInstructions } from '../common/instructions.js';
import { checkInputTopic } from '../common/guardrails/input-topic.js';

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

export async function runLevel4(prompt: string, userId: string = 'default') {
  const logger = createLogger({ agentLevel: 4 });
  const server = createWeatherMcpServer(logger);

  const inputCheck = checkInputTopic(prompt);
  if (!inputCheck.allowed) {
    console.log(inputCheck.message);
    return;
  }

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

  logger.info('level4:start', { prompt, userId, hasSkill: skillContent.length > 0 });

  for await (const msg of query({
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
    },
  })) {
    if (msg.type === 'result' && msg.subtype === 'success') {
      console.log('\n' + msg.result);
      logger.info('level4:result', { result: msg.result });
    }
  }
}
