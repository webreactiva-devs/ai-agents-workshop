import type {
  InputProcessor,
  OutputProcessor,
  ProcessInputArgs,
  ProcessOutputStepArgs,
} from '@mastra/core/processors';

/**
 * Extract plain text from a MastraDBMessage.
 *
 * MastraDBMessage.content is `{ format: 2, parts: MastraMessagePart[], content?: string }`.
 * We try `content.content` (legacy fallback), then walk `content.parts` looking for text parts.
 */
function extractText(msg: { content: unknown }): string {
  const c = msg.content as Record<string, unknown> | string | undefined;

  // Legacy: plain string content (MastraMessageV1 or raw)
  if (typeof c === 'string') return c;
  if (!c || typeof c !== 'object') return '';

  // MastraMessageContentV2.content — optional plain-text mirror
  if (typeof c.content === 'string' && c.content.length > 0) return c.content;

  // MastraMessageContentV2.parts
  if (Array.isArray(c.parts)) {
    return (c.parts as Array<Record<string, unknown>>)
      .filter(p => p.type === 'text' && typeof p.text === 'string')
      .map(p => p.text as string)
      .join(' ');
  }

  // Fallback: stringify the whole thing so regex can still find data
  return JSON.stringify(c);
}

/**
 * Input guardrail: ensures user messages are about weather or clothing advice.
 * Aborts with a friendly message if the topic is unrelated.
 */
export const weatherInputGuardrail: InputProcessor = {
  id: 'weather-input-guardrail',
  name: 'Weather Input Guardrail',
  description: 'Ensures user messages are about weather or clothing advice.',

  async processInput({ messages, abort }: ProcessInputArgs) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return messages;

    const lowerText = extractText(lastUserMsg).toLowerCase();

    // Bilingual (ES + EN) topic detection — intentionally broad to avoid false positives.
    const isWeatherRelated =
      /clima|tiempo|temperatura|lluvia|viento|sol|nub|frío|calor|weather|rain|wind|sun|cold|hot|warm|forecast|previsión|pronóstico|grado/.test(
        lowerText,
      );
    const isClothingRelated =
      /ropa|vest|llev|pon|abrig|chaqueta|paraguas|zapato|wear|clothes|dress|jacket|coat|umbrella|outfit|calz/.test(
        lowerText,
      );
    const isLocationOrTime =
      /hoy|mañana|tarde|noche|semana|tomorrow|today|tonight|ciudad|city|salir|paseo|calle/.test(
        lowerText,
      );
    const isGreeting =
      /hola|hello|hi|hey|buenos|buenas|qué tal|gracias|thank/.test(lowerText);
    const isPreference =
      /prefier|prefer|gusta|like|friolero|sensib|bici|bike|caminar|walk/.test(
        lowerText,
      );

    if (
      !isWeatherRelated &&
      !isClothingRelated &&
      !isLocationOrTime &&
      !isGreeting &&
      !isPreference
    ) {
      abort(
        'Solo puedo ayudarte con recomendaciones de ropa basadas en el clima. ¿Qué tiempo hace o qué te pongo?',
      );
    }

    return messages;
  },
};

/**
 * Output guardrail: validates that clothing advice is coherent with weather conditions.
 * Triggers a retry (once) when contradictions are detected.
 */
export const weatherOutputGuardrail: OutputProcessor = {
  id: 'weather-output-guardrail',
  name: 'Weather Output Guardrail',
  description:
    'Validates that clothing advice is coherent with weather conditions.',

  async processOutputStep({
    messages,
    text,
    abort,
    retryCount,
  }: ProcessOutputStepArgs) {
    // Don't retry more than once
    if (retryCount > 0) return messages;

    // Only check when there's text (not tool-only steps)
    if (!text) return messages;

    const output = text.toLowerCase();

    // Gather weather context from the full conversation
    const conversationText = messages
      .map(m => extractText(m))
      .join(' ')
      .toLowerCase();

    // Hot context contradictions — heavy/warm clothing when it's hot
    const hotContext =
      /thermallevel.*hot|temperaturec.*2[7-9]|temperaturec.*3\d|calor|hot|warm.*2[7-9]/.test(
        conversationText,
      );
    const coldAdvice =
      /abrigo|coat|warm coat|grueso|heavy|bufanda|scarf/.test(output);

    if (hotContext && coldAdvice) {
      abort(
        'La respuesta recomienda ropa de abrigo cuando hace calor. Revisa los datos meteorológicos y ajusta la recomendación.',
        { retry: true },
      );
    }

    // Cold context contradictions — light/summer clothing when it's cold
    const coldContext =
      /thermallevel.*cold|temperaturec.*[0-7][^0-9]|frío|cold/.test(
        conversationText,
      );
    const lightAdvice =
      /shorts|pantalón corto|pantalones cortos|lightweight|ligero|tirantes|camiseta de tirantes/.test(
        output,
      );

    if (coldContext && lightAdvice) {
      abort(
        'La respuesta recomienda ropa ligera cuando hace frío. Revisa los datos meteorológicos y ajusta la recomendación.',
        { retry: true },
      );
    }

    // Rain context — high probability but no rain gear mentioned
    const rainyContext =
      /rainlevel.*likely|precipitationprobability.*[5-9]\d|lluvia|rain.*likely/.test(
        conversationText,
      );
    const rainGear =
      /paraguas|umbrella|impermeable|waterproof|chubasquero|shell|cortavientos/.test(
        output,
      );

    if (rainyContext && !rainGear) {
      abort(
        'Hay alta probabilidad de lluvia pero la respuesta no menciona protección contra la lluvia. Añade paraguas o impermeable.',
        { retry: true },
      );
    }

    return messages;
  },
};
