import type { Agent } from '@mastra/core/agent';
import { chatRoute } from '@mastra/ai-sdk';
import type { MastraScorer } from '@mastra/core/evals';
import { LogLevel } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';
import type { MCPServerBase } from '@mastra/core/mcp';
import type { AnyWorkspace } from '@mastra/core/workspace';
import type { AnyWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { PinoLogger } from '@mastra/loggers';
import { CloudExporter, DefaultExporter, Observability, SensitiveDataFilter } from '@mastra/observability';
import { getStorageUrl } from './config';

type RuntimeServerConfig = {
  [key: string]: any;
  apiRoutes?: any[];
  cors?: any;
  port?: number;
};

export function createMastraRuntime<TAgents extends Record<string, Agent<any, any, any, any>>>(config: {
  appId: string;
  agents: TAgents;
  workflows?: Record<string, AnyWorkflow>;
  scorers?: Record<string, MastraScorer<any, any, any, any>>;
  mcpServers?: Record<string, MCPServerBase>;
  workspace?: AnyWorkspace;
  server?: Omit<NonNullable<RuntimeServerConfig>, 'middleware'>;
  defaultChatOptions?: Record<string, unknown>;
}) {
  return new Mastra({
    agents: config.agents,
    workflows: config.workflows,
    scorers: config.scorers,
    mcpServers: config.mcpServers,
    workspace: config.workspace,
    storage: new LibSQLStore({
      id: `${config.appId}-storage`,
      url: getStorageUrl(config.appId),
    }),
    logger: new PinoLogger({
      name: config.appId,
      level: (process.env.LOG_LEVEL?.toUpperCase() as LogLevel | undefined) ?? LogLevel.INFO,
    }),
    observability: new Observability({
      configs: {
        default: {
          serviceName: config.appId,
          exporters: [new DefaultExporter(), new CloudExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
        },
      },
    }),
    server: {
      ...config.server,
      apiRoutes: [
        chatRoute({ path: '/chat/:agentId', ...(config.defaultChatOptions ? { defaultOptions: config.defaultChatOptions } : {}) }),
        ...(config.server?.apiRoutes ?? []),
      ],
      middleware: async (c, next) => {
        const requestContext = c.get('requestContext');
        const acceptLanguage = c.req.header('accept-language');

        if (acceptLanguage) {
          requestContext.set('accept-language', acceptLanguage);
        }

        await next();
      },
    },
  });
}
