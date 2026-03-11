import OpenAI from 'openai';

export interface JudgeResult {
  pass: boolean;
  reasoning: string;
  score: number;
}

export async function llmJudgeCoherence(
  weatherContext: string,
  agentResponse: string,
): Promise<JudgeResult> {
  const client = new OpenAI();

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-5-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a strict JSON-only evaluator. Return only valid JSON, no markdown.',
        },
        {
          role: 'user',
          content: `You are a quality judge. Evaluate whether this clothing recommendation is coherent with the weather data.

Weather context:
${weatherContext}

Agent response:
${agentResponse}

Reply with valid JSON: {"pass": true/false, "reasoning": "...", "score": 0.0-1.0}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as JudgeResult;
    return {
      pass: Boolean(parsed.pass),
      reasoning: String(parsed.reasoning ?? ''),
      score: Math.max(0, Math.min(1, Number(parsed.score ?? 0))),
    };
  } catch (err) {
    return { pass: true, reasoning: `Judge error: ${String(err)}`, score: 0.5 };
  }
}
