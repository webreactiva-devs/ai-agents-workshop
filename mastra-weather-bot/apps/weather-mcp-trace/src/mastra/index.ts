import path from 'node:path';
import { createMastraRuntime } from '@agents-mastra/weather-common';
import { server as weatherMcpServer } from '@agents-mastra/weather-mcp-server/server';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { weatherMcpTraceAgent } from './agents/weather-mcp-trace-agent';

const workspacePath = path.resolve(new URL('.', import.meta.url).pathname, '../../workspace');

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: workspacePath }),
  skills: ['/skills'],
});

export const mastra = createMastraRuntime({
  appId: 'weather-mcp-trace',
  agents: { weatherMcpTraceAgent },
  mcpServers: { weatherMcpServer },
  workspace,
  server: {
    cors: { origin: '*' },
  },
});
