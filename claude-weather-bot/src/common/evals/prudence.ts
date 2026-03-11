import { llmEval, type LlmEvalResult } from './llm-eval.js';

export function evalPrudence(output: string, contextInput: string): Promise<LlmEvalResult> {
  return llmEval(
    'prudence',
    `Does the response handle weather risks appropriately?
If there are signs of rain (precipitation, lluvia), it should mention rain protection (umbrella, waterproof, shell).
If there is strong wind, it should mention wind protection.
If conditions are cold, it should err on the side of warmth.
Score 1.0 if all risks are addressed, 0.0 if obvious risks are completely ignored.`,
    output,
    contextInput,
  );
}
