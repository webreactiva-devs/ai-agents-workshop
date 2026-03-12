# Diagramas de Arquitectura

## Agente "¿hoy qué me pongo?"

### Nivel 1 — Augmented LLM

```mermaid
flowchart LR
    U([Usuario]) --> A[Agente LLM]
    A --> T[Tool]
    T --> API[(API Open-Meteo)]
    API -.-> T
    T -.-> A
    A --> R([Respuesta libre])

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style A fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style T fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```

### Nivel 2 — Policy + Guardrails

```mermaid
flowchart TD
    U([Usuario]) --> IG{Input Guardrail}
    IG -->|Off-topic| Reject([Rechazo amigable])
    IG -->|Válido| A[Agente LLM]

    A --> T1[Tool]
    A --> T2[Policy]

    T1 --> API[(API Open-Meteo)]
    API -.-> T1

    T1 -.->|Datos crudos| T2

    A --> OG{Output Guardrail}
    OG -->|Coherente| R([Respuesta])
    OG -->|Contradicción| A

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style A fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style IG fill:#161b22,color:#f778ba,stroke:#f778ba,stroke-width:2px
    style OG fill:#161b22,color:#f778ba,stroke:#f778ba,stroke-width:2px
    style Reject fill:#da3633,color:#fff,stroke:#da3633
    style T1 fill:#161b22,color:#7ee787,stroke:#7ee787
    style T2 fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```

### Nivel 3 — Working Memory

```mermaid
flowchart TD
    U([Usuario]) --> A[Agente LLM]

    A --> T[Tool]
    T --> API[(API Open-Meteo)]
    API -.-> T
    T -.-> A

    A <-->|lee y escribe| WM[(Memoria)]

    A --> R([Respuesta personalizada])

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style A fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style T fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style WM fill:#161b22,color:#d2a8ff,stroke:#d2a8ff,stroke-width:2px
    style Prefs fill:#0d1117,color:#8b949e,stroke:#30363d
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```

### Nivel 4 — Reusable Skill

```mermaid
flowchart TD
    U([Usuario]) --> A[Agente LLM]

    A --> T1[Tool]

    T1 --> API[(API Open-Meteo)]

    A <--> WM[(Memoria)]

    SK[/"Skill: instrucciones reutilizables"/] -.->|inyectada en contexto| A

    A --> R([Respuesta consistente])

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style A fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style T1 fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style WM fill:#161b22,color:#d2a8ff,stroke:#d2a8ff
    style SK fill:#161b22,color:#ffa657,stroke:#ffa657,stroke-width:2px
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```

### Nivel 5 — MCP + Observabilidad

```mermaid
flowchart TD
    U([Usuario]) --> A[Agente LLM]

    A <--> WM[(Memoria)]
    SK[/"Skill"/] -.-> A

    A --> MCP_C[MCP Client]

    MCP_C -->|"SSE / stdio"| MCP_S[MCP Server]

    MCP_S --> T1[Tool dinámica A]
    MCP_S --> T2[Tool dinámica B]

    T1 & T2 --> API[(API Open-Meteo)]

    MCP_S -->|cada invocación| TR[("Trazas JSONL")]

    A --> R([Respuesta])

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style A fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style MCP_C fill:#161b22,color:#79c0ff,stroke:#79c0ff,stroke-width:2px
    style MCP_S fill:#161b22,color:#79c0ff,stroke:#79c0ff,stroke-width:2px
    style T1 fill:#161b22,color:#7ee787,stroke:#7ee787
    style T2 fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style WM fill:#161b22,color:#d2a8ff,stroke:#d2a8ff
    style SK fill:#161b22,color:#ffa657,stroke:#ffa657
    style TR fill:#161b22,color:#f0883e,stroke:#f0883e,stroke-width:2px
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```

### Nivel 6 — Multi-Agente + Evaluación

