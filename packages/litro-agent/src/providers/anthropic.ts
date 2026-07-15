/**
 * Anthropic provider adapter: fetch + manual SSE parsing over the Messages
 * API (`POST ${baseURL}/v1/messages`, `stream: true`). Mirrors the sibling
 * openai-compatible adapter's conventions (buffered line reader, single
 * `done` discipline, non-2xx -> one provider-error -> return) but the wire
 * format differs — Anthropic frames carry a leading `event: <type>` line
 * ahead of each `data: <json>` line, so both are tracked.
 *
 * Note: this reader (readLines) is a near-duplicate of the one in
 * openai-compatible.ts. Left un-shared for v0 per the task brief — flagged
 * here as a candidate consolidation (e.g. `src/providers/sse.ts`) once a
 * third SSE-based adapter shows up.
 */
import type { ChatMessage, Provider, ProviderEvent, ProviderRequest, ToolSpec } from './types.js';
import { AgentError } from '../errors.js';

/** Options for the anthropic provider factory. */
export interface AnthropicOptions {
  model: string;
  /** Falls back to process.env.ANTHROPIC_API_KEY. Missing key throws
   *  AgentError lazily, on the first stream() iteration. */
  apiKey?: string;
  baseURL?: string;
  maxTokens?: number;
}

interface WireContentBlockStart {
  type: 'text' | 'tool_use' | string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface WireDelta {
  type: 'text_delta' | 'input_json_delta' | string;
  text?: string;
  partial_json?: string;
}

interface WireUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface WireFrame {
  type?: string;
  message?: { usage?: WireUsage };
  index?: number;
  content_block?: WireContentBlockStart;
  delta?: WireDelta | { stop_reason?: string };
  usage?: WireUsage;
  error?: { type?: string; message?: string };
}

interface ToolCallAccumulator {
  id: string;
  name: string;
  input: string;
}

function toWireMessages(messages: ChatMessage[]): unknown[] {
  // The Messages API requires strict user/assistant alternation, and expects
  // all tool_result blocks belonging to one assistant turn to arrive in a
  // SINGLE immediately-following user message. A run of consecutive
  // `tool`-role ChatMessages (e.g. an assistant turn with multiple tool
  // calls) must therefore be merged into one wire user message, not emitted
  // as one user message per tool result — the latter produces consecutive
  // top-level user messages, which the API rejects.
  const out: unknown[] = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    if (m.role === 'tool') {
      const content: unknown[] = [];
      while (i < messages.length && messages[i].role === 'tool') {
        const tm = messages[i];
        content.push({ type: 'tool_result', tool_use_id: tm.toolCallId, content: tm.content });
        i++;
      }
      out.push({ role: 'user', content });
      continue;
    }
    out.push(toWireMessage(m));
    i++;
  }
  return out;
}

function toWireMessage(m: ChatMessage): unknown {
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    const content: unknown[] = [];
    if (m.content) content.push({ type: 'text', text: m.content });
    for (const tc of m.toolCalls) {
      content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
    }
    return { role: 'assistant', content };
  }
  return { role: m.role, content: m.content };
}

function toWireTool(t: ToolSpec): unknown {
  return { name: t.name, description: t.description, input_schema: t.parameters };
}

/** Buffers bytes across reads and yields complete lines (newline-delimited),
 *  including a trailing partial line once the stream ends. Same pattern as
 *  openai-compatible.ts's readLines. */
async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string, void, undefined> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
      }
      if (done) {
        const rest = buffer.replace(/\r$/, '');
        if (rest) yield rest;
        return;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Stream may already be closed or errored — nothing to cancel.
    }
    reader.releaseLock();
  }
}

/** Creates a `Provider` that speaks the Anthropic Messages API streaming
 *  wire format over `${baseURL}/v1/messages`. */
