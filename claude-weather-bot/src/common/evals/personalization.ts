import { llmEval, type LlmEvalResult } from './llm-eval.js';

export function evalPersonalization(output: string, contextInput: string): Promise<LlmEvalResult> {
  return llmEval(
    'personalization',
    `Does the response reflect known user preferences when they are present in the input?
Look for signals like: cold sensitivity (friolero), commute mode (bike, walking), umbrella aversion, home city.
If preferences are present in the context, the response should adapt to them.
If no preferences are present, score 1.0 (not applicable).
Score 0.0 if preferences are clearly present but completely ignored.`,
    output,
    contextInput,
  );
}
