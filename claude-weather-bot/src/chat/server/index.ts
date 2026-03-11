/**
 * Chat Server
 * Hono-based web chat interface for Agent SDK levels
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import chatPageRoute from './routes/chat-page.js';
import api from './routes/api.js';

const app = new Hono();

// Static files
app.use('/static/*', serveStatic({
  root: './src/chat/server/',
  rewriteRequestPath: (path) => path.replace('/static', '/static'),
}));

// Routes
app.route('/', chatPageRoute);
app.route('/api', api);

export { app };

export interface ServerOptions {
  port?: number;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const port = options.port || parseInt(process.env['CHAT_SERVER_PORT'] || '3500', 10);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Mortadelo Chat                                              ║
║                                                               ║
║   http://localhost:${port}                                      ║
║                                                               ║
║   Rutas:                                                      ║
║   • /              Interfaz de chat                           ║
║   • /api/levels    Niveles disponibles                        ║
║   • /api/chat      Chat SSE streaming                         ║
║   • /api/abort     Cancelar agente                            ║
║                                                               ║
║   Pulsa Ctrl+C para parar                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  serve({
    fetch: app.fetch,
    port,
  });
}
