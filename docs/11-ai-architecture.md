# EOS — AI Architecture (Phase 2 — design only, not implemented)

The MVP deliberately ships **no AI**. This document defines how AI features plug
into the existing system without disrupting it.

## Principles

1. **Read the same data** the dashboards use — no separate pipeline.
2. **Async + cached** — AI runs as background jobs; results are stored and served
   instantly (never block a request on a model call).
3. **Provider-agnostic** — a thin `AiProvider` interface so the model vendor is
   swappable. Default to the latest Claude models (e.g. `claude-opus-4-8` /
   `claude-sonnet-4-6`) for quality summaries.
4. **Human-in-the-loop** — generated text is a draft for staff to review, not an
   automatic action.

## Planned modules

| Feature | Input | Output | Trigger |
|---------|-------|--------|---------|
| Student progress summary | attendance %, exam trend, notes, curriculum | short natural-language summary | nightly + on-demand |
| Risk **prediction** (vs. rules) | historical time-series of the above | probability + drivers | nightly batch |
| Teacher performance analysis | group attendance quality, improvement, coverage | strengths/risks summary | weekly |
| Parent-friendly report | child's data for a period | plain-language report | monthly / on-demand |
| Academic trend detection | cohort/group aggregates | anomalies & trends | weekly |

## Proposed architecture

```
   Domain data (Postgres)
          │  read-only snapshots
          ▼
   ai/ module (NestJS)
     ├── ai.provider.ts        # interface: summarize(), classify(), report()
     ├── providers/claude.ts   # Anthropic implementation
     ├── ai.jobs.ts            # @Cron batch generation
     ├── ai.service.ts         # builds prompts from domain data
     └── ai.controller.ts      # GET cached results; POST regenerate (admin)
          │
          ▼
   ai_outputs table  (entityType, entityId, kind, content, model, createdAt)
```

- **Storage**: a single `ai_outputs` table keyed by `(entityType, entityId, kind)`
  holding the latest generated artifact + the model/version used (for audit).
- **Prompting**: `ai.service` assembles structured facts (never raw PII beyond
  what's needed) into prompts; outputs are stored, not streamed to end-users live.
- **Risk prediction** complements — does not replace — the deterministic rules
  engine; the rules remain the explainable baseline.

## Data & privacy

- Send the **minimum** necessary fields; prefer aggregates and derived metrics.
- Record every generation in `audit_logs` (action `EXPORT`) with the model id.
- Make AI opt-in per academy; allow disabling and purging `ai_outputs`.

## Rollout

1. Start with **student progress summaries** (highest value, lowest risk).
2. Add **parent reports** (reuse summaries).
3. Then **prediction** and **teacher/cohort analysis** once enough history exists.
