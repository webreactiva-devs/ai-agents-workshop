# Agentes de IA: componentes y arquitectura

> Masterclass en [Web Reactiva Premium](https://webreactiva.com)

![](slides/assets/agents-1.jpg)

> Para contar nuestra historia hemos usado los tebeos de Francisco Ibáñez como homejane a este gran dibujante autor, entre otros, del gran Mortadelo y Filemón.

## Sobre esta masterclass

Aprende a crear **agentes de IA** desde cero. Desde un LLM aumentado con herramientas hasta arquitecturas multi-agente con evaluación, pasando por políticas, memoria, skills y MCP.

## Contenido

- Qué es un agente y qué no lo es
- Conceptos clave: tools, guardrails, memory, skills, MCP
- Qué es un Agent Harness y por qué lo necesitas
- 6 niveles de arquitectura progresiva con ejemplos reales
- Agentes con Mastra (TypeScript) y con OpenCode (Markdown)
- Evaluación y observabilidad de agentes

## Los 6 niveles

| Nivel | Arquitectura | Descripción |
|-------|-------------|-------------|
| 1 | Augmented LLM | Agente básico con herramientas (tools) |
| 2 | Policy + Guardrails | Control determinista del comportamiento |
| 3 | Memory | Persistencia de contexto entre conversaciones |
| 4 | Skills | Capacidades modulares reutilizables |
| 5 | MCP + Observabilidad | Servidor MCP con trazas de herramientas |
| 6 | Multi-Agente + Evals | Orquestador con múltiples agentes y evaluación |

## Estructura del proyecto

- **`mastra-weather-bot/`** — Monorepo con los 6 niveles de agente construidos con [Mastra](https://mastra.ai). Incluye apps progresivas (`weather-basic`, `weather-policy`, `weather-memory`, `weather-skill`, `weather-mcp-trace`, `weather-dual-agent-eval`), paquetes compartidos y un servidor MCP.
- **`claude-weather-bot/`** — Versión de los agentes usando Claude Code con agentes definidos en Markdown, skills y MCP server.
- **`slides/`** — Presentación de la masterclass en formato [Marp](https://marp.app/).
- **`docs/`** — Documentación de referencia: [arquitectura genérica](docs/arquitectura-agentes-generica.md), [diagramas](docs/diagramas-arquitectura.md), [guardrails](docs/guardrails.md), [policy](docs/policy.md), [evals/scorers](docs/evals-scorers.md).

## Slides

```
slides/agentes-ia.md
slides/agentes-ia.html
```

Hecho con 🧡 para la Comunidad Malandriner
