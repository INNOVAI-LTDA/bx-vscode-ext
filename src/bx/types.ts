export type BxSessionStatus = 'active' | 'stopped';

export interface BxSession {
  sessionId: string;
  goal?: string;
  workspaceName?: string;
  startedAt: string;
  stoppedAt?: string;
  status: BxSessionStatus;
}

export type BxEventType =
  | 'bx.session.started'
  | 'bx.session.stopped'
  | 'bx.chat.user_message'
  | 'bx.chat.assistant_response';

export interface BxTextObservability {
  totalchars: number;
  estimatedTokens: number;
  tokenCountingMethod: 'totalchars/4';
}

export interface BxChatEvent {
  id: string;
  type: BxEventType;
  sessionId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface BxUserMessagePayload {
  rawText: string;
  command?: string;
  inferredIntent?: string;
  entities?: string[];
  riskFlags?: string[];
  observability?: BxTextObservability;
}