export function anthropic(opts: AnthropicOptions): Provider {
  return {
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent, void, undefined> {
      const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new AgentError('anthropic provider: missing API key (set apiKey or ANTHROPIC_API_KEY)');
      }

      const baseURL = opts.baseURL ?? 'https://api.anthropic.com';
      const maxTokens = opts.maxTokens ?? 4096;

      const res = await fetch(`${baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: maxTokens,
          stream: true,
          system: req.system,
          messages: toWireMessages(req.messages),
          tools: req.tools.map(toWireTool),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        yield {
          type: 'provider-error',
          message: `anthropic provider request failed with status ${res.status}: ${text.slice(0, 500)}`,
          status: res.status,
        };
        return;
      }

      if (!res.body) {
        yield { type: 'provider-error', message: 'anthropic provider response had no body' };
        return;
      }

      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      // Keyed by the frame's content-block `index`. Anthropic content blocks
      // don't interleave today, but keying defensively (matching the
      // sibling openai-compatible adapter's pattern) avoids silent
      // corruption if that ever changes.
      const toolAccumulators = new Map<number, ToolCallAccumulator>();
      let currentEvent = '';
      let doneEmitted = false;

      function* flushToolCall(acc: ToolCallAccumulator): Generator<ProviderEvent, void, undefined> {
        try {
          const input = JSON.parse(acc.input || '{}');
          yield { type: 'tool-call', id: acc.id, name: acc.name, input };
        } catch (err) {
          yield {
            type: 'provider-error',
            message: `anthropic provider: failed to parse tool input for "${acc.name}": ${
              err instanceof Error ? err.message : String(err)
            }`,
          };
        }
      }

      for await (const line of readLines(res.body)) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice('event: '.length).trim();
          continue;
        }
        if (!line.startsWith('data: ')) continue;

        const payload = line.slice('data: '.length);
        let frame: WireFrame;
        try {
          frame = JSON.parse(payload) as WireFrame;
        } catch {
          continue;
        }

        const eventType = currentEvent || frame.type;

        switch (eventType) {
          case 'message_start': {
            inputTokens = frame.message?.usage?.input_tokens;
            break;
          }
          case 'content_block_start': {
            if (frame.content_block?.type === 'tool_use') {
              toolAccumulators.set(frame.index ?? 0, {
                id: frame.content_block.id ?? '',
                name: frame.content_block.name ?? '',
                input: '',
              });
            }
            break;
          }
          case 'content_block_delta': {
            const delta = frame.delta as WireDelta | undefined;
            if (delta?.type === 'text_delta' && delta.text) {
              yield { type: 'text-delta', text: delta.text };
            } else if (delta?.type === 'input_json_delta') {
              const acc = toolAccumulators.get(frame.index ?? 0);
              if (acc) acc.input += delta.partial_json ?? '';
            }
            break;
          }
          case 'content_block_stop': {
            const index = frame.index ?? 0;
            const acc = toolAccumulators.get(index);
            if (acc) {
              yield* flushToolCall(acc);
              toolAccumulators.delete(index);
            }
            break;
          }
          case 'message_delta': {
            outputTokens = frame.usage?.output_tokens ?? outputTokens;
            break;
          }
          case 'message_stop': {
            const usage =
              inputTokens !== undefined || outputTokens !== undefined ? { inputTokens, outputTokens } : undefined;
            doneEmitted = true;
            yield usage ? { type: 'done', usage } : { type: 'done' };
            return;
          }
          case 'error': {
            yield {
              type: 'provider-error',
              message: `anthropic provider error: ${frame.error?.message ?? 'unknown error'}`,
            };
            return;
          }
          default:
            break;
        }
      }

      // Stream ended without a terminal `message_stop` frame — e.g. a
      // connection drop, the normal failure mode for a network stream. The
      // Provider contract requires exactly one terminal `done` on every
      // non-error path, so emit it here. Flush any content block left open
      // by the truncation first (its `content_block_stop` never arrived),
      // in ascending index order.
      if (!doneEmitted) {
        for (const index of [...toolAccumulators.keys()].sort((a, b) => a - b)) {
          const acc = toolAccumulators.get(index);
          if (acc) yield* flushToolCall(acc);
        }
        toolAccumulators.clear();
        const usage =
          inputTokens !== undefined || outputTokens !== undefined ? { inputTokens, outputTokens } : undefined;
        yield usage ? { type: 'done', usage } : { type: 'done' };
      }
    },
  };
}
