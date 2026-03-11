/**
 * Chat Server CLI
 * Entry point for the agent chat web server
 *
 * Usage:
 *   npm run chat
 *   npm run chat -- --port=8080
 */

import { startServer } from '../src/chat/server/index.js';

// Parse command line arguments
const args = process.argv.slice(2);
let port: number | undefined;

for (const arg of args) {
  if (arg.startsWith('--port=')) {
    port = parseInt(arg.slice(7), 10);
    if (isNaN(port)) {
      console.error('Error: Invalid port number');
      process.exit(1);
    }
  }
}

// Start the server
startServer({ port }).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
