import * as vscode from 'vscode';
import { BxEventStore } from './bx/eventStore';
import { BxSessionManager } from './bx/sessionManager';
import { generateSummary } from './bx/summaryGenerator';
import { registerBxChatParticipant } from './bx/chatParticipant';

export function activate(context: vscode.ExtensionContext) {
  const store = new BxEventStore();
  const sessionManager = new BxSessionManager(store);

  context.subscriptions.push(
    vscode.commands.registerCommand('bx.init', async () => {
      try {
        await sessionManager.init();
        vscode.window.showInformationMessage('BX initialized. Created .bx/ repository layer.');
      } catch (error) {
        vscode.window.showErrorMessage(`BX init failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bx.start', async () => {
      try {
        const goal = await vscode.window.showInputBox({
          title: 'BX Session Goal',
          prompt: 'What are you working on?',
          placeHolder: 'Example: cadastro de pacientes'
        });

        const session = await sessionManager.start(goal);
        vscode.window.showInformationMessage(`BX session started: ${session.sessionId}`);
      } catch (error) {
        vscode.window.showErrorMessage(`BX start failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bx.status', async () => {
      const session = sessionManager.activeSession;

      if (!session) {
        vscode.window.showInformationMessage('No active BX session.');
        return;
      }

      vscode.window.showInformationMessage(`Active BX session: ${session.sessionId}`);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bx.summary', async () => {
      try {
        const session = sessionManager.activeSession;

        if (!session) {
          vscode.window.showWarningMessage('No active BX session.');
          return;
        }

        const events = await store.readEvents(session.sessionId);
        const summary = generateSummary(events);
        const uri = await store.writeSummary(session.sessionId, summary);

        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc);
      } catch (error) {
        vscode.window.showErrorMessage(`BX summary failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('bx.stop', async () => {
      try {
        const session = await sessionManager.stop();

        if (!session) {
          vscode.window.showWarningMessage('No active BX session.');
          return;
        }

        vscode.window.showInformationMessage(`BX session stopped: ${session.sessionId}`);
      } catch (error) {
        vscode.window.showErrorMessage(`BX stop failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    })
  );

  context.subscriptions.push(registerBxChatParticipant(context, sessionManager, store));
}

export function deactivate() {}
