import { useCallback, useMemo, useState } from 'react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { Thread } from '@assistant-ui/react-ui';
import { RotateCcw, Sparkles } from 'lucide-react';
import '@assistant-ui/react-ui/styles/index.css';

type ChatbotOption = {
  id: string;
  label: string;
  path: string;
  note: string;
};

const THREAD_KEY = 'weather-chat-demo.thread';
const RESOURCE_KEY = 'weather-chat-demo.resource';

const CHATBOTS: ChatbotOption[] = [
  {
    id: 'weather-basic-agent',
    label: 'Basic',
    path: 'http://localhost:4111/chat/weather-basic-agent',
    note: 'Single weather tool, no memory or policy layer.',
  },
  {
    id: 'weather-policy-agent',
    label: 'Policy',
    path: 'http://localhost:4111/chat/weather-policy-agent',
    note: 'Adds deterministic weather signal policy.',
  },
  {
    id: 'weather-memory-agent',
    label: 'Memory',
    path: 'http://localhost:4111/chat/weather-memory-agent',
    note: 'Remembers user preferences across threads.',
  },
  {
    id: 'weather-skill-agent',
    label: 'Skill',
    path: 'http://localhost:4111/chat/weather-skill-agent',
    note: 'Uses the dress-advisor workspace skill.',
  },
  {
    id: 'weather-mcp-trace-agent',
    label: 'MCP + Trace',
    path: 'http://localhost:4111/chat/weather-mcp-trace-agent',
    note: 'Gets weather through MCP and exposes richer traces.',
  },
  {
    id: 'weather-orchestrator-agent',
    label: 'Dual Agent',
    path: 'http://localhost:4111/chat/weather-orchestrator-agent',
    note: 'Main orchestrator agent that drives the dual-agent workflow.',
  },
];

function getStoredId(key: string, prefix: string) {
  const existing = window.localStorage.getItem(key);

  if (existing) {
    return existing;
  }

  const created = `${prefix}-${crypto.randomUUID()}`;
  window.localStorage.setItem(key, created);
  return created;
}

function replaceStoredThread() {
  const nextThread = `thread-${crypto.randomUUID()}`;
  window.localStorage.setItem(THREAD_KEY, nextThread);
  return nextThread;
}

function DemoThread({ endpoint, threadSeed }: { endpoint: string; threadSeed: string }) {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: endpoint,
      prepareSendMessagesRequest: ({ body, id, messages, trigger, messageId, requestMetadata }) => ({
        body: {
          ...body,
          id,
          messages,
          trigger,
          messageId,
          metadata: requestMetadata,
          memory: {
            thread: getStoredId(THREAD_KEY, 'thread'),
            resource: getStoredId(RESOURCE_KEY, 'demo'),
          },
        },
      }),
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread
        key={threadSeed}
        assistantAvatar={{ fallback: 'WX' }}
        welcome={{
          message: 'Pick a chatbot from the toolbar and ask for weather-aware clothing advice in any language.',
          suggestions: [
            { prompt: 'What should I wear in Madrid this afternoon?' },
            { prompt: 'Voy en bici y odio los paraguas. ¿Qué me pongo hoy en Bilbao?' },
            { prompt: 'Pack me for a windy, rainy day in Amsterdam.' },
          ],
        }}
        strings={{
          composer: {
            input: {
              placeholder: 'Ask for weather or clothing advice...',
            },
          },
        }}
      />
    </AssistantRuntimeProvider>
  );
}

export default function App() {
  const initialBot = useMemo(
    () => CHATBOTS.find((bot) => bot.id === 'weather-skill-agent') ?? CHATBOTS[0],
    [],
  );

  const [selectedBotId, setSelectedBotId] = useState(initialBot.id);
  const [endpointDraft, setEndpointDraft] = useState(initialBot.path);
  const [activeEndpoint, setActiveEndpoint] = useState(initialBot.path);
  const [threadSeed, setThreadSeed] = useState(() => getStoredId(THREAD_KEY, 'thread'));

  const selectedBot = useMemo(
    () => CHATBOTS.find((bot) => bot.id === selectedBotId) ?? CHATBOTS[0],
    [selectedBotId],
  );

  const handleReset = useCallback(() => {
    setThreadSeed(replaceStoredThread());
  }, []);

  const handleBotChange = useCallback((nextBotId: string) => {
    const nextBot = CHATBOTS.find((bot) => bot.id === nextBotId);

    if (!nextBot) {
      return;
    }

    setSelectedBotId(nextBot.id);
    setEndpointDraft(nextBot.path);
    setActiveEndpoint(nextBot.path);
    setThreadSeed(replaceStoredThread());
  }, []);

  const commitEndpoint = useCallback(() => {
    const nextEndpoint = endpointDraft.trim() || selectedBot.path;
    setActiveEndpoint(nextEndpoint);
  }, [endpointDraft, selectedBot.path]);

  return (
    <main className="demo-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <h1>Weather Chat Demo</h1>
        </div>

        <div className="meta-strip">
          <div className="meta-card">
            <Sparkles size={16} />
            <span>Switch chatbot live from the UI</span>
          </div>
          <div className="meta-card">
            <span className="status-dot" />
            <span>{selectedBot.note}</span>
          </div>
        </div>

        <p className="signature">
          Made with 🧡 by{' '}
          <a href="https://webreactiva.com" target="_blank" rel="noreferrer">
            Web Reactiva
          </a>
        </p>
      </section>

      <section className="chat-panel">
        <div className="chat-toolbar chat-toolbar-grid">
          <label className="toolbar-field">
            <span className="toolbar-label">Chatbot</span>
            <select value={selectedBotId} onChange={(event) => handleBotChange(event.target.value)}>
              {CHATBOTS.map((bot) => (
                <option key={bot.id} value={bot.id}>
                  {bot.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar-field toolbar-field-wide">
            <span className="toolbar-label">Endpoint</span>
            <input
              value={endpointDraft}
              onChange={(event) => setEndpointDraft(event.target.value)}
              onBlur={commitEndpoint}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  commitEndpoint();
                }
              }}
            />
          </label>

          <div className="toolbar-meta">
            <p className="toolbar-label">Thread</p>
            <p className="toolbar-id">{threadSeed}</p>
          </div>

          <button className="reset-button" type="button" onClick={handleReset}>
            <RotateCcw size={16} />
            New thread
          </button>
        </div>

        <DemoThread endpoint={activeEndpoint} threadSeed={`${selectedBot.id}:${threadSeed}:${activeEndpoint}`} />
      </section>
    </main>
  );
}
