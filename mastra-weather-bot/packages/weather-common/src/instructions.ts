import { z } from 'zod';
import type { RequestContext } from '@mastra/core/request-context';
import { getPreferredLanguageTag } from './language';

export const weatherRequestContextSchema = z.object({
  'accept-language': z.string().optional(),
});

export function buildWeatherInstructions(options: {
  includePolicy: boolean;
  includeMemory: boolean;
  mentionSkill: boolean;
  mentionMcp: boolean;
  mentionTrace: boolean;
  isRecommender?: boolean;
  isWeatherInterpreter?: boolean;
  preferredLanguageTag?: string;
}) {
  const role = options.isWeatherInterpreter
    ? 'You are a weather interpretation specialist.'
    : options.isRecommender
      ? 'You are a clothing recommendation specialist.'
      : 'You are a weather-aware clothing assistant.';

  const lines = [
    role,
    'Reply in the same language the user uses, unless the user explicitly asks you to switch languages.',
    'Keep the reply concise and natural for that language.',
    options.preferredLanguageTag
      ? `If the user message does not make the language clear, default to the browser language hinted by Accept-Language: ${options.preferredLanguageTag}.`
      : 'If the user message does not make the language clear, default to Spanish.',
    'Do not invent weather data.',
    'Always rely on tools or provided structured inputs for weather facts.',
  ];

  if (options.includePolicy) {
    lines.push('Base your advice on explicit signals for temperature, rain, wind, and apparent temperature rather than vague intuition.');
  }

  if (options.includeMemory) {
    lines.push('When memory is available, personalize the answer using saved preferences like home city, cold sensitivity, commute mode, and umbrella aversion.');
  }

  if (options.mentionSkill) {
    lines.push('Use the dress-advisor workspace skill for formatting consistency and layered recommendations when it is available.');
  }

  if (options.mentionMcp) {
    lines.push('Weather data may arrive through MCP tools; treat them as the source of truth.');
  }

  if (options.mentionTrace) {
    lines.push('Include your reasoning steps explicitly in the answer so that the observability trace shows why each recommendation was made.');
  }

  if (options.isWeatherInterpreter) {
    lines.push('Return a structured weather summary and avoid giving direct clothing advice.');
  }

  if (options.isRecommender) {
    lines.push('Turn structured weather signals into practical clothing advice with upper body, lower body, footwear, and accessories.');
  }

  return lines.join('\n');
}

export function createWeatherInstructions(options: {
  includePolicy: boolean;
  includeMemory: boolean;
  mentionSkill: boolean;
  mentionMcp: boolean;
  mentionTrace: boolean;
  isRecommender?: boolean;
  isWeatherInterpreter?: boolean;
}) {
  return ({ requestContext }: { requestContext: RequestContext<{ 'accept-language'?: string }> }) =>
    buildWeatherInstructions({
      ...options,
      preferredLanguageTag: getPreferredLanguageTag(requestContext.get('accept-language')),
    });
}
