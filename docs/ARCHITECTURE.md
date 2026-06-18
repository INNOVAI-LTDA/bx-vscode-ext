# BX Conversation Trace - Architecture Notes

## Core idea

BX is a local repository layer plus a VS Code extension experience.

In v0.2.2, BX is an observable AI proxy with explicit model selection:

```text
VS Code Chat @bx
  -> Chat Participant Handler
  -> Optional model selection with /models + /use-model
  -> Session Manager logs user message
  -> Model Service resolves selected VS Code language model
  -> Model Service calls VS Code Language Model API
  -> Chat Participant streams model response
  -> Session Manager logs model response and observability
  -> Event Store writes .bx/ repository layer
```

## MVP boundary

This MVP captures only interactions routed through `@bx`.

It does not capture third-party chat participant messages. That limitation is intentional because a standard VS Code extension controls the participant it owns, not every chat interaction from other participants.

The extension does not apply generated code automatically. The answer is shown in chat and logged as evidence.

## Event model

The main event stream is:

```text
.bx/sessions/<session-id>/chat-events.jsonl
```

Event types in v0.2.2:

```text
bx.session.started
bx.session.stopped
bx.chat.user_message
bx.model.available_models.listed
bx.model.selected
bx.model.selection.cleared
bx.model.request.started
bx.model.request.completed
bx.model.request.failed
bx.chat.assistant_response
```

## Model selection flow

The diagnostic command lists the models that the extension can actually see:

```text
@bx /models
```

Example output:

```text
1. MiniMax-M3 (Intl)
   - vendor: cllms
   - family: minimax
   - id: MiniMax-M3-intl
   - version: minimax-m3
   - maxInputTokens: 1000000
```

Then the user selects a model explicitly:

```text
@bx /use-model MiniMax-M3-intl
```

or:

```text
@bx /use-model 1
```

The current selection can be checked with:

```text
@bx /model
```

The selection is stored in VS Code `workspaceState`, not in `.bx/bx.yaml`. This keeps local provider/model preference out of Git while preserving session evidence in `.bx/`.

To clear explicit selection:

```text
@bx /clear-model
```

## AI proxy flow

For a normal prompt, the flow is:

```text
@bx user prompt
  -> bx.chat.user_message
  -> bx.model.request.started
  -> selected VS Code language model call
  -> bx.model.request.completed
  -> bx.chat.assistant_response
```

If no model is available, the fallback is:

```text
@bx user prompt
  -> bx.chat.user_message
  -> bx.model.request.started
  -> bx.model.request.failed
  -> bx.chat.assistant_response with mode logger_only_fallback
```

This means the session remains useful even when model access fails.

## Why JSONL first

JSONL is better than SQLite for MVP because:

- very easy to inspect;
- append-friendly;
- portable;
- no migration layer;
- easier to debug during product discovery.

SQLite can come later when querying and aggregation matter more.

## Text observability

Every logged user and assistant message can include a small `observability` block.

Example:

```json
{
  "observability": {
    "totalchars": 83,
    "estimatedTokens": 21,
    "tokenCountingMethod": "totalchars/4"
  }
}
```

Field meaning:

- `totalchars`: the raw JavaScript string length of the message.
- `estimatedTokens`: `Math.ceil(totalchars / 4)`.
- `tokenCountingMethod`: fixed expression string used for traceability.

This is not model billing. It is only a lightweight FinOps-oriented text volume estimate.

## Model observability

When a model is called, assistant/model events can include:

```json
{
  "model": {
    "id": "MiniMax-M3-intl",
    "name": "MiniMax-M3 (Intl)",
    "vendor": "cllms",
    "family": "minimax",
    "version": "minimax-m3"
  },
  "observability": {
    "totalchars": 1240,
    "estimatedTokens": 310,
    "tokenCountingMethod": "totalchars/4",
    "latencyMs": 4380,
    "streamed": true,
    "billingAvailable": false
  }
}
```

`billingAvailable` is intentionally false in v0.2.2. We are not yet using provider billing usage or real tokenizer counts.

## Important services

```text
src/bx/chatParticipant.ts
```

Owns `@bx`, routes commands, logs prompts, calls the model service and streams output.

```text
src/bx/modelService.ts
```

Lists VS Code language models, persists explicit model selection in `workspaceState`, resolves the selected model, sends the prompt and returns response text, model metadata and observability.

```text
src/bx/sessionManager.ts
```

Owns active session state and creates structured events.

```text
src/bx/eventStore.ts
```

Persists `.bx/`, `session.json`, `chat-events.jsonl` and `summary.md`.

```text
src/bx/summaryGenerator.ts
```

Aggregates conversation, model and observability metrics into Markdown.

## Future evolution

1. Add active editor context.
2. Add selected text capture.
3. Add git diff capture.
4. Add code event stream.
5. Add real provider token usage when available.
6. Add local CLI.
7. Add OpenTelemetry/Langfuse bridge.
8. Consider fork only after validating the event contract and user value.
