import OpenAI from 'openai';

const MODEL = 'gpt-5-mini';

let _client: OpenAI | undefined;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI();
  }
  return _client;
}

export interface LlmEvalResult {
  score: number;
  reason: string;
}

export async function llmEval(
  name: string,
  criteria: string,
  output: string,
  contextInput: string,
): Promise<LlmEvalResult> {
  const prompt = `You are an evaluator for a weather clothing assistant.

## Evaluation criteria: ${name}
${criteria}

## User input
${contextInput}

## Agent response
${output}

Rate the response from 0.0 to 1.0 based ONLY on the criteria above.
Reply with valid JSON only: {"score": 0.0, "reason": "..."}`;

  try {
    const response = await getClient().chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a strict JSON-only evaluator. Return only valid JSON, no markdown.' },
        { role: 'user', content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as LlmEvalResult;
    return {
      score: Math.max(0, Math.min(1, Number(parsed.score ?? 0))),
      reason: String(parsed.reason ?? ''),
    };
  } catch (err) {
    return { score: 0.5, reason: `Eval error: ${String(err)}` };
  }
}
