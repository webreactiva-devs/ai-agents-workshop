import { llmEval, type LlmEvalResult } from './llm-eval.js';

export function evalUtility(output: string, contextInput: string): Promise<LlmEvalResult> {
  return llmEval(
    'utility',
    `Does the response provide actionable, specific clothing guidance?
A good response names concrete items (jacket, umbrella, t-shirt, boots...) that the user can act on.
A vague response that just says "dress warm" without specifics scores low.
Score 1.0 for highly actionable, 0.0 for no actionable advice at all.`,
    output,
    contextInput,
  );
}
