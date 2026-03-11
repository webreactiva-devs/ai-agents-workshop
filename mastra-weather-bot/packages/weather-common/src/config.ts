export function getDefaultModel(): string {
  return process.env.MODEL ?? 'openai/gpt-5-mini';
}

export function getStorageUrl(appId: string): string {
  return process.env.STORAGE_URL ?? `file:./${appId}.db`;
}

export function getMcpServerUrl(): string {
  return process.env.MCP_SERVER_URL ?? 'http://127.0.0.1:8788/sse';
}
