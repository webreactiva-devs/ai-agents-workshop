# Arquitectura y Patrones de Agentes — Guia Agnóstica

> Documento de referencia para replicar los 6 chatbots de este proyecto en **cualquier framework de agentes de IA** (Claude Agent SDK, LangGraph, CrewAI, Semantic Kernel, etc.).
> Describe la arquitectura, los patrones y los contratos de cada nivel sin depender de primitivas específicas de Mastra.

---

## Dominio compartido

Todos los agentes resuelven el mismo caso de uso:

**"Voy a salir fuera en Valladolid, ¿cómo debería vestirme?"**

El sistema consulta una API meteorológica (Open-Meteo) y recomienda ropa en función de temperatura, lluvia, viento, sensación térmica y — cuando aplica — preferencias del usuario.

### Esquemas de datos comunes

Cualquier implementación necesita estos contratos:

| Esquema | Campos clave | Uso |
|---------|-------------|-----|
| **WeatherSnapshot** | `locationName`, `temperatureC`, `apparentTemperatureC`, `precipitationProbability` (0-100), `windSpeedKph`, `weatherCode`, `isDay`, `forecastWindow {start, end}` | Dato crudo de la API meteorológica |
| **RecommendationSignals** | `thermalLevel` (cold/cool/mild/warm/hot), `rainLevel` (dry/possible/likely), `windLevel` (calm/breezy/windy), `umbrellaAdvice`, `layeringAdvice`, `notes[]` | Señales intermedias derivadas por reglas |
| **UserPreferenceProfile** | `homeLocationName`, `coldSensitivity` (low/medium/high), `commuteMode` (walking/bike/car/public-transport), `hatesUmbrellas`, `responseStyle` | Perfil del usuario almacenado en memoria |
| **DressRecommendation** | `weatherSummary`, `signals`, `clothing {upperBody[], lowerBody[], footwear[], accessories[]}`, `explanation` | Salida estructurada final |

### Herramientas (Tools) reutilizables

| Tool | Entrada | Salida | Naturaleza |
|------|---------|--------|------------|
| `getWeatherByCity` | `{locationName, hoursAhead}` | `WeatherSnapshot` | **I/O** — llama a API externa |
| `deriveSignals` | `{weather, preferences?}` | `RecommendationSignals` | **Determinista** — lógica de reglas pura |
| `recommendClothing` | `{weather, preferences?}` | `DressRecommendation` | **Determinista** — reglas puras |

### Reglas de la política determinista

Estas reglas son funciones puras que cualquier framework puede implementar:

```
Ajuste de temperatura percibida:
  - coldSensitivity alta  → -2 °C
  - coldSensitivity baja  → +1 °C
  - commuteMode bici      → -1 °C (exposición al viento)

Umbrales térmicos (sobre temperatura percibida):
  cold  < 8 °C
  cool  8–14 °C
  mild  14–21 °C
  warm  21–27 °C
  hot   > 27 °C

Umbrales de lluvia (sobre precipitationProbability):
  likely   ≥ 55%
  possible ≥ 25%
  dry      < 25%

Umbrales de viento (sobre windSpeedKph):
  windy   ≥ 28 kph
  breezy  ≥ 16 kph
  calm    < 16 kph
```

---

## Nivel 1 — weather-basic: Agente + Tool

### Patrón: Augmented LLM

```
[Usuario] → [Agente LLM] → [Tool: getWeatherByCity] → [API Meteo]
                  ↓
           [Respuesta libre]
```

### Arquitectura

- **1 agente**, **1 tool**
- Sin política, sin memoria, sin guardrails
- El LLM recibe datos crudos del clima y genera la recomendación libremente

### System prompt (contrato)

```
Eres un asistente de ropa basado en el clima.
- Responde en el idioma del usuario.
- Mantén las respuestas concisas y naturales.
- Si el idioma no está claro, usa español.
- NUNCA inventes datos meteorológicos; usa solo las tools disponibles.
```

