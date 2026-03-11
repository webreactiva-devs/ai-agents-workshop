import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { MCPClient } from '@mastra/mcp';
import { createWeatherInstructions, getDefaultModel, getMcpServerUrl, weatherRequestContextSchema } from '@agents-mastra/weather-common';

const mcp = new MCPClient({
  servers: {
    weather: {
      url: new URL(getMcpServerUrl()),
    },
  },
});

const tools = await mcp.listTools();

export const weatherMcpTraceAgent = new Agent({
  id: 'weather-mcp-trace-agent',
  name: 'Weather MCP Trace Agent',
  description: 'Weather chatbot that uses an MCP weather server and emits rich traces.',
  model: getDefaultModel(),
  instructions: createWeatherInstructions({
    includePolicy: true,
    includeMemory: true,
    mentionSkill: true,
    mentionMcp: true,
    mentionTrace: true,
  }),
  requestContextSchema: weatherRequestContextSchema,
  tools,
  memory: new Memory(),
});
