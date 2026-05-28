# AGENTS

Steering for AI coding agents working on this project.

## AI Prompt Library Steering (Auto-Managed — do not edit)

Before handling any non-trivial request, read this one file:
1. `.ai-prompts/prompts/orchestrators/ai-agent-entry-point.md` — entry point.

The entry point's routing logic selects ONE of four modes and then loads
the matching engine on demand:
- **Trivial** (single-file edit) → no engine load.
- **Execute** (validated plan exists) → loads `.ai-prompts/prompts/orchestrators/executor.md`.
- **Gap-closure** (existing codebase, audit/finish requested) → loads `.ai-prompts/prompts/orchestrators/audit-and-remediate.md`.
- **Greenfield** (new project) → loads `.ai-prompts/prompts/orchestrators/drill-down-engine.md`.

If `MY_PROJECT.md` lists external material or the project already has
source code under `working_copy/`, the entry point also reads
`.ai-prompts/prompts/orchestrators/external-input-handler.md` before the
chosen engine.

Do NOT auto-load anything else under `.ai-prompts/prompts/orchestrators/`
without following the entry-point routing.

**Resumption.** If the user says `Continue` (or any resumption verb), the
entry point picks the cheapest valid path automatically: checkpoint
resumption if `prompts/outputs/current/resumption-checkpoint.md` exists,
execution-phase fast path if `execution-log.md` has a non-null `next_task`,
or a full force-reload only when neither shortcut is available (or the
user explicitly asks for `rebuild` / `force reload`). If neither artifact
exists and the user said only `Continue`, the entry point surfaces an
ambiguous-resumption error.

Follow the entry point's checkpoint protocol exactly. At every engine
checkpoint, stop, summarize progress, and wait for the user to say
`Continue` before moving to the next step. Do not auto-advance across
planning checkpoints.
<!-- /AI Prompt Library Steering (Auto-Managed) -->
