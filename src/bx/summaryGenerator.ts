import { BxChatEvent } from './types';

function getObservabilityNumber(event: BxChatEvent, field: 'totalchars' | 'estimatedTokens'): number {
  const observability = event.payload.observability;

  if (!observability || typeof observability !== 'object') {
    return 0;
  }

  const value = (observability as Record<string, unknown>)[field];

  return typeof value === 'number' ? value : 0;
}

function getTokenCountingMethods(events: BxChatEvent[]): string[] {
  const methods = new Set<string>();

  for (const event of events) {
    const observability = event.payload.observability;

    if (!observability || typeof observability !== 'object') {
      continue;
    }

    const method = (observability as Record<string, unknown>).tokenCountingMethod;

    if (typeof method === 'string') {
      methods.add(method);
    }
  }

  return Array.from(methods);
}


export function generateSummary(events: BxChatEvent[]): string {
  const started = events.find((event) => event.type === 'bx.session.started');
  const stopped = events.find((event) => event.type === 'bx.session.stopped');
  const userMessages = events.filter((event) => event.type === 'bx.chat.user_message');
  const assistantResponses = events.filter((event) => event.type === 'bx.chat.assistant_response');
  const conversationalEvents = [...userMessages, ...assistantResponses];

  const userTotalChars = userMessages.reduce((sum, event) => sum + getObservabilityNumber(event, 'totalchars'), 0);
  const assistantTotalChars = assistantResponses.reduce((sum, event) => sum + getObservabilityNumber(event, 'totalchars'), 0);
  const userEstimatedTokens = userMessages.reduce((sum, event) => sum + getObservabilityNumber(event, 'estimatedTokens'), 0);
  const assistantEstimatedTokens = assistantResponses.reduce((sum, event) => sum + getObservabilityNumber(event, 'estimatedTokens'), 0);
  const tokenCountingMethods = getTokenCountingMethods(conversationalEvents);

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
  lines.push('- Code diff capture is intentionally out of scope for this first version.');
  lines.push('- Risk detection is rule-based and should be treated as an early signal, not a final audit.');
  lines.push('');

  return lines.join('\n');
}
