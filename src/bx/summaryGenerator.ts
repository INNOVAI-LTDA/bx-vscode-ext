import { BxChatEvent } from './types';

function getObservability(event: BxChatEvent): Record<string, unknown> | undefined {
  const observability = event.payload.observability;

  if (!observability || typeof observability !== 'object') {
    return undefined;
  }

  return observability as Record<string, unknown>;
}

function getObservabilityNumber(event: BxChatEvent, field: 'totalchars' | 'estimatedTokens' | 'latencyMs'): number {
  const observability = getObservability(event);

  if (!observability) {
    return 0;
  }

  const value = observability[field];

  return typeof value === 'number' ? value : 0;
}

function getTokenCountingMethods(events: BxChatEvent[]): string[] {
  const methods = new Set<string>();

  for (const event of events) {
    const observability = getObservability(event);

    if (!observability) {
      continue;
    }

    const method = observability.tokenCountingMethod;

    if (typeof method === 'string') {
      methods.add(method);
    }
  }

  return Array.from(methods);
}

function getModelLabels(events: BxChatEvent[]): string[] {
  const labels = new Set<string>();

  for (const event of events) {
    const model = event.payload.model;

    if (!model || typeof model !== 'object') {
      continue;
    }

    const modelRecord = model as Record<string, unknown>;
    const vendor = typeof modelRecord.vendor === 'string' ? modelRecord.vendor : 'unknown_vendor';
    const family = typeof modelRecord.family === 'string' ? modelRecord.family : undefined;
    const name = typeof modelRecord.name === 'string' ? modelRecord.name : undefined;
    const id = typeof modelRecord.id === 'string' ? modelRecord.id : undefined;

    labels.add([vendor, family ?? name ?? id ?? 'unknown_model'].join('/'));
  }

  return Array.from(labels);
}

