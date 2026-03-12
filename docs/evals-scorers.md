# Evals / Scorers (Evaluacion de calidad)

Los scorers son evaluadores que miden la calidad de las respuestas del agente en multiples dimensiones. Se ejecutan **despues** de que el agente genera su respuesta y producen puntuaciones (0-1) con razonamiento. No bloquean la respuesta: son observacionales.

**Archivo fuente:** `packages/weather-common/src/scorers.ts`

**App que los usa:** `apps/weather-dual-agent-eval/`

---

## Arquitectura general

Hay **5 scorers**, de los cuales 4 usan **LLM-as-Judge** (un modelo externo evalua la respuesta) y 1 es **determinista** (regla de codigo).

Todos se crean con `createScorer` de `@mastra/core/evals`.

### Modelo juez

Los scorers LLM usan `openai/gpt-5.2` como juez con instrucciones de sistema especializadas:

```
"You are an expert evaluator of a weather-based clothing recommendation chatbot.
 You evaluate the quality of its responses across several dimensions.
 Always respond with the requested JSON schema. Be strict but fair."
```

Todos producen un `{ score: number (0-1), reasoning: string }`.

---

## Scorer 1: Utility (LLM-as-Judge)

**ID:** `utility-scorer`

### Que evalua

Si la respuesta contiene **prendas concretas y accionables** que el usuario pueda vestir (ej. "chaqueta", "botas") en lugar de consejos vagos (ej. "abrigate").

### Cuando puntua 0

- Respuestas genericas sin prendas especificas.
- Solo consejos abstractos como "vistete segun el clima".

### Cuando puntua 1

- Menciona prendas concretas: "camiseta, chaqueta ligera, pantalon largo".

---

## Scorer 2: Clarity (Determinista)

**ID:** `clarity-scorer`

### Que evalua

Si la respuesta tiene una **longitud adecuada** (entre 20 y 500 caracteres). No usa LLM.

### Cuando puntua 0

- Respuesta demasiado corta (< 20 chars): probablemente incompleta.
- Respuesta demasiado larga (>= 500 chars): verbosidad excesiva.

### Cuando puntua 1

- Longitud entre 20 y 499 caracteres.

### Razonamiento

Devuelve la longitud real si falla: *"Response length is outside the target range: 723 chars."*

---

## Scorer 3: Prudence (LLM-as-Judge)

**ID:** `prudence-scorer`

### Que evalua

Si la respuesta maneja el **riesgo de lluvia** de forma prudente cuando los datos meteorologicos lo indican.

### Reglas del prompt del juez

- Si precipitacion > 25% → la respuesta DEBE mencionar proteccion (paraguas, impermeable, chubasquero, shell).
- Si NO hay riesgo de lluvia → puntua 1 automaticamente.
- Si el usuario odia los paraguas → debe ofrecer alternativas impermeables.

### Cuando puntua 0

- Hay lluvia probable y no se menciona ningun tipo de proteccion.

### Cuando puntua 1

- No hay lluvia, o la respuesta incluye proteccion adecuada.

---

## Scorer 4: Personalization (LLM-as-Judge)

**ID:** `personalization-scorer`

### Que evalua

Si la respuesta **refleja las preferencias del usuario** cuando estan presentes en el input.

### Preferencias que busca

| Preferencia | Adaptacion esperada |
|---|---|
| Sensibilidad al frio (friolero) | Ropa mas abrigada |
| Modo de transporte (bici/caminar) | Considerar exposicion al viento, movilidad |
| Aversion a paraguas | Sugerir capas impermeables en vez de paraguas |
| Ciudad habitual | Usarla como ubicacion por defecto |
| Estilo de respuesta | Ajustar verbosidad |

### Cuando puntua 0

- Hay preferencias en el input pero la respuesta las ignora.

### Cuando puntua 1

- No hay preferencias (puntua 1 automaticamente).
- Hay preferencias y la respuesta se adapta a ellas.

---

## Scorer 5: Weather Coherence (LLM-as-Judge)

**ID:** `weather-coherence-scorer`

### Que evalua

Si la recomendacion de ropa es **coherente con los datos meteorologicos**. Busca contradicciones logicas.

### Contradicciones que detecta

| Contexto | Ropa contradictoria |
|---|---|
| Calor (>27 C, "hot") | Abrigo grueso, lana, capas pesadas |
| Frio (<8 C, "cold") | Shorts, tirantes, sandalias |
| Viento fuerte | Sin proteccion contra el viento |
| Clima templado | Ropa extrema en cualquier direccion |

### Tambien evalua coherencia positiva

- El nivel de capas coincide con la temperatura.
- Los accesorios son apropiados para las condiciones.

---

## Donde se ejecutan

### Registro en el runtime

Los 5 scorers se registran en el `Mastra` runtime de `weather-dual-agent-eval`:

```typescript
// apps/weather-dual-agent-eval/src/mastra/index.ts
export const mastra = createMastraRuntime({
  scorers: {
    utilityScorer,
    weatherCoherenceScorer,
    personalizationScorer,
    prudenceScorer,
    clarityScorer,
  },
});
```

### Ejecucion en el workflow

Se lanzan en el paso `recommend-clothing` del workflow `weatherAdviceWorkflow`. Se asocian a la llamada `.generate()` del agente recomendador:

```typescript
// apps/weather-dual-agent-eval/src/mastra/workflows/weather-advice-workflow.ts
const result = await weatherRecommenderAgent.generate(messages, {
  scorers: {
    utility:          { scorer: utilityScorer.name },
    coherence:        { scorer: weatherCoherenceScorer.name },
    personalization:  { scorer: personalizationScorer.name },
    prudence:         { scorer: prudenceScorer.name },
    clarity:          { scorer: clarityScorer.name },
  },
  returnScorerData: true,
});
```

### Flujo de ejecucion

```
weatherAdviceWorkflow
       │
       ▼
┌──────────────────────┐
│ interpret-weather     │  weatherInterpreterAgent extrae datos estructurados
│ (paso 1)             │
└──────────┬───────────┘
           │ WeatherSnapshot + Signals
           ▼
┌──────────────────────┐
│ recommend-clothing    │  weatherRecommenderAgent genera la recomendacion
│ (paso 2)             │
│                      │
│  ┌─ scorers ───────┐ │
│  │ utility         │ │  Se evaluan los 5 scorers sobre la respuesta
│  │ coherence       │ │  generada. Los resultados se adjuntan al output
│  │ personalization │ │  del paso (returnScorerData: true).
│  │ prudence        │ │
│  │ clarity         │ │
│  └─────────────────┘ │
└──────────┬───────────┘
           │
           ▼
   Recomendacion + Scores
```

---

## Diferencia entre Guardrails y Scorers

| | Guardrails | Scorers |
|---|---|---|
| **Momento** | Antes/despues de generar | Despues de generar |
| **Efecto** | Bloquean o fuerzan reintento | Solo observan y puntuan |
| **Tipo** | Deterministas (regex) | LLM-as-Judge + deterministas |
| **Objetivo** | Seguridad, coherencia minima | Calidad multidimensional |
| **App** | `weather-policy` | `weather-dual-agent-eval` |
