import { startHttpServer } from './server';

const port = Number(process.env.MCP_PORT ?? 8788);

startHttpServer(port);