```mermaid
flowchart TD
    U([Usuario]) --> ORC[Agente Orquestador]

    ORC -->|delega| WF["Workflow secuencial"]

    subgraph WF_STEPS [" "]
        direction TB
        S1[Agente Meteo] -->|structured output| S2[Agente Ropa]
    end

    WF --> S1
    S1 --> T1[Tool]
    T1 --> API[(API Open-Meteo)]

    S2 --> T2[Policy]

    S2 --> EVAL

    subgraph EVAL [Evaluación]
        direction LR
        SC1["Scorers LLM"]
        SC5["Scorer determinista "]
    end

    EVAL --> Scores([Puntuaciones de calidad])

    S2 --> R([Respuesta final])

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style ORC fill:#161b22,color:#58a6ff,stroke:#58a6ff,stroke-width:2px
    style WF fill:#0d1117,color:#c9d1d9,stroke:#30363d
    style S1 fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style S2 fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style T1 fill:#161b22,color:#7ee787,stroke:#7ee787
    style T2 fill:#161b22,color:#7ee787,stroke:#7ee787
    style API fill:#161b22,color:#f0883e,stroke:#f0883e
    style SC1 fill:#161b22,color:#ffa657,stroke:#ffa657
    style SC5 fill:#161b22,color:#7ee787,stroke:#7ee787
    style Scores fill:#1f6feb,color:#fff,stroke:#1f6feb
    style R fill:#1f6feb,color:#fff,stroke:#1f6feb
```


---

## OpenCode Duo Agent

### Arquitectura sin evaluador externo

```mermaid
flowchart TD
    U([Usuario]) -->|"/duo tarea"| Lead[Lead Agent]
    Lead -->|asigna tarea| Executor[Executor Agent]
    Executor -->|escribe código| Code[(Código)]
    Executor -->|executor-to-review.md| Files[/"Ficheros de coordinación"/]
    Files -->|lee handoff| Review[Review Agent]
    Review -->|review-to-executor.md| Files
    Files -->|lee veredicto| Executor
    Review -->|APPROVED| Lead
    Lead -->|resultado final| U

    Plugin[duo-observer.ts] -->|detecta escrituras| Files
    Plugin -->|append| Log[(trace.ndjson)]

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style Lead fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Executor fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Review fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Code fill:#161b22,color:#7ee787,stroke:#7ee787
    style Files fill:#161b22,color:#ffa657,stroke:#ffa657
    style Plugin fill:#161b22,color:#79c0ff,stroke:#79c0ff
    style Log fill:#161b22,color:#f0883e,stroke:#f0883e
```

### Arquitectura con evaluador externo

```mermaid
flowchart TD
    U([Usuario]) -->|"/duo tarea"| Lead[Lead Agent]
    Lead -->|asigna tarea| Executor[Executor Agent]
    Executor -->|escribe código| Code[(Código)]
    Executor -->|executor-to-review.md| Files[/"Ficheros de coordinación"/]
    Files -->|lee handoff| Review[Review Agent]
    Review -->|review-to-executor.md| Files
    Files -->|lee veredicto| Executor
    Review -->|APPROVED| Lead
    Lead -->|resultado final| U

    Plugin[duo-observer.ts] -->|detecta escrituras| Files
    Plugin -->|append| Log[(trace.ndjson)]
    Plugin -->|"eval: true → prompt"| Eval{Evaluador externo}
    Eval -->|"YAML scores"| Plugin
    Plugin -->|append scores| SC[(eval-scorecard.md)]

    style U fill:#1f6feb,color:#fff,stroke:#1f6feb
    style Lead fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Executor fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Review fill:#161b22,color:#c9d1d9,stroke:#58a6ff,stroke-width:2px
    style Code fill:#161b22,color:#7ee787,stroke:#7ee787
    style Files fill:#161b22,color:#ffa657,stroke:#ffa657
    style Plugin fill:#161b22,color:#79c0ff,stroke:#79c0ff
    style Log fill:#161b22,color:#f0883e,stroke:#f0883e
    style Eval fill:#161b22,color:#f778ba,stroke:#f778ba
    style SC fill:#161b22,color:#d2a8ff,stroke:#d2a8ff
```

### Grafo de permisos entre agentes

```mermaid
flowchart LR
    Lead -->|task: allow| Executor
    Lead -->|task: allow| Review
    Executor -->|task: allow| Review
    Review -->|task: allow| Executor

    Lead -.->|"write/edit: false"| Lead
    Review -.->|"edit/patch: false"| Review
    Executor -->|"write/edit: true"| Code[(Código)]

    style Lead fill:#161b22,color:#58a6ff,stroke:#58a6ff,stroke-width:2px
    style Executor fill:#161b22,color:#7ee787,stroke:#7ee787,stroke-width:2px
    style Review fill:#161b22,color:#f0883e,stroke:#f0883e,stroke-width:2px
    style Code fill:#161b22,color:#d2a8ff,stroke:#d2a8ff
```
