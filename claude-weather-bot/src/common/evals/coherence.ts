import { llmEval, type LlmEvalResult } from './llm-eval.js';

export function evalCoherence(output: string, contextInput: string): Promise<LlmEvalResult> {
  return llmEval(
    'coherence',
    `Is the clothing recommendation coherent with the weather conditions?
Check for contradictions:
- Recommending heavy coats when it's hot (>27°C) → score low
- Recommending shorts/light clothing when it's cold (<8°C) → score low
- Recommending no rain gear when rain probability is high → score low
Score 1.0 if recommendations match the weather perfectly, 0.0 for clear contradictions.`,
    output,
    contextInput,
  );
}