### Qué implementar

1. Un agente con un system prompt básico
2. Una tool que reciba nombre de ciudad y horas de previsión, llame a Open-Meteo y devuelva `WeatherSnapshot`
3. Endpoint de chat (streaming recomendado)

### Limitaciones inherentes

- La recomendación es genérica e impredecible (el LLM decide todo)
- No hay forma de garantizar coherencia entre clima y consejo
- No hay personalización

---

## Nivel 2 — weather-policy: Agente + Política + Guardrails

### Patrones: Augmented LLM, Policy Layer, Input/Output Guardrails

```
[Usuario] → [Input Guardrail] → [Agente LLM]
                                      |
                    +-----------------+-----------------+
                    |                 |                 |
              [getWeatherByCity] [deriveSignals] [recommendClothing]
                    |                 |                 |
                    v                 v                 v
              WeatherSnapshot → Signals → DressRecommendation
                                      |
                                      v
                               [Output Guardrail] → [Respuesta]
```

### Arquitectura

- **1 agente**, **3 tools** (1 de I/O + 2 deterministas)
- **Input guardrail**: filtra mensajes fuera de tema antes de llegar al agente
- **Output guardrail**: valida coherencia de la respuesta antes de enviarla al usuario
- **Memoria habilitada** (historial de conversación)
- El LLM ya no inventa recomendaciones; presenta la salida de un motor de reglas

### Input Guardrail — Filtro de tema

Analiza el último mensaje del usuario buscando palabras clave bilingues (ES/EN):

- **Clima**: clima, tiempo, temperatura, lluvia, viento, sol, weather, rain, wind...
- **Ropa**: ropa, vest, llev, pon, abrig, wear, clothes, jacket...
- **Contexto**: hoy, mañana, tarde, ciudad, city, salir...
- **Saludos**: hola, hello, gracias, thank...
- **Preferencias**: friolero, bike, umbrella, prefer...

Si ninguna categoría coincide → **rechaza** con mensaje amigable:
> "Solo puedo ayudarte con recomendaciones de ropa basadas en el clima."

### Output Guardrail — Validación de coherencia

Extrae contexto del clima de la conversación y busca contradicciones:

| Contexto detectado | Respuesta contradictoria | Acción |
|---|---|---|
| Temperatura > 27 °C o thermal=hot | Menciona abrigo/coat pesado | Reintento (1 vez) |
| Temperatura < 8 °C o thermal=cold | Menciona shorts/ropa ligera | Reintento (1 vez) |
| Lluvia > 55% o rain=likely | No menciona paraguas/impermeable | Reintento (1 vez) |

Si falla tras el reintento → el guardrail fuerza una corrección o aborta.

### System prompt (contrato adicional)

Se añade al prompt base:
```
Basa tu consejo en señales explícitas de temperatura, lluvia, viento
y sensación térmica en vez de intuición vaga.
```

### Qué implementar

1. Todo lo del nivel 1
2. Dos tools deterministas (`deriveSignals`, `recommendClothing`) que encapsulan la lógica de reglas
3. Un **preprocesador de entrada** que rechace mensajes fuera de tema
4. Un **postprocesador de salida** que detecte contradicciones clima↔ropa y fuerce reintento
5. Máximo 1 reintento para evitar bucles

---

## Nivel 3 — weather-memory: Agente + Memoria de trabajo

### Patrones: Augmented LLM, Working Memory, Personalization

```
[Usuario] → [Agente LLM]
                 |
     +-----------+-----------+
     |                       |
[getWeatherByCity]    [Working Memory]
     |                   |
     v                   v
WeatherSnapshot    Preferencias guardadas
                   (ciudad, frío, transporte,
                    estilo, paraguas)
                         |
                         v
                 [Respuesta personalizada]
```

### Arquitectura

