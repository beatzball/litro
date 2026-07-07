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

export interface Provider {
  stream(req: ProviderRequest): AsyncIterable<ProviderEvent>;
}
