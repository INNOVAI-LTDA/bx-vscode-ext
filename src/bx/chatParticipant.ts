import * as vscode from 'vscode';
import { BxSessionManager } from './sessionManager';
import { BxEventStore } from './eventStore';
import { generateSummary } from './summaryGenerator';
import { BxModelService } from './modelService';

export function registerBxChatParticipant(
  context: vscode.ExtensionContext,
  sessionManager: BxSessionManager,
  store: BxEventStore
): vscode.Disposable {
  const modelService = new BxModelService(context);

  const handler: vscode.ChatRequestHandler = async (
    request,
    _chatContext,
    stream,
    token
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


      if (prompt.startsWith('/models')) {
        const models = await modelService.listModels();
        const markdown = modelService.formatModelsAsMarkdown(models);

        const session = sessionManager.activeSession;
        if (session) {
          await sessionManager.logObservation('bx.model.available_models.listed', {
            count: models.length,
            models: models.map((model) => ({
              index: model.index,
              id: model.id,
              name: model.name,
              vendor: model.vendor,
              family: model.family,
              version: model.version,
              maxInputTokens: model.maxInputTokens
            }))
          });
        }

        stream.markdown(markdown);
        return;
      }


      if (prompt.startsWith('/model')) {
        stream.markdown(modelService.formatSelectedModelAsMarkdown());
        return;
      }

      if (prompt.startsWith('/use-model')) {
        const identifier = prompt.replace('/use-model', '').trim();

        if (!identifier) {
          stream.markdown([
            'Missing model identifier.',
            '',
            'Use one of these formats:',
            '',
            '- `@bx /use-model <index>`',
            '- `@bx /use-model <id>`',
            '',
            'Run `@bx /models` to list available models.'
          ].join('\n'));
          return;
        }

        const selectedModel = await modelService.selectModel(identifier);

        const session = sessionManager.activeSession;
        if (session) {
          await sessionManager.logObservation('bx.model.selected', {
            id: selectedModel.id,
            name: selectedModel.name,
            vendor: selectedModel.vendor,
            family: selectedModel.family,
            version: selectedModel.version,
            maxInputTokens: selectedModel.maxInputTokens
          });
        }

        stream.markdown(modelService.formatSelectionResultAsMarkdown(selectedModel));
        return;
      }

      if (prompt.startsWith('/clear-model')) {
        await modelService.clearSelectedModel();

        const session = sessionManager.activeSession;
        if (session) {
          await sessionManager.logObservation('bx.model.selection.cleared', {});
        }

        stream.markdown('BX explicit model selection cleared. Future prompts will use the first model returned by the VS Code Language Model API.');
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

      const userEventId = await sessionManager.logUserMessage(prompt);
      const modelRequestEventId = await sessionManager.logModelRequestStarted(userEventId);

      try {
        const result = await modelService.ask(prompt, stream, token);

        await sessionManager.logModelRequestCompleted({
          model: result.model,
          observability: result.observability
        }, modelRequestEventId ?? userEventId);

        await sessionManager.logAssistantResponse(
          'AI model response captured by BX.',
          result.text,
          userEventId,
          {
            model: result.model,
            observability: result.observability
          }
        );
      } catch (modelError) {
        const message = modelError instanceof Error ? modelError.message : String(modelError);

        await sessionManager.logModelRequestFailed(message, modelRequestEventId ?? userEventId, {
          fallback: 'logger_only'
        });

        const fallbackResponse = [
          'BX logged your message, but could not call a VS Code language model.',
          '',
          `Reason: ${message}`,
          '',
          'The session log is still valid. After configuring a language model provider in VS Code, send the prompt again through `@bx`.'
        ].join('\n');

        await sessionManager.logAssistantResponse(
          'Model call failed; BX returned logger-only fallback.',
          fallbackResponse,
          userEventId,
          {
            modelError: message,
            mode: 'logger_only_fallback'
          }
        );

        stream.markdown(fallbackResponse);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await sessionManager.logModelRequestFailed(message, undefined, { operation: 'chat_participant_handler' });
      stream.markdown(`BX error: ${message}`);
    }
  };

  const participant = vscode.chat.createChatParticipant('bx', handler);

  // Future: add an icon at resources/bx.png and uncomment this line.
  // participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'bx.png');

  return participant;
}