- **1 agente**, **1 tool** (solo `getWeatherByCity`)
- **Sin tools de política** — el LLM usa su juicio + las preferencias guardadas
- **Memoria de trabajo persistente** con plantilla estructurada
- La personalización viene de la memoria, no de reglas deterministas

### Memoria de trabajo — Plantilla

La memoria de trabajo es un documento estructurado que el agente actualiza progresivamente:

```markdown
# Preferencias del usuario
## Ubicación
- Ciudad habitual:
- Otras ciudades frecuentes:
## Transporte
- Medio de transporte habitual: [andando, bici, coche, transporte público]
## Sensibilidad al clima
- Sensibilidad al frío: [alta/normal/baja]
- Aversión a paraguas: [sí/no]
## Estilo
- Preferencias de ropa:
- Notas adicionales:
```

### Mecanismo de memoria

1. Se mantienen los **últimos 20 mensajes** de la conversación
2. La memoria de trabajo es un bloque de texto persistente entre sesiones
3. El agente tiene acceso a una **tool de actualización de memoria** (inyectada automáticamente)
4. Cuando el usuario menciona preferencias ("soy friolero", "voy en bici"), el agente actualiza la plantilla
5. En conversaciones futuras, el agente lee la memoria al inicio y personaliza

### System prompt (contrato adicional)

```
Cuando la memoria esté disponible, personaliza usando preferencias guardadas:
ciudad habitual, sensibilidad al frío, modo de transporte, aversión a paraguas.
```

### Diferencia clave con nivel 2

| Aspecto | Nivel 2 (Policy) | Nivel 3 (Memory) |
|---------|-------------------|-------------------|
| Tools de decisión | `deriveSignals` + `recommendClothing` | Solo `getWeatherByCity` |
| Lógica de ropa | Determinista (reglas) | LLM + preferencias |
| Personalización | Posible via esquema | Real via memoria persistente |
| Reproducibilidad | Alta (misma entrada → misma salida) | Variable (depende del LLM) |

### Qué implementar

1. Un agente con una tool de clima
2. Un **sistema de memoria de trabajo** persistente entre sesiones
3. Una **plantilla estructurada** que guíe qué preferencias recordar
4. Una tool o mecanismo para que el agente **escriba** en la memoria
5. Historial de conversación limitado (ej: últimos 20 mensajes)
6. Aislamiento de memoria por usuario (`resourceId`)

---

## Nivel 4 — weather-skill: Agente + Política + Memoria + Skill

### Patrones: Augmented LLM, Policy Layer, Working Memory, Reusable Skill

```
[Usuario] → [Agente LLM]
                 |
    +------------+------------+------------+
    |            |            |            |
[getWeather] [deriveSignals] [recommend]  [Memory]
    |            |            |
    v            v            v
  Datos →    Señales →    Ropa
                 |
                 +--> [Skill: dress-advisor]
                 |     (reglas de formato
                 |      y consistencia)
                 v
          [Respuesta consistente]
```

### Arquitectura

- **1 agente**, **3 tools** (1 de I/O + 2 deterministas)
- **Memoria** habilitada (configuración por defecto)
- **Skill reutilizable** (`dress-advisor`) como guía de comportamiento

### Qué es una Skill

Una skill es un **paquete de instrucciones reutilizables** que encapsula comportamiento especializado. No es código ejecutable; es un documento que el agente incorpora a su contexto.

### Skill: dress-advisor

```markdown
Reglas del skill dress-advisor:
- Prefiere recomendaciones por capas sobre prendas únicas
- Menciona: parte superior, parte inferior, calzado y accesorios
- Refleja temperatura aparente, probabilidad de lluvia y viento
- Si el usuario no le gustan los paraguas, sugiere chubasqueros/capas impermeables
- Mantén la respuesta compacta y práctica
```

### Diferencia clave con nivel 3

