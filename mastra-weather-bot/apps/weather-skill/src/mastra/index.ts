import path from 'node:path';
import { createMastraRuntime } from '@agents-mastra/weather-common';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import { weatherSkillAgent } from './agents/weather-skill-agent';

const workspacePath = path.resolve(new URL('.', import.meta.url).pathname, '../../workspace');

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: workspacePath }),
  skills: ['/skills'],
});

export const mastra = createMastraRuntime({
  appId: 'weather-skill',
  agents: { weatherSkillAgent },
  workspace,
  server: {
    cors: { origin: '*' },
  },
});
