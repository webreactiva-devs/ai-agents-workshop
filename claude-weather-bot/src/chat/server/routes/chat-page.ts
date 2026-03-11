/**
 * Chat Page Route
 * GET / - Serves the chat HTML page
 */

import { Hono } from 'hono';
import { chatPage } from '../views/chat.js';

const chatPageRoute = new Hono();

chatPageRoute.get('/', (c) => {
  return c.html(chatPage());
});

export default chatPageRoute;