| Aspecto | Nivel 3 (Memory) | Nivel 4 (Skill) |
|---------|-------------------|-------------------|
| Tools de decisión | Solo clima | Clima + política completa |
| Lógica de ropa | LLM libre | Determinista + skill |
| Consistencia | Variable | Alta (skill guía formato) |
| Memoria | Plantilla custom detallada | Configuración por defecto |

### Qué implementar

1. Todo lo del nivel 2 (agente + 3 tools + política)
2. Memoria persistente
3. Un **documento de skill** que el agente cargue como contexto adicional
4. El skill define reglas de formato y consistencia, no lógica nueva
5. El skill es reutilizable: podría aplicarse a otros agentes con el mismo dominio

---

## Nivel 5 — weather-mcp-trace: Agente + MCP + Trazabilidad

### Patrones: Augmented LLM, MCP Protocol, Observability, Working Memory, Reusable Skill

```
[Usuario] → [Agente LLM]
                 |
    +------------+------------+
    |            |            |
 [Memory]    [Skill]    [MCP Client]
                             |
                             v (SSE)
                      [MCP Server]
                         |     |
                    [getWeather] [getWeatherByCity]
                         |
                         +→ [Tracing: mcp-tool-trace.jsonl]
                         |
                         v
                      [API Meteo]
```

### Arquitectura

- **1 agente**, tools **descubiertas dinámicamente** via MCP
- **MCP Client** conecta al agente con un servidor MCP remoto via SSE
- **MCP Server** expone las tools con trazabilidad integrada
- **Memoria** y **skill** disponibles
- Las tools NO están hardcodeadas en el agente

### MCP (Model Context Protocol)

MCP es un protocolo estándar para que agentes descubran y usen herramientas de forma dinámica:

1. El agente se conecta a un **MCP Server** via URL (ej: `http://127.0.0.1:8788/sse`)
2. Llama a `listTools()` para descubrir qué tools hay disponibles
3. Invoca las tools por nombre, sin importar cómo estén implementadas
4. El servidor puede cambiar, añadir o quitar tools sin modificar el agente

### Trazabilidad

Cada invocación de tool en el MCP Server genera trazas:

```jsonl
{"tool":"get-weather-by-city","phase":"call","data":{"locationName":"Madrid","hoursAhead":6},"ts":"..."}
{"tool":"get-weather-by-city","phase":"result","data":{"step":"location-resolved","lat":40.41,"lon":-3.70},"ts":"..."}
```

Tres fases por invocación:
- `call` — parámetros de entrada
- `result` — datos de salida (parciales o completos)
- `error` — excepción capturada

### Skill con formato de traza

El skill `dress-advisor` en este nivel incluye un formato de traza estructurado:

```
[dress-advisor: layering=medium, rain=possible, wind=calm, umbrella=avoided]
```

Esto permite auditar qué decisiones tomó el skill dentro de la respuesta.

### System prompt (contratos adicionales)

```
Los datos meteorológicos pueden llegar a través de tools MCP;
trátalos como fuente de verdad igual que las tools directas.

Incluye los pasos de razonamiento explícitamente en la respuesta
para facilitar la observabilidad.
```

### Qué implementar

1. Un **servidor MCP** que exponga tools de clima con protocolo estándar (SSE o stdio)
2. Un **cliente MCP** en el agente que descubra tools en tiempo de ejecución
3. **Middleware de trazabilidad** en el servidor que registre call/result/error en un log estructurado (JSONL)
4. Memoria de trabajo y skill como en niveles anteriores
5. El agente NO importa las tools directamente; las descubre via MCP

### Diferencia clave con niveles anteriores

| Aspecto | Niveles 1-4 | Nivel 5 (MCP+Trace) |
|---------|-------------|----------------------|
| Binding de tools | Estático (import) | Dinámico (MCP discovery) |
| Observabilidad | Logs genéricos | Trazas estructuradas por tool |
| Desacoplamiento | Agente conoce las tools | Agente solo conoce el servidor |
| Intercambiabilidad | Hay que modificar código | Se cambia el servidor sin tocar el agente |

