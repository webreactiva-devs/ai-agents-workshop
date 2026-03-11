import fs from 'node:fs';
import path from 'node:path';
import { evalUtility } from './utility.js';
import { evalClarity } from './clarity.js';
import { evalPrudence } from './prudence.js';
import { evalPersonalization } from './personalization.js';
import { evalCoherence } from './coherence.js';

export { evalUtility, evalClarity, evalPrudence, evalPersonalization, evalCoherence };

export interface EvalResult {
  name: string;
  score: number;
  reason: string;
}

export interface EvalReport {
  evals: EvalResult[];
  avgScore: number;
}

export async function runAllEvals(output: string, contextInput: string): Promise<EvalReport> {
  const [utility, prudence, personalization, coherence] = await Promise.all([
    evalUtility(output, contextInput),
    evalPrudence(output, contextInput),
    evalPersonalization(output, contextInput),
    evalCoherence(output, contextInput),
  ]);

  const clarity = evalClarity(output);

  const evals: EvalResult[] = [
    { name: 'utility', ...utility },
    { name: 'clarity', ...clarity },
    { name: 'prudence', ...prudence },
    { name: 'personalization', ...personalization },
    { name: 'coherence', ...coherence },
  ];

  const avgScore = evals.reduce((sum, e) => sum + e.score, 0) / evals.length;

  return { evals, avgScore };
}

export function saveEvalReport(
  report: EvalReport,
  meta: { agentLevel: number; prompt: string },
): void {
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const entry = {
    timestamp: new Date().toISOString(),
    agentLevel: meta.agentLevel,
    prompt: meta.prompt,
    avgScore: report.avgScore,
    evals: report.evals,
  };

  fs.appendFileSync(
    path.join(logDir, 'evals.jsonl'),
    JSON.stringify(entry) + '\n',
  );
}
