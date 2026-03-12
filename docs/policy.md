# Policy (Logica determinista de recomendaciones)

La policy es una capa de logica **determinista** (sin LLM) que transforma datos meteorologicos crudos en senales de recomendacion y prendas concretas. El agente la invoca como herramienta (tool) para anclar sus respuestas en reglas predecibles.

**Archivo fuente:** `packages/weather-common/src/policy.ts`

**Apps que la usan:** `weather-policy/`, `weather-dual-agent-eval/` (a traves de tools)

---

## Funcion 1: `deriveRecommendationSignals`

### Que hace

Recibe un `WeatherSnapshot` y opcionalmente preferencias del usuario. Devuelve un objeto `RecommendationSignals` con clasificaciones discretas del clima.

### Cuando se lanza

Se expone como la tool `deriveSignalsTool`. El agente la llama cuando necesita interpretar datos meteorologicos antes de recomendar ropa.

### Logica de clasificacion

#### Temperatura percibida (ajustada por preferencias)

Primero ajusta la temperatura aparente segun las preferencias del usuario:

| Preferencia | Ajuste |
|---|---|
| `coldSensitivity: "high"` (friolero) | -2 C |
| `coldSensitivity: "low"` | +1 C |
| `commuteMode: "bike"` | -1 C (exposicion al viento) |

#### Nivel termico (`thermalLevel`)

| Rango de temperatura percibida | Nivel |
|---|---|
| < 8 C | `cold` |
| 8 - 13 C | `cool` |
| 14 - 20 C | `mild` |
| 21 - 26 C | `warm` |
| >= 27 C | `hot` |

#### Nivel de lluvia (`rainLevel`)

| Probabilidad de precipitacion | Nivel |
|---|---|
| >= 55% | `likely` |
| 25% - 54% | `possible` |
| < 25% | `dry` |

#### Nivel de viento (`windLevel`)

| Velocidad del viento | Nivel |
|---|---|
| >= 28 km/h | `windy` |
| 16 - 27 km/h | `breezy` |
| < 16 km/h | `calm` |

#### Senales derivadas

| Senal | Logica |
|---|---|
| `umbrellaAdvice` | `likely` → `"yes"`, `possible` → `"optional"`, `dry` → `"no"` |
| `layeringAdvice` | `cold` → `"heavy"`, `cool`/`mild` → `"medium"`, `warm`/`hot` → `"light"` |

#### Notas contextuales

Se anaden notas adicionales al resultado cuando:
- El usuario va en bici → *"Cycling increases wind exposure"*
- El usuario odia los paraguas y hay lluvia → *"User prefers avoiding umbrellas"*

---

## Funcion 2: `createDeterministicRecommendation`

### Que hace

Genera una recomendacion completa de ropa (`DressRecommendation`) a partir de los datos meteorologicos. Internamente llama a `deriveRecommendationSignals` y luego mapea las senales a prendas concretas.

### Cuando se lanza

Se expone como la tool `recommendClothingTool`. El agente la llama cuando quiere una recomendacion completa sin depender del LLM para elegir prendas.

### Mapeo de senales a prendas

#### Parte superior (`upperBody`)

| `layeringAdvice` | Prendas |
|---|---|
| `heavy` | camiseta manga larga + abrigo |
| `medium` | camiseta + chaqueta ligera |
| `light` | camiseta |

#### Parte inferior (`lowerBody`)

| Condicion | Prenda |
|---|---|
| Default | pantalon largo |
| `thermalLevel === "hot"` | pantalon ligero o shorts |

#### Calzado (`footwear`)

| Condicion | Prenda |
|---|---|
| Default | zapato cerrado |
| `thermalLevel === "hot"` | zapato ligero |

#### Accesorios (`accessories`)

| Condicion | Accesorio |
|---|---|
| Lluvia probable + no odia paraguas | paraguas |
| Lluvia + odia paraguas | chubasquero/shell impermeable |
| Viento fuerte | capa cortavientos |

### Ejemplo de salida

Para Valladolid a 6 C, 60% lluvia, 20 km/h viento, usuario friolero:

```json
{
  "weatherSummary": "Valladolid: 8C, feels like 6C, rain 60%, wind 20 km/h.",
  "signals": {
    "thermalLevel": "cold",
    "rainLevel": "likely",
    "windLevel": "breezy",
    "umbrellaAdvice": "yes",
    "layeringAdvice": "heavy"
  },
  "clothing": {
    "upperBody": ["long-sleeve base layer", "warm coat"],
    "lowerBody": ["long trousers"],
    "footwear": ["closed shoes"],
    "accessories": ["umbrella"]
  },
  "explanation": "Thermal level is cold, rain is likely, and wind is breezy."
}
```

---

## Relacion con los Guardrails

La policy y los guardrails son complementarios:

- **Policy:** decide QUE recomendar (determinista, basada en reglas).
- **Output Guardrail:** valida que la respuesta final del LLM sea COHERENTE con lo que la policy habria recomendado.

El agente usa las tools de policy para obtener datos estructurados, luego formula su respuesta en lenguaje natural. El output guardrail verifica que esa respuesta no contradiga los datos.
