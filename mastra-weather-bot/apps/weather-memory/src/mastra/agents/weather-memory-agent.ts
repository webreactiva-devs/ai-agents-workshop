import { Agent } from '@mastra/core/agent';
import type { OutputProcessor } from '@mastra/core/processors';
import { Memory } from '@mastra/memory';
import {
  createWeatherInstructions,
  getDefaultModel,
  getWeatherByCityTool,
  weatherRequestContextSchema,
} from '@agents-mastra/weather-common';

const workingMemoryLogger: OutputProcessor = {
  id: 'working-memory-logger',
  async processOutputStep({ messages, toolCalls }) {
    const wmCall = toolCalls?.find(tc => tc.toolName === 'updateWorkingMemory');
    if (wmCall) {
      console.log('[WORKING MEMORY] Saving →', JSON.stringify(wmCall.args, null, 2));
    }
    return messages;
  },
};

export const weatherMemoryAgent = new Agent({
  id: 'weather-memory-agent',
  name: 'Weather Memory Agent',
  description: 'Weather chatbot with persistent memory for user preferences.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: false,
    includeMemory: true,
    mentionSkill: false,
    mentionMcp: false,
    mentionTrace: false,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools: {
    getWeatherByCityTool,
  },
  outputProcessors: [workingMemoryLogger],
  memory: new Memory({
    options: {
      lastMessages: 20,
      workingMemory: {
        enabled: true,
        template: `# Preferencias del usuario

## Ubicación
- Ciudad habitual:
- Otras ciudades frecuentes:

## Transporte
- Medio de transporte habitual: [e.g., andando, bici, coche, transporte público]

## Sensibilidad al clima
- Sensibilidad al frío: [alta/normal/baja]
- Aversión a paraguas: [sí/no]

## Estilo
- Preferencias de ropa:
- Notas adicionales:
`,
      },
    },
  }),
});
