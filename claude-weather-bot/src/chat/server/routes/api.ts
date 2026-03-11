/**
 * API Routes
 * POST /api/chat - SSE streaming chat
 * GET /api/levels - Available agent levels
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { chatQueryStream, CHAT_LEVELS } from '../../query-stream.js';

const api = new Hono();

// Concurrency guard - single user tool
let isRunning = false;
let currentAbortController: AbortController | null = null;

/**
 * GET /levels - Returns available levels
 */
api.get('/levels', (c) => {
  const levels = Object.entries(CHAT_LEVELS).map(([id, description]) => ({
    id,
    description,
  }));
  return c.json({ levels });
});

/**
 * POST /chat - SSE streaming endpoint
 */
api.post('/chat', async (c) => {
  const body = await c.req.json<{ message: string; level: string }>();
  const { message, level } = body;

  if (!message?.trim()) {
    return c.json({ error: 'Message is required' }, 400);
  }

  if (!CHAT_LEVELS[level]) {
    return c.json({ error: `Invalid level: ${level}` }, 400);
  }

  if (isRunning) {
    return c.json({ error: 'An agent is already running. Wait for it to finish or abort it.' }, 429);
  }

  isRunning = true;
  currentAbortController = new AbortController();
  const abortController = currentAbortController;

  return streamSSE(c, async (stream) => {
    // Heartbeat interval to prevent timeout
    const heartbeat = setInterval(() => {
      stream.writeSSE({ event: 'heartbeat', data: '' }).catch(() => {});
    }, 15000);

    try {
      for await (const event of chatQueryStream({
        message,
        level,
        abortController,
      })) {
        if (abortController.signal.aborted) break;

        await stream.writeSSE({
          event: event.type,
          data: event.data,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      await stream.writeSSE({ event: 'error', data: errorMsg });
    } finally {
      clearInterval(heartbeat);
      isRunning = false;
      currentAbortController = null;
    }
  });
});

/**
 * POST /abort - Abort running agent
 */
api.post('/abort', (c) => {
  if (currentAbortController) {
    currentAbortController.abort();
    isRunning = false;
    currentAbortController = null;
    return c.json({ status: 'aborted' });
  }
  return c.json({ status: 'nothing_running' });
});

export default api;
