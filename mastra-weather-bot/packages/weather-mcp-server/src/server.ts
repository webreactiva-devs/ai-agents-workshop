import http from 'node:http';
import { MCPServer } from '@mastra/mcp';
import { tracedGetWeatherTool, tracedGetWeatherByCityTool } from './traced-tools';

export const server = new MCPServer({
  id: 'weather-mcp-server',
  name: 'Weather MCP Server',
  version: '1.0.0',
  description:
    'Exposes weather tools backed by Open-Meteo. Every tool call is traced to mcp-tool-trace.jsonl.',
  instructions:
    'Use get-weather-by-city to retrieve weather by city name, or get-weather for explicit lat/lon coordinates.',
  tools: {
    getWeatherTool: tracedGetWeatherTool,
    getWeatherByCityTool: tracedGetWeatherByCityTool,
  },
});

export function startHttpServer(port: number) {
  const httpServer = http.createServer(async (req, res) => {
    await server.startSSE({
      url: new URL(req.url || '', `http://127.0.0.1:${port}`),
      ssePath: '/sse',
      messagePath: '/message',
      req,
      res,
    });
  });

  httpServer.listen(port, () => {
    console.log(`Weather MCP server listening on http://127.0.0.1:${port}/sse`);
  });

  return httpServer;
}
