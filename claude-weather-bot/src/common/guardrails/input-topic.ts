export interface GuardrailResult {
  allowed: boolean;
  message?: string;
}

export function checkInputTopic(userMessage: string): GuardrailResult {
  const lower = userMessage.toLowerCase();

  const isWeatherRelated =
    /clima|tiempo|temperatura|lluvia|viento|sol|nub|frío|calor|weather|rain|wind|sun|cold|hot|warm|forecast|previsión|pronóstico|grado/.test(lower);
  const isClothingRelated =
    /ropa|vest|llev|pon|abrig|chaqueta|paraguas|zapato|wear|clothes|dress|jacket|coat|umbrella|outfit|calz/.test(lower);
  const isLocationOrTime =
    /hoy|mañana|tarde|noche|semana|tomorrow|today|tonight|ciudad|city|salir|paseo|calle/.test(lower);
  const isGreeting =
    /hola|hello|hi|hey|buenos|buenas|qué tal|gracias|thank/.test(lower);
  const isPreference =
    /prefier|prefer|gusta|like|friolero|sensib|bici|bike|caminar|walk/.test(lower);

  if (!isWeatherRelated && !isClothingRelated && !isLocationOrTime && !isGreeting && !isPreference) {
    return {
      allowed: false,
      message: 'Solo puedo ayudarte con recomendaciones de ropa basadas en el clima. ¿Qué tiempo hace o qué te pongo?',
    };
  }

  return { allowed: true };
}
