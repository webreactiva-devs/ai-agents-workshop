import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import http from 'node:http';
import { z } from 'zod';
import { tracedTools } from './traced-tools.js';

const server = new McpServer({
  name: 'weather-mcp-server',
  version: '1.0.0',
});

// Register tools
server.tool(
  'get-weather',
  tracedTools['get-weather'].description,
  {
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationName: z.string().min(1),
    hoursAhead: z.number().int().min(1).max(24).default(6),
  },
  async (args) => {
    const result = await tracedTools['get-weather'].execute(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  'get-weather-by-city',
  tracedTools['get-weather-by-city'].description,
  {
    locationName: z.string().min(1),
    hoursAhead: z.number().int().min(1).max(24).default(6),
  },
  async (args) => {
    const result = await tracedTools['get-weather-by-city'].execute(args);
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  },
);

// Start SSE HTTP server
const port = Number(process.env.MCP_PORT ?? 8788);

const transports: Record<string, SSEServerTransport> = {};

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://127.0.0.1:${port}`);

  if (url.pathname === '/sse') {
    const transport = new SSEServerTransport('/message', res);
    transports[transport.sessionId] = transport;
    await server.connect(transport);

    res.on('close', () => {
      delete transports[transport.sessionId];
    });
  } else if (url.pathname === '/message') {
    const sessionId = url.searchParams.get('sessionId');
    if (!sessionId || !transports[sessionId]) {
      res.writeHead(404);
      res.end('Session not found');
      return;
    }
    await transports[sessionId].handlePostMessage(req, res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

httpServer.listen(port, () => {
  console.log(`Weather MCP server listening on http://127.0.0.1:${port}/sse`);
});
