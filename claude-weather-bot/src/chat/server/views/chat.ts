/**
 * Chat Page HTML Template
 */

export function chatPage(): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mortadelo Chat</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css">
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <link rel="stylesheet" href="/static/chat.css">
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen flex flex-col">
  <!-- Header -->
  <header class="border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-semibold text-white">Mortadelo Chat</h1>
      <span class="text-xs text-gray-500">Claude Agent SDK</span>
    </div>
    <div class="flex items-center gap-3">
      <select id="level-select" class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500">
        <option value="">Cargando niveles...</option>
      </select>
      <button id="abort-btn" class="hidden bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors">
        Cancelar
      </button>
    </div>
  </header>

  <!-- Chat Messages -->
  <main id="chat-messages" class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
    <div class="text-center text-gray-500 mt-20">
      <p class="text-4xl mb-4">&#x1f321;</p>
      <p class="text-lg">Elige un nivel y pregunta sobre el tiempo</p>
      <p class="text-sm mt-2">Cada nivel suma capacidades: tools, guardrails, memoria, skills, multi-agente</p>
    </div>
  </main>

  <!-- Input Area -->
  <footer class="border-t border-gray-800 px-6 py-4 shrink-0">
    <form id="chat-form" class="flex gap-3">
      <textarea
        id="chat-input"
        class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-gray-100 placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
        placeholder="Ej: &iquest;Qu&eacute; me pongo hoy en Madrid? (Ctrl+Enter para enviar)"
        rows="2"
      ></textarea>
      <button
        type="submit"
        id="send-btn"
        class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-6 rounded-lg transition-colors font-medium"
      >
        Enviar
      </button>
    </form>
    <p class="text-xs text-gray-600 mt-2 text-center">Cada mensaje es una consulta nueva al agente. Conversaci&oacute;n de un solo turno.</p>
  </footer>

  <script src="/static/chat.js"></script>
</body>
</html>`;
}
