import { runLevel1 } from './levels/level-1-basic.js';
import { runLevel2 } from './levels/level-2-policy.js';
import { runLevel3 } from './levels/level-3-memory.js';
import { runLevel4 } from './levels/level-4-skill.js';
import { runLevel5 } from './levels/level-5-mcp-trace.js';
import { runLevel6 } from './levels/level-6-multi-agent.js';

const LEVELS: Record<string, (prompt: string) => Promise<void>> = {
  level1: runLevel1,
  level2: runLevel2,
  level3: runLevel3,
  level4: runLevel4,
  level5: runLevel5,
  level6: runLevel6,
};

async function main() {
  const [subcommand, ...rest] = process.argv.slice(2);

  if (!subcommand || subcommand === '--help') {
    console.log(`Usage: tsx src/cli.ts <level> "<prompt>"

Levels:
  level1  Basic agent + 1 tool (getWeatherByCity)
  level2  Policy + guardrails + optional LLM judge
  level3  Memory via filesystem
  level4  Skill-based (dress-advisor.md)
  level5  External MCP server + traces
  level6  Multi-agent orchestrator + evals`);
    process.exit(0);
  }

  const levelFn = LEVELS[subcommand];
  if (!levelFn) {
    console.error(`Unknown level: ${subcommand}. Use --help to see available levels.`);
    process.exit(1);
  }

  const prompt = rest.join(' ') || '¿Qué me pongo hoy en Madrid?';
  console.log(`\n--- Running ${subcommand} ---`);
  console.log(`Prompt: "${prompt}"\n`);

  await levelFn(prompt);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