export function generateSummary(events: BxChatEvent[]): string {
  const started = events.find((event) => event.type === 'bx.session.started');
  const stopped = events.find((event) => event.type === 'bx.session.stopped');
  const userMessages = events.filter((event) => event.type === 'bx.chat.user_message');
  const assistantResponses = events.filter((event) => event.type === 'bx.chat.assistant_response');
  const modelStarted = events.filter((event) => event.type === 'bx.model.request.started');
  const modelCompleted = events.filter((event) => event.type === 'bx.model.request.completed');
  const modelFailed = events.filter((event) => event.type === 'bx.model.request.failed');
  const modelSelected = events.filter((event) => event.type === 'bx.model.selected');
  const conversationalEvents = [...userMessages, ...assistantResponses];

  const userTotalChars = userMessages.reduce((sum, event) => sum + getObservabilityNumber(event, 'totalchars'), 0);
  const assistantTotalChars = assistantResponses.reduce((sum, event) => sum + getObservabilityNumber(event, 'totalchars'), 0);
  const userEstimatedTokens = userMessages.reduce((sum, event) => sum + getObservabilityNumber(event, 'estimatedTokens'), 0);
  const assistantEstimatedTokens = assistantResponses.reduce((sum, event) => sum + getObservabilityNumber(event, 'estimatedTokens'), 0);
  const tokenCountingMethods = getTokenCountingMethods(conversationalEvents);
  const modelLabels = getModelLabels([...assistantResponses, ...modelCompleted]);
  const latencyValues = assistantResponses
    .map((event) => getObservabilityNumber(event, 'latencyMs'))
    .filter((value) => value > 0);
  const averageLatencyMs = latencyValues.length
    ? Math.round(latencyValues.reduce((sum, value) => sum + value, 0) / latencyValues.length)
    : 0;

  const intents = new Set<string>();
  const riskFlags = new Set<string>();
  const entities = new Set<string>();

  for (const event of userMessages) {
    const intent = event.payload.inferredIntent;
    if (typeof intent === 'string') {
      intents.add(intent);
    }

    const flags = event.payload.riskFlags;
    if (Array.isArray(flags)) {
      flags.forEach((flag) => riskFlags.add(String(flag)));
    }

    const extractedEntities = event.payload.entities;
    if (Array.isArray(extractedEntities)) {
      extractedEntities.forEach((entity) => entities.add(String(entity)));
    }
  }

  const lines: string[] = [];

  lines.push('# BX Session Summary');
  lines.push('');
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push('');

  if (started) {
    lines.push('## Session');
    lines.push('');
    lines.push(`- Goal: ${String(started.payload.goal ?? 'Not informed')}`);
    lines.push(`- Workspace: ${String(started.payload.workspaceName ?? 'Unknown')}`);
    lines.push(`- Started at: ${started.timestamp}`);
    if (stopped) {
      lines.push(`- Stopped at: ${stopped.timestamp}`);
    }
    lines.push('');
  }

  lines.push('## Conversation Metrics');
  lines.push('');
  lines.push(`- User messages: ${userMessages.length}`);
  lines.push(`- Assistant responses: ${assistantResponses.length}`);
  lines.push(`- User totalchars: ${userTotalChars}`);
  lines.push(`- Assistant totalchars: ${assistantTotalChars}`);
  lines.push(`- Total chars: ${userTotalChars + assistantTotalChars}`);
  lines.push(`- User estimatedTokens: ${userEstimatedTokens}`);
  lines.push(`- Assistant estimatedTokens: ${assistantEstimatedTokens}`);
  lines.push(`- Total estimatedTokens: ${userEstimatedTokens + assistantEstimatedTokens}`);
  lines.push(`- tokenCountingMethod: ${tokenCountingMethods.length ? tokenCountingMethods.join(', ') : 'not available'}`);
  lines.push('');

  lines.push('## AI Proxy Observability');
  lines.push('');
  lines.push(`- Model requests started: ${modelStarted.length}`);
  lines.push(`- Model requests completed: ${modelCompleted.length}`);
  lines.push(`- Model request failures: ${modelFailed.length}`);
  lines.push(`- Explicit model selections: ${modelSelected.length}`);
  lines.push(`- Models observed: ${modelLabels.length ? modelLabels.join(', ') : 'not available'}`);
  lines.push(`- Average response latencyMs: ${averageLatencyMs || 'not available'}`);
  lines.push(`- Billing available: false`);
  lines.push('');

  lines.push('## Detected Intents');
  lines.push('');
  if (intents.size === 0) {
    lines.push('- None detected');
  } else {
    for (const intent of intents) {
      lines.push(`- ${intent}`);
    }
  }
  lines.push('');

  lines.push('## Detected Entities');
  lines.push('');
  if (entities.size === 0) {
    lines.push('- None detected');
  } else {
    for (const entity of entities) {
      lines.push(`- ${entity}`);
    }
  }
  lines.push('');

  lines.push('## Risk Flags');
  lines.push('');
  if (riskFlags.size === 0) {
    lines.push('- None detected');
  } else {
    for (const flag of riskFlags) {
      lines.push(`- ${flag}`);
    }
  }
  lines.push('');

  lines.push('## Timeline');
  lines.push('');
  for (const event of events) {
    if (event.type === 'bx.session.started') {
      lines.push(`- ${event.timestamp} - Session started.`);
    }

    if (event.type === 'bx.chat.user_message') {
      lines.push(`- ${event.timestamp} - User: ${String(event.payload.rawText ?? '')}`);
    }

    if (event.type === 'bx.model.selected') {
      const label = [event.payload.vendor, event.payload.family, event.payload.id].filter(Boolean).join('/');
      lines.push(`- ${event.timestamp} - Model selected: ${label || 'unknown model'}.`);
    }

    if (event.type === 'bx.model.selection.cleared') {
      lines.push(`- ${event.timestamp} - Model selection cleared.`);
    }

    if (event.type === 'bx.model.request.started') {
      lines.push(`- ${event.timestamp} - Model request started.`);
    }

    if (event.type === 'bx.model.request.completed') {
      lines.push(`- ${event.timestamp} - Model request completed.`);
    }

    if (event.type === 'bx.model.request.failed') {
      lines.push(`- ${event.timestamp} - Model request failed: ${String(event.payload.message ?? 'unknown error')}`);
    }

    if (event.type === 'bx.chat.assistant_response') {
      lines.push(`- ${event.timestamp} - BX: ${String(event.payload.summary ?? '')}`);
    }

    if (event.type === 'bx.session.stopped') {
      lines.push(`- ${event.timestamp} - Session stopped.`);
    }
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push('- This MVP logs only conversations routed through `@bx`.');
  lines.push('- AI responses are called through the VS Code Language Model API when a provider is available.');
  lines.push('- Token metrics are estimates based on `totalchars/4`, not provider billing.');
  lines.push('- Code diff capture is intentionally out of scope for this version.');
  lines.push('- Risk detection is rule-based and should be treated as an early signal, not a final audit.');
  lines.push('');

  return lines.join('\n');
}
