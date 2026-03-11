import {
  clarityScorer,
  createMastraRuntime,
  personalizationScorer,
  prudenceScorer,
  utilityScorer,
  weatherCoherenceScorer,
} from '@agents-mastra/weather-common';
import { weatherInterpreterAgent } from './agents/weather-interpreter-agent';
import { weatherOrchestratorAgent } from './agents/weather-orchestrator-agent';
import { weatherRecommenderAgent } from './agents/weather-recommender-agent';
import { weatherAdviceWorkflow } from './workflows/weather-advice-workflow';

export const mastra = createMastraRuntime({
  appId: 'weather-dual-agent-eval',
  agents: {
    weatherOrchestratorAgent,
    weatherInterpreterAgent,
    weatherRecommenderAgent,
  },
  workflows: {
    weatherAdviceWorkflow,
  },
  scorers: {
    utilityScorer,
    weatherCoherenceScorer,
    personalizationScorer,
    prudenceScorer,
    clarityScorer,
  },
  server: {
    cors: { origin: '*' },
  },
});
