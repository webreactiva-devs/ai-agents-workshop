const projectList = document.querySelector('#project-list');
const traceList = document.querySelector('#trace-list');
const traceCount = document.querySelector('#trace-count');
const selectionTitle = document.querySelector('#selection-title');
const detailSummary = document.querySelector('#detail-summary');
const spanTree = document.querySelector('#span-tree');
const workflowList = document.querySelector('#workflow-list');
const memorySection = document.querySelector('#memory-section');
const memoryList = document.querySelector('#memory-list');
const refreshMemoryButton = document.querySelector('#refresh-memory');
const refreshProjectsButton = document.querySelector('#refresh-projects');

let state = {
  projects: [],
  selectedProjectId: null,
  traces: [],
  selectedTraceId: null,
};

refreshProjectsButton.addEventListener('click', () => {
  void loadProjects(true);
});

refreshMemoryButton.addEventListener('click', () => {
  if (state.selectedProjectId) void loadMemory(state.selectedProjectId);
});

function formatDate(value) {
  if (!value) return 'sin fecha';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
}

function formatDuration(value) {
  if (value == null) return 'en curso';
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatTokenValue(value) {
  if (value == null) return 'n/d';
  return new Intl.NumberFormat('es-ES').format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function spanClass(spanType) {
  if (spanType.includes('workflow')) return 'workflow';
  if (spanType.includes('tool')) return 'tool';
  if (spanType.includes('model_chunk')) return 'chunk';
  if (spanType.includes('model')) return 'model';
  if (spanType.includes('agent')) return 'agent';
  return 'default';
}

async function requestJson(path) {
  const response = await fetch(path);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

async function loadProjects(keepSelection = false) {
  const payload = await requestJson('/api/projects');
  state.projects = payload.projects;

  if (!keepSelection || !state.selectedProjectId || !state.projects.some((project) => project.id === state.selectedProjectId)) {
    state.selectedProjectId = state.projects.find((project) => project.hasDatabase)?.id ?? null;
  }

  renderProjects();

  if (state.selectedProjectId) {
    await loadTraces(state.selectedProjectId, keepSelection);
    await loadMemory(state.selectedProjectId);
  } else {
    traceList.innerHTML = '<div class="empty-state">No hay proyectos de Mastra con base de datos disponible.</div>';
    detailSummary.innerHTML = '<div class="empty-state">Arranca alguno de los chatbots para que cree su `.db` y aparezca aquí.</div>';
    spanTree.innerHTML = '';
    workflowList.innerHTML = '';
    memorySection.style.display = 'none';
  }
}

function renderProjects() {
  projectList.innerHTML = state.projects
    .map((project) => `
      <button class="project-card ${project.id === state.selectedProjectId ? 'is-active' : ''}" data-project-id="${project.id}">
        <div>
          <strong>${escapeHtml(project.id)}</strong>
          <p>${escapeHtml(project.packageName)}</p>
        </div>
        <div class="project-stats">
          <span>${project.traceCount} traces</span>
          <span>${project.workflowCount} workflows</span>
          <span>${project.hasDatabase ? 'db local' : 'sin db'}</span>
        </div>
      </button>
    `)
    .join('');

  projectList.querySelectorAll('[data-project-id]').forEach((element) => {
    element.addEventListener('click', () => {
      const projectId = element.getAttribute('data-project-id');
      if (!projectId || projectId === state.selectedProjectId) return;
      state.selectedProjectId = projectId;
      state.selectedTraceId = null;
      void loadTraces(projectId);
      void loadMemory(projectId);
      renderProjects();
    });
  });
}

async function loadTraces(projectId, keepTrace = false) {
  selectionTitle.textContent = projectId;
  traceList.innerHTML = '<div class="empty-state">Cargando traces…</div>';

  const payload = await requestJson(`/api/projects/${projectId}/traces`);
  state.traces = payload.traces;
  traceCount.textContent = String(state.traces.length);

  if (!keepTrace || !state.selectedTraceId || !state.traces.some((trace) => trace.traceId === state.selectedTraceId)) {
    state.selectedTraceId = state.traces[0]?.traceId ?? null;
  }

  renderTraces();

  if (state.selectedTraceId) {
    await loadTraceDetail(projectId, state.selectedTraceId);
  } else {
    detailSummary.innerHTML = '<div class="empty-state">Este proyecto todavía no tiene traces persistidos.</div>';
    spanTree.innerHTML = '';
    workflowList.innerHTML = '';
  }
}

function renderTraces() {
  if (!state.traces.length) {
    traceList.innerHTML = '<div class="empty-state">No hay traces para este chatbot.</div>';
    return;
  }

  traceList.innerHTML = state.traces
    .map((trace) => `
      <button class="trace-card ${trace.traceId === state.selectedTraceId ? 'is-active' : ''}" data-trace-id="${trace.traceId}">
        <div class="trace-card-head">
          <strong>${escapeHtml(trace.rootName)}</strong>
          <span>${formatDuration(trace.durationMs)}</span>
        </div>
        <p class="trace-question">${escapeHtml(trace.userInputPreview || 'Sin input decodificado')}</p>
        ${
          trace.routePreview.length
            ? `<div class="route-preview">
                ${trace.routePreview.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
              </div>`
            : ''
        }
        <div class="trace-card-meta">
          <span>${formatDate(trace.startedAt)}</span>
          <span>${trace.spanCount} spans</span>
          <span>${trace.toolCalls} tools</span>
          ${
            trace.tokenUsage?.totalTokens
              ? `<span>${formatTokenValue(trace.tokenUsage.totalTokens)} tokens</span>`
              : ''
          }
        </div>
      </button>
    `)
    .join('');

  traceList.querySelectorAll('[data-trace-id]').forEach((element) => {
    element.addEventListener('click', () => {
      const traceId = element.getAttribute('data-trace-id');
      if (!traceId || traceId === state.selectedTraceId) return;
      state.selectedTraceId = traceId;
      renderTraces();
      void loadTraceDetail(state.selectedProjectId, traceId);
    });
  });
}

async function loadTraceDetail(projectId, traceId) {
  detailSummary.innerHTML = '<div class="empty-state">Cargando detalle del trace…</div>';
  const payload = await requestJson(`/api/projects/${projectId}/traces/${traceId}`);
  renderTraceDetail(payload.trace);
}

function renderTraceDetail(trace) {
  detailSummary.innerHTML = `
    <div class="summary-grid">
      <article class="summary-card">
        <p class="summary-label">Pregunta</p>
        <div class="summary-body">${escapeHtml(trace.userInputPreview || 'No disponible')}</div>
      </article>
      <article class="summary-card">
        <p class="summary-label">Respuesta</p>
        <div class="summary-body">${escapeHtml(trace.finalOutputPreview || 'No disponible')}</div>
      </article>
      <a class="summary-card summary-card-link" href="/sequence.html?project=${encodeURIComponent(trace.projectId)}&trace=${encodeURIComponent(trace.traceId)}" target="_blank">
        <p class="summary-label">Ruta <span class="link-hint">abrir secuencia</span></p>
        <div class="route-preview large">
          ${trace.routePreview.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}
        </div>
      </a>
      <article class="summary-card">
        <p class="summary-label">Métricas</p>
        <h3>${trace.spanCount} spans · ${trace.toolCalls} tools · ${formatDuration(trace.durationMs)}</h3>
        <p>${formatDate(trace.startedAt)}</p>
        ${
          trace.tokenUsage
            ? `<div class="token-strip">
                <span>in ${formatTokenValue(trace.tokenUsage.inputTokens)}</span>
                <span>out ${formatTokenValue(trace.tokenUsage.outputTokens)}</span>
                <span>reason ${formatTokenValue(trace.tokenUsage.reasoningTokens)}</span>
                <span>total ${formatTokenValue(trace.tokenUsage.totalTokens)}</span>
              </div>`
            : '<p class="muted-line">Sin uso de tokens disponible en este trace.</p>'
        }
      </article>
    </div>
  `;

  workflowList.innerHTML = trace.workflows.length
    ? `
      <div class="workflow-header">
        <h3>Workflow snapshots</h3>
      </div>
      ${trace.workflows
        .map(
          (workflow) => `
            <article class="workflow-card">
              <div class="workflow-meta">
                <strong>${escapeHtml(workflow.workflowName)}</strong>
                <span>${formatDate(workflow.createdAt)}</span>
              </div>
              <pre>${escapeHtml(workflow.preview || 'Sin preview')}</pre>
            </article>
          `,
        )
        .join('')}
    `
    : '';

  spanTree.innerHTML = `
    <div class="tree-header">
      <h3>Árbol de spans</h3>
      <p>Relación real padre/hijo persistida por Mastra observability.</p>
    </div>
    ${trace.spans.map((span) => renderSpanNode(span)).join('')}
  `;
}

function renderSpanNode(span, depth = 0) {
  return `
    <article class="span-card depth-${Math.min(depth, 5)} type-${spanClass(span.spanType)}">
      <div class="span-card-head">
        <div>
          <span class="span-badge">${escapeHtml(span.spanType)}</span>
          <h4>${escapeHtml(span.name)}</h4>
        </div>
        <div class="span-meta">
          <span>${formatDuration(span.durationMs)}</span>
          <span>${formatDate(span.startedAt)}</span>
        </div>
      </div>
      ${
        span.tokenUsage
          ? `<div class="token-strip inline">
              <span>in ${formatTokenValue(span.tokenUsage.inputTokens)}</span>
              <span>out ${formatTokenValue(span.tokenUsage.outputTokens)}</span>
              ${
                span.tokenUsage.reasoningTokens != null
                  ? `<span>reason ${formatTokenValue(span.tokenUsage.reasoningTokens)}</span>`
                  : ''
              }
            </div>`
          : ''
      }
      <div class="span-payloads">
        <div>
          <p>Input</p>
          <pre>${escapeHtml(span.inputPreview || 'No disponible')}</pre>
        </div>
        <div>
          <p>Output</p>
          <pre>${escapeHtml(span.outputPreview || 'No disponible')}</pre>
        </div>
      </div>
      ${
        span.children.length
          ? `<div class="span-children">${span.children.map((child) => renderSpanNode(child, depth + 1)).join('')}</div>`
          : ''
      }
    </article>
  `;
}

async function loadMemory(projectId) {
  try {
    const payload = await requestJson(`/api/projects/${projectId}/memory`);
    if (payload.memory.length > 0) {
      memorySection.style.display = '';
      memoryList.innerHTML = payload.memory
        .map((entry) => `
          <article class="memory-card">
            <div class="memory-meta">
              <strong>${escapeHtml(entry.resourceId)}</strong>
              <span>${formatDate(entry.updatedAt)}</span>
            </div>
            <pre class="memory-content">${escapeHtml(entry.workingMemory || 'Vacía')}</pre>
          </article>
        `)
        .join('');
    } else {
      memorySection.style.display = 'none';
      memoryList.innerHTML = '';
    }
  } catch {
    memorySection.style.display = 'none';
    memoryList.innerHTML = '';
  }
}

void loadProjects().catch((error) => {
  detailSummary.innerHTML = `<div class="empty-state">Error cargando el visor: ${escapeHtml(error.message)}</div>`;
});
