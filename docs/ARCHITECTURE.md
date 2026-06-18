# BX Conversation Trace - Architecture Notes

## Core idea

BX is a local repository layer plus a VS Code extension experience.

```text
VS Code Chat @bx
  -> Chat Participant Handler
  -> Session Manager
  -> Event Store
  -> .bx/ repository layer
```

## MVP boundary

This MVP captures only interactions routed through `@bx`.

It does not capture third-party chat participant messages. That limitation is intentional because a standard VS Code extension controls the participant it owns, not every chat interaction from other participants.

## Event model

The main event stream is:

```text
.bx/sessions/<session-id>/chat-events.jsonl
```

Initial event types:

```text
bx.session.started
bx.chat.user_message
bx.chat.assistant_response
bx.session.stopped
```

## Why JSONL first

JSONL is better than SQLite for MVP 0.1 because:

- very easy to inspect;
- append-friendly;
- portable;
- no migration layer;
- easier to debug during product discovery.

SQLite can come later when querying and aggregation matter more.

## Future evolution

1. Add active editor context.
2. Add selected text capture.
3. Add git diff capture.
4. Add code event stream.
5. Add local CLI.
6. Add OpenTelemetry/Langfuse bridge.
7. Consider fork only after validating the event contract and user value.

## Text observability in MVP 0.1

Every logged chat message can include a small `observability` block.

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

This is not model billing. It is only a lightweight FinOps-oriented text volume estimate. Real model usage should be added later as a separate block when BX calls a model provider.