---

## Nivel 6 — weather-dual-agent-eval: Multi-Agente + Workflow + Evaluación

### Patrones: Multi-Agent Orchestration, Workflow, Evaluation Scoring, Structured Output, Working Memory

```
[Usuario]
    |
    v
[Agente Orquestador]
    |
    v
[Workflow: weather-advice]
    |
    +--→ [Paso 1: Agente Intérprete]
    |         |
    |    [getWeatherByCity]
    |         |
    |         v
    |    WeatherSnapshot + Signals + Summary
    |    (salida estructurada obligatoria)
    |
    +--→ [Paso 2: Agente Recomendador]
    |         |
    |    [recommendClothing] + [Memory]
    |         |
    |         v
    |    Recomendación de ropa
    |
    +--→ [Evaluación: 5 scorers]
              |
              v
         Scores: utility, coherence,
         personalization, prudence, clarity
```

### Arquitectura

- **3 agentes** con responsabilidades separadas
- **1 workflow** que encadena los agentes especialistas
- **5 scorers** que evalúan la calidad de la salida
- Memoria aislada por paso del workflow

### Los tres agentes

#### Agente Orquestador
- **Rol**: Recoge la intención del usuario, extrae ciudad y ventana temporal, lanza el workflow
- **Tools**: Ninguna directamente; invoca el workflow `weather-advice`
- **Memoria**: Sí (conversación con el usuario)
- **No genera recomendaciones** — delega todo

#### Agente Intérprete
- **Rol**: Obtiene datos del clima y los transforma en señales estructuradas
- **Tool**: `getWeatherByCity`
- **Memoria**: No
- **Salida obligatoria** (structured output):

```
{
  weather: WeatherSnapshot,
  signals: RecommendationSignals,
  summary: string  // resumen en texto natural
}
```

- **Instrucción especial**: "Devuelve un resumen meteorológico estructurado. No des consejos de ropa directamente."

#### Agente Recomendador
- **Rol**: Transforma señales meteorológicas en consejos prácticos de vestimenta
- **Tool**: `recommendClothing`
- **Memoria**: Sí (personalización con preferencias)
- **Instrucción especial**: "Convierte señales meteorológicas estructuradas en consejos prácticos de ropa."

### Workflow: encadenamiento secuencial

```
Entrada: { locationName, hoursAhead }
    ↓
[Paso 1: interpret-weather]
  - Ejecuta agente intérprete
  - Genera: { weather, signals, summary }
    ↓
[Paso 2: recommend-clothing]
  - Recibe salida del paso 1
  - Ejecuta agente recomendador
  - Aplica 5 scorers sobre la salida
  - Genera: { recommendation }
    ↓
Salida: { recommendation, scores }
```

### Aislamiento de memoria en el workflow

Cada paso del workflow tiene su propio contexto de memoria:

```
Thread del paso 1: "{thread-original}:interpret-weather"
Thread del paso 2: "{thread-original}:recommend-clothing"
Fallback:          "workflow-{step-suffix}"
```

Esto evita que los pasos contaminen mutuamente su historial.

### Sistema de evaluación: 5 Scorers (LLM-as-Judge + determinista)

Los scorers reciben la entrada del usuario y la salida del agente y devuelven una puntuación binaria (0 o 1). **4 de los 5 usan un LLM como juez** para evaluar matices que un regex no puede capturar. El modelo juez es diferente (y más capaz) que el modelo de los agentes.

| Scorer | Tipo | Modelo juez |
|--------|------|-------------|
| Utility | LLM-as-Judge | gpt-5.2 |
| Clarity | Determinista | — |
| Prudence | LLM-as-Judge | gpt-5.2 |
| Personalization | LLM-as-Judge | gpt-5.2 |
| Weather Coherence | LLM-as-Judge | gpt-5.2 |

#### System prompt del juez

Todos los scorers LLM comparten un system prompt base:

