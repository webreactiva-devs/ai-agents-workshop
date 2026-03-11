# Mastra Weather Bot

Proyecto del taller **AI Agents Workshop** de [Web Reactiva Premium](https://webreactiva.com).

Un monorepo con varios chatbots de clima construidos con [Mastra](https://mastra.ai) que demuestran, paso a paso, cómo evolucionar un agente de IA: desde un bot basico hasta una arquitectura multi-agente con evaluacion automatica.

Todos los bots consultan la API abierta de [Open-Meteo](https://open-meteo.com) para obtener datos meteorologicos reales y ofrecen recomendaciones de vestimenta adaptadas al clima.

## Estructura del proyecto

```
mastra-weather-bot/
├── packages/
│   ├── weather-common        # Logica compartida: cliente Open-Meteo, tools, policy, guardrails, scorers
│   └── weather-mcp-server    # Servidor MCP que expone las herramientas de clima
├── apps/
│   ├── weather-basic          # 1. Agente basico con una sola tool
│   ├── weather-policy         # 2. Agente con reglas de policy y guardrails de entrada/salida
│   ├── weather-memory         # 3. Agente con memoria persistente (working memory)
│   ├── weather-skill          # 4. Agente con workspace skills reutilizables
│   ├── weather-mcp-trace      # 5. Agente conectado a un servidor MCP con trazabilidad
│   ├── weather-dual-agent-eval# 6. Multi-agente con workflow y evaluacion con scorers
│   ├── weather-chat-demo      # Frontend React con assistant-ui para probar los agentes
│   └── mastra-scouter         # Utilidad de visualizacion de trazas
└── scripts/
    └── dev-mcp.mjs            # Script auxiliar para arrancar el servidor MCP en desarrollo
```

## Requisitos previos

- **Node.js** >= 20
- **npm** >= 10

## Variables de entorno

Crea un archivo `.env` en la raiz del monorepo con las siguientes variables:

```env
# Obligatoria: clave de API de OpenAI
OPENAI_API_KEY=sk-...

# Opcional: modelo a utilizar (por defecto: openai/gpt-5-mini)
MODEL=openai/gpt-5-mini

# Opcional: nivel de log (por defecto: INFO)
LOG_LEVEL=INFO

# Opcional: URL del servidor MCP (por defecto: http://127.0.0.1:8788/sse)
MCP_SERVER_URL=http://127.0.0.1:8788/sse

# Opcional: URL base de Open-Meteo (por defecto: https://api.open-meteo.com/v1/forecast)
OPEN_METEO_BASE_URL=https://api.open-meteo.com/v1/forecast
```

## Instalacion

```bash
npm install
```

## Ejecucion

Cada aplicacion se lanza con un script desde la raiz. Mastra arranca un servidor con **Mastra Studio**, una interfaz web para interactuar con los agentes.

```bash
# Agente basico
npm run dev:basic

# Agente con policy y guardrails
npm run dev:policy

# Agente con memoria persistente
npm run dev:memory

# Agente con workspace skills
npm run dev:skill

# Agente con MCP y trazabilidad (requiere levantar primero el servidor MCP)
npm run dev:mcp-server   # en una terminal
npm run dev:mcp-trace    # en otra terminal

# Multi-agente con workflow y evaluacion
npm run dev:dual-agent-eval

# Frontend de chat (React + Vite)
npm run dev:chat-demo

# Visualizador de trazas
npm run dev:scouter
```

## Escalera de madurez de agentes

El taller sigue una progresion incremental:

| Nivel | App | Que se aprende |
|-------|-----|----------------|
| 1 | `weather-basic` | Agente minimo con una tool y un modelo LLM |
| 2 | `weather-policy` | Reglas deterministas (policy), guardrails de entrada y salida |
| 3 | `weather-memory` | Memoria persistente con working memory para preferencias del usuario |
| 4 | `weather-skill` | Skills reutilizables como workspace skill |
| 5 | `weather-mcp-trace` | Integracion con servidor MCP y observabilidad con trazas |
| 6 | `weather-dual-agent-eval` | Orquestacion multi-agente con workflow y evaluacion con scorers |

## Tecnologias principales

- [Mastra](https://mastra.ai) - Framework para agentes de IA en TypeScript
- [Open-Meteo](https://open-meteo.com) - API meteorologica abierta (no requiere API key)
- [OpenAI](https://openai.com) - Proveedor del modelo LLM
- [assistant-ui](https://github.com/assistant-ui/assistant-ui) - Componentes React para el chat demo
