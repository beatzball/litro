export interface ToolCallPart {
  id: string;
  name: string;
  input: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCalls?: ToolCallPart[];
  toolCallId?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type ProviderEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-call'; id: string; name: string; input: unknown }
  | { type: 'done'; usage?: { inputTokens?: number; outputTokens?: number } }
  | { type: 'provider-error'; message: string; status?: number };

export interface ProviderRequest {
  system: string;
  messages: ChatMessage[];
  tools: ToolSpec[];
}

/** Static identity of a provider, used for telemetry attribution
 *  (`gen_ai.provider.name` / `gen_ai.request.model`). Optional so a
 *  hand-rolled `Provider` stays a one-method object. */
export interface ProviderInfo {
  /** Semconv `gen_ai.provider.name` value, e.g. 'openai', 'anthropic'. */
  system: string;
  /** Semconv `gen_ai.request.model` value. */
  model: string;
}

export interface Provider {
  /** Optional static identity; the turn loop reads it for span attributes
   *  and omits those attributes entirely when it is absent. */
  info?: ProviderInfo;
  stream(req: ProviderRequest): AsyncIterable<ProviderEvent>;
}
