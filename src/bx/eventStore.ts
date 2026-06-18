import * as vscode from 'vscode';
import * as path from 'path';
import { BxChatEvent, BxSession } from './types';

export class BxEventStore {
  private workspaceRoot(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];

    if (!folder) {
      throw new Error('BX requires an open workspace folder.');
    }

    return folder.uri.fsPath;
  }

  private bxRoot(): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot(), '.bx'));
  }

  sessionDir(sessionId: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.workspaceRoot(), '.bx', 'sessions', sessionId));
  }

  async initRepository(): Promise<void> {
    const root = this.bxRoot();

    await vscode.workspace.fs.createDirectory(root);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root.fsPath, 'sessions')));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root.fsPath, 'reports')));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root.fsPath, 'policies')));
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root.fsPath, 'templates')));

    const configUri = vscode.Uri.file(path.join(root.fsPath, 'bx.yaml'));

    try {
      await vscode.workspace.fs.stat(configUri);
    } catch {
      const content = [
        'project:',
        '  name: ""',
        '  domain: ""',
        '',
        'capture:',
        '  chat: true',
        '  code_changes: false',
        '  terminal: false',
        '',
        'privacy:',
        '  store_raw_prompts: true',
        '  redact_secrets: true',
        '  store_locally_only: true',
        '',
        'governance:',
        '  sensitive_terms:',
        '    - paciente',
        '    - cpf',
        '    - prontuario',
        '    - prontuário',
        '    - senha',
        '    - token',
        '    - secret',
        ''
      ].join('\n');

      await vscode.workspace.fs.writeFile(configUri, Buffer.from(content, 'utf8'));
    }
  }

  async writeSession(session: BxSession): Promise<void> {
    const dir = this.sessionDir(session.sessionId);
    await vscode.workspace.fs.createDirectory(dir);

    const uri = vscode.Uri.file(path.join(dir.fsPath, 'session.json'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(JSON.stringify(session, null, 2), 'utf8'));
  }

  async appendEvent(event: BxChatEvent): Promise<void> {
    const dir = this.sessionDir(event.sessionId);
    await vscode.workspace.fs.createDirectory(dir);

    const uri = vscode.Uri.file(path.join(dir.fsPath, 'chat-events.jsonl'));
    const line = JSON.stringify(event) + '\n';

    let previous = '';

    try {
      const data = await vscode.workspace.fs.readFile(uri);
      previous = Buffer.from(data).toString('utf8');
    } catch {
      previous = '';
    }

    await vscode.workspace.fs.writeFile(uri, Buffer.from(previous + line, 'utf8'));
  }

  async readEvents(sessionId: string): Promise<BxChatEvent[]> {
    const uri = vscode.Uri.file(path.join(this.sessionDir(sessionId).fsPath, 'chat-events.jsonl'));

    try {
      const data = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(data).toString('utf8');

      return text
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as BxChatEvent);
    } catch {
      return [];
    }
  }

  async writeSummary(sessionId: string, content: string): Promise<vscode.Uri> {
    const dir = this.sessionDir(sessionId);
    await vscode.workspace.fs.createDirectory(dir);

    const uri = vscode.Uri.file(path.join(dir.fsPath, 'summary.md'));
    await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

    return uri;
  }
}