```
Eres un evaluador experto de un chatbot de recomendación de ropa basado en el clima.
El chatbot recibe datos meteorológicos y preferencias del usuario y recomienda qué ponerse.
Evalúas la calidad de sus respuestas en varias dimensiones.
Responde siempre con el esquema JSON solicitado. Sé estricto pero justo.
```

#### 1. Utility (Utilidad) — LLM
- **Pregunta**: ¿La respuesta contiene prendas concretas y accionables que el usuario pueda ponerse?
- **Prompt al juez**: Se le pasa la respuesta del agente y se le pide distinguir entre consejo vago ("abrígate") y prendas concretas ("chaqueta media, pantalón largo, botas")
- **Score**: 1 si hay items accionables, 0 si el consejo es genérico o vacío
- **Ventaja sobre regex**: Detecta variaciones como "ponte algo de manga larga" o "no necesitas más que una camiseta" que un patrón fijo no cubriría

#### 2. Clarity (Claridad) — Determinista
- **Pregunta**: ¿La respuesta es concisa y legible?
- **Cómo**: Verifica que la longitud esté entre 20 y 500 caracteres
- **Score**: 1 si está en rango, 0 si no
- **Por qué es determinista**: La longitud es objetiva y no requiere juicio semántico

#### 3. Prudence (Prudencia) — LLM
- **Pregunta**: Si hay riesgo de lluvia en los datos, ¿la respuesta lo gestiona adecuadamente?
- **Prompt al juez**: Se le pasan los datos meteorológicos (input) y la recomendación (output). Debe evaluar si la probabilidad de precipitación se refleja en alguna forma de protección
- **Reglas del prompt**:
  - Precipitación > 25% → debe haber protección contra lluvia
  - Si el usuario odia paraguas → se acepta chubasquero/capa impermeable como alternativa
  - Sin riesgo de lluvia → score 1 automático
- **Score**: 1 si la lluvia se maneja bien (o no hay lluvia), 0 si se ignora
- **Ventaja sobre regex**: Entiende que "lleva algo que te proteja del agua" es equivalente a "paraguas", y que mencionar "20% de probabilidad de lluvia" sin protección puede ser aceptable

#### 4. Personalization (Personalización) — LLM
- **Pregunta**: Si hay preferencias del usuario en el contexto, ¿la recomendación se adapta a ellas?
- **Prompt al juez**: Se le indica qué tipos de preferencias buscar (sensibilidad al frío, modo de transporte, aversión a paraguas, ciudad habitual, estilo de respuesta) y debe verificar que la salida las refleje
- **Score**: 1 si se adapta (o no hay preferencias), 0 si las ignora
- **Ventaja sobre regex**: Puede valorar si "como vas en bici, abrígate bien por el viento" refleja realmente la preferencia de transporte, no solo si aparece la palabra "bici"

#### 5. Weather Coherence (Coherencia meteorológica) — LLM
- **Pregunta**: ¿La recomendación es coherente con las condiciones meteorológicas?
- **Prompt al juez**: Recibe datos del clima y la recomendación. Busca tanto contradicciones como coherencia positiva:
  - **Contradicciones**: calor + abrigo grueso, frío + shorts, viento fuerte sin protección
  - **Coherencia positiva**: ¿el nivel de capas corresponde a la temperatura? ¿los accesorios son apropiados?
- **Score**: 1 si coherente, 0 si hay contradicción
- **Ventaja sobre regex**: Detecta incoherencias sutiles como recomendar tres capas para 20°C, o no mencionar protección contra viento cuando hay 35 kph

### Patrón LLM-as-Judge: cómo implementarlo

Para replicar en otro framework, cada scorer LLM necesita:

1. **Un modelo juez** (diferente del agente para evitar sesgo de autocomplacencia)
2. **Un system prompt** que defina el rol de evaluador
3. **Un prompt por evaluación** que incluya el input original y el output a evaluar
4. **Un esquema de salida** forzado (structured output / JSON mode):
   ```json
   { "score": 0 | 1, "reasoning": "string" }
   ```
