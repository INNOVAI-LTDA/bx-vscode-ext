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
  | 'bx.chat.assistant_response'
  | 'bx.model.request.started'
  | 'bx.model.request.completed'
  | 'bx.model.request.failed'
  | 'bx.model.available_models.listed'
  | 'bx.model.selected'
  | 'bx.model.selection.cleared';

export interface BxTextObservability {
  totalchars: number;
  estimatedTokens: number;
  tokenCountingMethod: 'totalchars/4';
}

export interface BxModelInfo {
  id?: string;
  name?: string;
  vendor?: string;
  family?: string;
  version?: string;
}

export interface BxModelObservability extends BxTextObservability {
  latencyMs?: number;
  streamed?: boolean;
  billingAvailable: boolean;
}

export interface BxChatEvent {
  id: string;
  type: BxEventType;
  sessionId: string;
  timestamp: string;
  parentEventId?: string;
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

export interface BxModelResponsePayload {
  summary: string;
  rawResponse: string;
  model?: BxModelInfo;
  observability: BxModelObservability;
}
