# Claude Weather Bot

Bot meteorologico construido con el [Claude Agent SDK](https://github.com/anthropic-ai/claude-agent-sdk) de Anthropic. El agente consulta datos del tiempo en tiempo real (via Open-Meteo) y recomienda ropa adecuada para la ocasion.

El proyecto esta organizado en **6 niveles progresivos** que muestran como evolucionar un agente simple hasta una arquitectura multi-agente con guardrails, memoria, skills, MCP y evaluaciones automaticas.

> Masterclass de **Web Reactiva Premium**.

## Niveles

| Nivel | Descripcion |
|-------|-------------|
| `level1` | Agente basico con una herramienta (`getWeatherByCity`) |
| `level2` | Politicas, guardrails de entrada/salida y juez LLM opcional |
| `level3` | Memoria persistente en ficheros (preferencias del usuario) |
| `level4` | Skills desde Markdown (`dress-advisor.md`) |
| `level5` | Servidor MCP externo + trazas de herramientas |
| `level6` | Orquestador multi-agente (interpreter + recommender) con evals via OpenAI |

## Requisitos previos

- Node.js >= 18
- npm
- Clave de API de Anthropic (`ANTHROPIC_API_KEY`)
- (Opcional) Clave de API de OpenAI para las evaluaciones del nivel 6

## Instalacion

```bash
# Clonar el repositorio e ir a la carpeta del proyecto
cd claude-weather-bot

# Instalar dependencias
npm install

# Copiar el fichero de variables de entorno y completar las claves
cp .env.example .env
```

## Variables de entorno

Edita el fichero `.env` con tus valores:

| Variable | Descripcion |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic (obligatoria) |
| `OPENAI_API_KEY` | Clave de la API de OpenAI (solo para evals en level6) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Token OAuth de Claude Code (opcional) |
| `LOG_LEVEL` | Nivel de log: `info`, `warn`, `error` |
| `MCP_SERVER_URL` | URL del servidor MCP (para level5) |
| `MCP_PORT` | Puerto del servidor MCP (por defecto `8788`) |
| `OPEN_METEO_BASE_URL` | URL base de Open-Meteo (por defecto `https://api.open-meteo.com/v1/forecast`) |

## Uso

### Ejecutar un nivel concreto

```bash
# Nivel 1 - Agente basico
npm run level1

# Nivel 2 - Con guardrails
npm run level2

# Nivel 3 - Con memoria
npm run level3

# Nivel 4 - Con skills
npm run level4

# Nivel 5 - Con MCP externo y trazas
npm run level5

# Nivel 6 - Multi-agente con evals
npm run level6
```

Cada comando acepta un prompt personalizado como argumento. Si no se indica ninguno, se usa el prompt por defecto: *"Que me pongo hoy en Madrid?"*

```bash
npm run level1 -- "What should I wear in London tomorrow?"
```

### Servidor MCP (para level5)

En una terminal aparte, arranca el servidor MCP antes de ejecutar el nivel 5:

```bash
npm run mcp-server
```

### Servidor de chat web

Tambien puedes interactuar con el agente a traves de un servidor web:

```bash
npm run chat

# O en un puerto personalizado
npm run chat -- --port=8080
```

## Estructura del proyecto

```
claude-weather-bot/
├── src/
│   ├── cli.ts                 # Punto de entrada CLI
│   ├── levels/                # Implementacion de cada nivel
│   ├── common/                # Herramientas, politicas, guardrails, evals, logger
│   └── chat/                  # Servidor de chat web (Hono)
├── mcp-server/                # Servidor MCP independiente
├── scripts/                   # Script de arranque del chat
├── skills/                    # Skills en formato Markdown
├── logs/                      # Logs JSONL generados en ejecucion
├── memory/                    # Ficheros de memoria del agente
├── .env.example               # Plantilla de variables de entorno
├── package.json
└── tsconfig.json
```

## Tecnologias

- [Claude Agent SDK](https://github.com/anthropic-ai/claude-agent-sdk) — SDK oficial de agentes de Anthropic
- [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) — protocolo de herramientas externas
- [Open-Meteo](https://open-meteo.com/) — API de datos meteorologicos (sin clave necesaria)
- [Hono](https://hono.dev/) — framework web ligero para el servidor de chat
- [Zod](https://zod.dev/) — validacion de esquemas
- TypeScript + tsx
