export interface CoherenceResult {
  coherent: boolean;
  message?: string;
}

export function checkOutputCoherence(output: string, conversationContext: string): CoherenceResult {
  const outputLower = output.toLowerCase();
  const contextLower = conversationContext.toLowerCase();

  const hotContext =
    /thermallevel.*hot|temperaturec.*2[7-9]|temperaturec.*3\d|calor|hot|warm.*2[7-9]/.test(contextLower);
  const coldAdvice =
    /abrigo|coat|warm coat|grueso|heavy|bufanda|scarf/.test(outputLower);

  if (hotContext && coldAdvice) {
    return {
      coherent: false,
      message: 'La respuesta recomienda ropa de abrigo cuando hace calor. Revisa los datos meteorológicos y ajusta la recomendación.',
    };
  }

  const coldContext =
    /thermallevel.*cold|temperaturec.*[0-7][^0-9]|frío|cold/.test(contextLower);
  const lightAdvice =
    /shorts|pantalón corto|pantalones cortos|lightweight|ligero|tirantes|camiseta de tirantes/.test(outputLower);

  if (coldContext && lightAdvice) {
    return {
      coherent: false,
      message: 'La respuesta recomienda ropa ligera cuando hace frío. Revisa los datos meteorológicos y ajusta la recomendación.',
    };
  }

  const rainyContext =
    /rainlevel.*likely|precipitationprobability.*[5-9]\d|lluvia|rain.*likely/.test(contextLower);
  const rainGear =
    /paraguas|umbrella|impermeable|waterproof|chubasquero|shell|cortavientos/.test(outputLower);

  if (rainyContext && !rainGear) {
    return {
      coherent: false,
      message: 'Hay alta probabilidad de lluvia pero la respuesta no menciona protección contra la lluvia.',
    };
  }

  return { coherent: true };
}
