import * as vscode from 'vscode';
import { BxEventStore } from './eventStore';
import { BxChatEvent, BxSession } from './types';
import { calculateTextObservability } from './textMetrics';

export class BxSessionManager {
  private currentSession?: BxSession;

  constructor(private readonly store: BxEventStore) {}

  get activeSession(): BxSession | undefined {
    return this.currentSession;
  }

  async init(): Promise<void> {
    await this.store.initRepository();
  }

  async start(goal?: string): Promise<BxSession> {
    await this.store.initRepository();

    const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name;
    const sessionId = this.createSessionId(goal);

    const session: BxSession = {
      sessionId,
      goal,
      workspaceName,
      startedAt: new Date().toISOString(),
      status: 'active'
    };

    this.currentSession = session;
    await this.store.writeSession(session);

    await this.store.appendEvent({
      id: this.createEventId(),
      type: 'bx.session.started',
      sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        goal,
        workspaceName
      }
    });

    return session;
  }

  async stop(): Promise<BxSession | undefined> {
    if (!this.currentSession) {
      return undefined;
    }

    this.currentSession.status = 'stopped';
    this.currentSession.stoppedAt = new Date().toISOString();

    await this.store.writeSession(this.currentSession);

    await this.store.appendEvent({
      id: this.createEventId(),
      type: 'bx.session.stopped',
      sessionId: this.currentSession.sessionId,
      timestamp: new Date().toISOString(),
      payload: {}
    });

    const stopped = this.currentSession;
    this.currentSession = undefined;

    return stopped;
  }

  async logUserMessage(rawText: string): Promise<void> {
    if (!this.currentSession) {
      await this.start();
    }

    const session = this.currentSession!;

    const event: BxChatEvent = {
      id: this.createEventId(),
      type: 'bx.chat.user_message',
      sessionId: session.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        rawText,
        command: this.detectCommand(rawText),
        inferredIntent: this.inferIntent(rawText),
        entities: this.extractEntities(rawText),
        riskFlags: this.detectRiskFlags(rawText),
        observability: calculateTextObservability(rawText)
      }
    };

    await this.store.appendEvent(event);
  }

  async logAssistantResponse(summary: string, rawResponse?: string): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    await this.store.appendEvent({
      id: this.createEventId(),
      type: 'bx.chat.assistant_response',
      sessionId: this.currentSession.sessionId,
      timestamp: new Date().toISOString(),
      payload: {
        summary,
        rawResponse,
        observability: calculateTextObservability(rawResponse ?? summary)
      }
    });
  }

  private createSessionId(goal?: string): string {
    const safeGoal = goal
      ? goal.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : 'session';

    return `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeGoal}`;
  }

  private createEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private detectCommand(text: string): string | undefined {
    const trimmed = text.trim();

    if (!trimmed.startsWith('/')) {
      return undefined;
    }

    return trimmed.split(/\s+/)[0];
  }

  private inferIntent(text: string): string {
    const lower = text.toLowerCase();

    if (lower.includes('crie') || lower.includes('gerar') || lower.includes('gere') || lower.includes('implemente') || lower.includes('faça')) {
      return 'create_or_generate_code';
    }

    if (lower.includes('explique') || lower.includes('entenda') || lower.includes('analise')) {
      return 'explain_or_analyze';
    }

    if (lower.includes('erro') || lower.includes('bug') || lower.includes('falha') || lower.includes('stack trace')) {
      return 'debug';
    }

    if (lower.includes('teste') || lower.includes('unitário') || lower.includes('pytest') || lower.includes('jest')) {
      return 'test';
    }

    if (lower.includes('refatore') || lower.includes('refatorar')) {
      return 'refactor';
    }

    return 'unknown';
  }

  private extractEntities(text: string): string[] {
    const lower = text.toLowerCase();
    const entities: string[] = [];

    const candidates = [
      ['patient', ['paciente', 'patient']],
      ['cpf', ['cpf']],
      ['medical_record', ['prontuário', 'prontuario']],
      ['appointment', ['consulta', 'agenda', 'appointment']],
      ['fastapi', ['fastapi']],
      ['react', ['react']],
      ['vscode', ['vscode', 'vs code']]
    ];

    for (const [entity, terms] of candidates) {
      if ((terms as string[]).some((term) => lower.includes(term))) {
        entities.push(entity as string);
      }
    }

    return entities;
  }

  private detectRiskFlags(text: string): string[] {
    const lower = text.toLowerCase();
    const flags: string[] = [];

    if (lower.includes('paciente') || lower.includes('cpf') || lower.includes('prontuário') || lower.includes('prontuario')) {
      flags.push('personal_or_health_data');
    }

    if (lower.includes('senha') || lower.includes('token') || lower.includes('secret') || lower.includes('api key')) {
      flags.push('secret_or_credential');
    }

    if (lower.includes('pagamento') || lower.includes('cartão') || lower.includes('cartao')) {
      flags.push('financial_data');
    }

    return flags;
  }
}
