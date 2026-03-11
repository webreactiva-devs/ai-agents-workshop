import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

function normalizeText(output: unknown): string {
  if (Array.isArray(output)) {
    return output
      .map(item =>
        typeof item === 'object' && item && 'content' in item ? String((item as { content: unknown }).content) : String(item),
      )
      .join(' ');
  }

  return String(output ?? '');
}

// ---------------------------------------------------------------------------
// Judge model – used by all LLM-based scorers
// ---------------------------------------------------------------------------

const JUDGE_MODEL = 'openai/gpt-5.2';

const JUDGE_SYSTEM = [
  'You are an expert evaluator of a weather-based clothing recommendation chatbot.',
  'The chatbot receives weather data and user preferences and recommends what to wear.',
  'You evaluate the quality of its responses across several dimensions.',
  'Always respond with the requested JSON schema. Be strict but fair.',
].join(' ');

const verdictSchema = z.object({
  score: z.number().min(0).max(1),
  reasoning: z.string(),
});

// ---------------------------------------------------------------------------
// 1. Utility — LLM-as-Judge
// ---------------------------------------------------------------------------

export const utilityScorer = createScorer({
  id: 'utility-scorer',
  description: 'Evaluates whether the response provides actionable, concrete clothing guidance.',
  type: 'agent',
  judge: { model: JUDGE_MODEL, instructions: JUDGE_SYSTEM },
})
  .analyze({
    description: 'Ask the LLM whether the response contains actionable clothing items.',
    outputSchema: verdictSchema,
    createPrompt: ({ run }) => {
      const output = normalizeText(run.output);
      return `Evaluate whether this clothing recommendation contains concrete, actionable items the user can wear (e.g. specific garments like jacket, trousers, boots — not vague advice like "dress warm").

Response to evaluate:
"""
${output}
"""

Return a JSON object with "score" (0 if no actionable clothing advice, 1 if concrete wearable items are present) and "reasoning".`;
    },
  })
  .generateScore(({ results }) => results.analyzeStepResult.score)
  .generateReason(({ results }) => results.analyzeStepResult.reasoning);

// ---------------------------------------------------------------------------
// 2. Clarity — deterministic
// ---------------------------------------------------------------------------

export const clarityScorer = createScorer({
  id: 'clarity-scorer',
  description: 'Checks whether the answer is concise and readable (20–500 chars).',
  type: 'agent',
})
  .generateScore(({ run }) => {
    const text = normalizeText(run.output);
    return text.length > 20 && text.length < 500 ? 1 : 0;
  })
  .generateReason(({ run, score }) => {
    return score
      ? 'Response length is within the target range.'
      : `Response length is outside the target range: ${normalizeText(run.output).length} chars.`;
  });

// ---------------------------------------------------------------------------
// 3. Prudence — LLM-as-Judge
// ---------------------------------------------------------------------------

export const prudenceScorer = createScorer({
  id: 'prudence-scorer',
  description: 'Evaluates whether the response handles rain risk appropriately when present.',
  type: 'agent',
  judge: { model: JUDGE_MODEL, instructions: JUDGE_SYSTEM },
})
  .analyze({
    description: 'Ask the LLM whether rain risk is handled prudently.',
    outputSchema: verdictSchema,
    createPrompt: ({ run }) => {
      const input = JSON.stringify(run.input ?? {});
      const output = normalizeText(run.output);
      return `Given the weather context and the clothing recommendation, evaluate whether rain risk is handled prudently.

Rules:
- If the weather data indicates rain risk (precipitation probability above 25%, or mentions of rain/lluvia), the recommendation MUST mention some form of rain protection (umbrella, waterproof layer, shell, chubasquero, impermeable).
- If there is no rain risk, score 1 automatically.
- Consider that a user who hates umbrellas should be offered waterproof alternatives instead.

Weather context / input:
"""
${input}
"""

Clothing recommendation / output:
"""
${output}
"""

Return a JSON object with "score" (0 or 1) and "reasoning".`;
    },
  })
  .generateScore(({ results }) => results.analyzeStepResult.score)
  .generateReason(({ results }) => results.analyzeStepResult.reasoning);

// ---------------------------------------------------------------------------
// 4. Personalization — LLM-as-Judge
// ---------------------------------------------------------------------------

export const personalizationScorer = createScorer({
  id: 'personalization-scorer',
  description: 'Evaluates whether the response reflects known user preferences.',
  type: 'agent',
  judge: { model: JUDGE_MODEL, instructions: JUDGE_SYSTEM },
})
  .analyze({
    description: 'Ask the LLM whether user preferences are reflected in the recommendation.',
    outputSchema: verdictSchema,
    createPrompt: ({ run }) => {
      const input = JSON.stringify(run.input ?? {});
      const output = normalizeText(run.output);
      return `Evaluate whether the clothing recommendation reflects the user's stated preferences.

Preference types to look for in the input:
- Cold sensitivity (friolero / high cold sensitivity) → should recommend warmer clothing
- Commute mode (bike / walking) → should consider wind exposure or mobility
- Umbrella aversion → should suggest waterproof layers instead of umbrellas
- Home city → should use it as default location
- Response style preference → should match verbosity

If NO preferences are present in the input, score 1 automatically.
If preferences ARE present, score 1 only if the recommendation meaningfully adapts to them.

Input (may contain preferences):
"""
${input}
"""

Recommendation:
"""
${output}
"""

Return a JSON object with "score" (0 or 1) and "reasoning".`;
    },
  })
  .generateScore(({ results }) => results.analyzeStepResult.score)
  .generateReason(({ results }) => results.analyzeStepResult.reasoning);

// ---------------------------------------------------------------------------
// 5. Weather Coherence — LLM-as-Judge
// ---------------------------------------------------------------------------

export const weatherCoherenceScorer = createScorer({
  id: 'weather-coherence-scorer',
  description: 'Evaluates whether the clothing recommendation is coherent with the weather conditions.',
  type: 'agent',
  judge: { model: JUDGE_MODEL, instructions: JUDGE_SYSTEM },
})
  .analyze({
    description: 'Ask the LLM whether the recommendation contradicts the weather.',
    outputSchema: verdictSchema,
    createPrompt: ({ run }) => {
      const input = JSON.stringify(run.input ?? {});
      const output = normalizeText(run.output);
      return `Evaluate whether the clothing recommendation is coherent with the weather data.

Look for contradictions such as:
- Hot weather (>27°C, thermalLevel "hot" or "warm") with heavy winter clothing (thick coat, heavy layers, wool)
- Cold weather (<8°C, thermalLevel "cold") with light summer clothing (shorts, tank tops, sandals)
- High wind with no wind protection mentioned
- Mild weather with extreme clothing in either direction

Also consider POSITIVE coherence:
- Does the layering level match the temperature?
- Are accessories appropriate for the conditions?

Weather context:
"""
${input}
"""

Clothing recommendation:
"""
${output}
"""

Return a JSON object with "score" (0 if contradictory, 1 if coherent) and "reasoning".`;
    },
  })
  .generateScore(({ results }) => results.analyzeStepResult.score)
  .generateReason(({ results }) => results.analyzeStepResult.reasoning);
