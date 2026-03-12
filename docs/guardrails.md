# Guardrails (Input & Output Processors)

Los guardrails son procesadores que interceptan los mensajes **antes** de que lleguen al agente (input) y **despues** de que el agente genera una respuesta (output). Permiten validar, filtrar y corregir el comportamiento del agente de forma determinista.

**Archivo fuente:** `packages/weather-common/src/guardrails.ts`

**App que los usa:** `apps/weather-policy/`

---

## Input Guardrail: `weatherInputGuardrail`

**Tipo:** `InputProcessor`

### Que hace

Analiza el ultimo mensaje del usuario y verifica que el tema sea relevante para el dominio del bot (clima, ropa, preferencias). Si el mensaje no esta relacionado, aborta la ejecucion con un mensaje amigable.

### Cuando se lanza

Se ejecuta **antes de cada llamada al modelo LLM**. Cada vez que el usuario envia un mensaje, el guardrail lo inspecciona.

### Logica de deteccion

Usa expresiones regulares bilingues (ES + EN) para detectar cinco categorias de temas validos:

| Categoria | Ejemplos de patrones |
|---|---|
| **Clima** | `clima`, `temperatura`, `lluvia`, `weather`, `rain`, `forecast` |
| **Ropa** | `ropa`, `chaqueta`, `paraguas`, `wear`, `jacket`, `umbrella` |
| **Ubicacion/Tiempo** | `hoy`, `manana`, `ciudad`, `tomorrow`, `city` |
| **Saludos** | `hola`, `hello`, `gracias`, `thank` |
| **Preferencias** | `prefiero`, `friolero`, `bici`, `bike`, `caminar` |

### Comportamiento

- Si **ninguna** categoria hace match → `abort()` con mensaje: *"Solo puedo ayudarte con recomendaciones de ropa basadas en el clima."*
- Si **cualquiera** hace match → deja pasar los mensajes sin modificar.
- Si no hay mensaje de usuario → deja pasar (no aborta).

### Ejemplo de bloqueo

```
Usuario: "Cual es la capital de Francia?"
→ abort() — no matchea ninguna categoria
```

### Ejemplo permitido

```
Usuario: "Que me pongo para salir hoy en Valladolid?"
→ pasa — matchea "pongo" (ropa) y "hoy" (tiempo)
```

---

## Output Guardrail: `weatherOutputGuardrail`

**Tipo:** `OutputProcessor`

### Que hace

Valida que la recomendacion de ropa generada por el agente sea **coherente** con los datos meteorologicos presentes en la conversacion. Si detecta una contradiccion, aborta con `retry: true` para que el agente lo intente de nuevo.

### Cuando se lanza

Se ejecuta **despues de cada paso de generacion de texto** del agente. Solo analiza pasos que producen texto (no pasos de herramientas).

### Reglas de validacion

El guardrail revisa tres tipos de contradicciones:

#### 1. Calor + Ropa de abrigo

```
Contexto caliente: thermalLevel "hot", temperatura >27C, "calor"
+
Respuesta con: "abrigo", "coat", "bufanda", "scarf", "grueso"
→ abort("La respuesta recomienda ropa de abrigo cuando hace calor...")
```

#### 2. Frio + Ropa ligera

```
Contexto frio: thermalLevel "cold", temperatura <8C, "frio"
+
Respuesta con: "shorts", "pantalon corto", "ligero", "tirantes"
→ abort("La respuesta recomienda ropa ligera cuando hace frio...")
```

#### 3. Lluvia probable + Sin proteccion

```
Contexto lluvioso: rainLevel "likely", precipitacion >50%, "lluvia"
+
Respuesta SIN: "paraguas", "umbrella", "impermeable", "waterproof", "chubasquero"
→ abort("Hay alta probabilidad de lluvia pero no menciona proteccion...")
```

### Mecanismo de reintento

- Todos los aborts usan `{ retry: true }`, lo que indica a Mastra que regenere la respuesta.
- Si `retryCount > 0`, el guardrail **no vuelve a validar** (evita bucles infinitos).
- El agente se configura con `maxProcessorRetries: 1`, asi que como maximo hay **un reintento**.

---

## Como se integran en el agente

```typescript
// apps/weather-policy/src/mastra/agents/weather-policy-agent.ts
export const weatherPolicyAgent = new Agent({
  // ...
  inputProcessors: [weatherInputGuardrail],   // Antes del LLM
  outputProcessors: [weatherOutputGuardrail],  // Despues del LLM
  maxProcessorRetries: 1,                      // Maximo 1 reintento
});
```

### Flujo completo

```
Usuario envia mensaje
       │
       ▼
┌─────────────────────┐
│  Input Guardrail    │──── tema invalido ──→ abort() → error al usuario
│  (filtro de tema)   │
└────────┬────────────┘
         │ tema valido
         ▼
┌─────────────────────┐
│  Agente LLM         │
│  (tools + generate) │
└────────┬────────────┘
         │ respuesta generada
         ▼
┌─────────────────────┐
│  Output Guardrail   │──── contradiccion ──→ abort(retry) → regenerar (1 vez)
│  (coherencia)       │
└────────┬────────────┘
         │ coherente
         ▼
    Respuesta al usuario
```
