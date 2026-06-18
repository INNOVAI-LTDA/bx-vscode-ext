import * as vscode from 'vscode';
import { BxSessionManager } from './sessionManager';
import { BxEventStore } from './eventStore';
import { generateSummary } from './summaryGenerator';

export function registerBxChatParticipant(
  context: vscode.ExtensionContext,
  sessionManager: BxSessionManager,
  store: BxEventStore
): vscode.Disposable {
  const handler: vscode.ChatRequestHandler = async (
    request,
    _chatContext,
    stream,
    _token
  ) => {
    const prompt = request.prompt.trim();

    try {
      if (prompt.startsWith('/init')) {
        await sessionManager.init();
        stream.markdown('BX initialized. Created `.bx/` repository layer in the current workspace.');
        return;
      }

      if (prompt.startsWith('/start')) {
        const goal = prompt.replace('/start', '').trim() || undefined;
        const session = await sessionManager.start(goal);

        stream.markdown(`BX session started: \`${session.sessionId}\``);
        return;
      }

      if (prompt.startsWith('/status')) {
        const session = sessionManager.activeSession;

        if (!session) {
          stream.markdown('No active BX session. Use `@bx /start your goal` to begin.');
          return;
        }

        stream.markdown([
          'Active BX session:',
          '',
          `- Session: \`${session.sessionId}\``,
          `- Goal: ${session.goal ?? 'Not informed'}`,
          `- Started at: ${session.startedAt}`
        ].join('\n'));
        return;
      }

      if (prompt.startsWith('/stop')) {
        const session = await sessionManager.stop();

        if (!session) {
          stream.markdown('No active BX session.');
          return;
        }

        stream.markdown(`BX session stopped: \`${session.sessionId}\``);
        return;
      }

      if (prompt.startsWith('/summary')) {
        const session = sessionManager.activeSession;

        if (!session) {
          stream.markdown('No active BX session to summarize.');
          return;
        }

        const events = await store.readEvents(session.sessionId);
        const summary = generateSummary(events);
        const uri = await store.writeSummary(session.sessionId, summary);

        stream.markdown(`BX summary generated: \`${uri.fsPath}\``);
        return;
      }

      await sessionManager.logUserMessage(prompt);

      const response = [
        'Logged this interaction as a structured BX chat event.',
        '',
        'Captured in this MVP:',
        '- raw user message',
        '- inferred intent',
        '- basic entities',
        '- basic risk flags',
        '- timestamp',
        '- active BX session'
      ].join('\n');

      await sessionManager.logAssistantResponse('Logged interaction and returned confirmation.', response);

      stream.markdown(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      stream.markdown(`BX error: ${message}`);
    }
  };

  const participant = vscode.chat.createChatParticipant('bx', handler);

  // Future: add an icon at resources/bx.png and uncomment this line.
  // participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'bx.png');

  return participant;
}