5. **Una función de extracción** que convierta la respuesta del juez en el score numérico final

El modelo juez solo se invoca durante la evaluación, no durante el flujo normal del chat. El coste por evaluación es una llamada LLM adicional por scorer por respuesta evaluada.

### Qué implementar

1. **3 agentes** con system prompts enfocados y tools distintas
2. Un **workflow/pipeline** que encadene los agentes secuencialmente
3. **Structured output** obligatorio para el agente intérprete (esquema forzado)
4. **4 scorers LLM-as-Judge** con un modelo más capaz que el de los agentes (ej: gpt-5.2)
5. **1 scorer determinista** para claridad (longitud)
6. **Memoria aislada** por paso del workflow
7. El orquestador como punto de entrada que **no procesa**, solo delega

---

## Tabla resumen: Patrones por nivel

| # | Agente | Tools | Política | Guardrails | Memoria | Skill | MCP | Traza | Multi-Agente | Eval |
|---|--------|-------|----------|------------|---------|-------|-----|-------|--------------|------|
| 1 | weather-basic | 1 | - | - | - | - | - | - | - | - |
| 2 | weather-policy | 3 | x | x (in+out) | historial | - | - | - | - | - |
| 3 | weather-memory | 1 | - | - | working memory | - | - | - | - | - |
| 4 | weather-skill | 3 | x | - | default | x | - | - | - | - |
| 5 | weather-mcp-trace | MCP | x | - | default | x | x | x | - | - |
| 6 | weather-dual-eval | 2 | x | - | aislada/paso | - | - | - | x | x |

---

## Guía de replicación en otro framework

### Qué necesitas del framework

| Capacidad | Dónde se usa | Alternativa si no existe |
|-----------|-------------|--------------------------|
| **Agente con tools** | Todos los niveles | Cualquier framework lo tiene |
| **System prompt configurable** | Todos los niveles | Parámetro básico de cualquier LLM |
| **Structured output** | Nivel 6 (intérprete) | JSON mode o function calling |
| **Preprocesador de entrada** | Nivel 2 | Middleware antes del agente |
| **Postprocesador de salida** | Nivel 2 | Middleware después del agente |
| **Memoria persistente** | Niveles 3-6 | Base de datos + inyección en contexto |
| **Working memory editable** | Nivel 3 | Documento en BD que el agente puede leer/escribir |
| **Skills/instrucciones modulares** | Niveles 4-5 | Archivo de texto inyectado en el system prompt |
| **MCP client** | Nivel 5 | SDK de MCP estándar (disponible en la mayoría de lenguajes) |
| **Workflow/pipeline** | Nivel 6 | Código secuencial que llama a agentes por turno |
| **Scorers/evaluación** | Nivel 6 | Funciones puras que comparan entrada y salida |

### Orden recomendado de implementación

```
1. weather-basic     → Validar que el framework funciona con una tool
2. weather-policy    → Añadir tools deterministas + guardrails
3. weather-memory    → Implementar working memory persistente
4. weather-skill     → Combinar política + memoria + skill
5. weather-mcp-trace → Añadir MCP y observabilidad
6. weather-dual-eval → Multi-agente + workflow + scoring
```

Cada nivel añade una capacidad nueva sin eliminar las anteriores.

### Nota sobre Skills y MCP

Skills y MCP **no son niveles de complejidad cognitiva**. Son niveles de **madurez de producto**:

- **Skill** = consistencia y reutilización del comportamiento
- **MCP** = desacoplamiento y estandarización del acceso a herramientas
- **Trace** = confianza y depuración

Puedes tener un agente con eval (nivel 6) sin MCP ni skills. Y puedes tener MCP sin multi-agente. Son capacidades ortogonales que este proyecto presenta de forma incremental por claridad pedagógica.
