/**
 * OpenAI-compatible provider adapter: fetch + manual SSE line parsing (the
 * repo's own reader pattern — TextDecoder + buffered line splitter over
 * `res.body.getReader()`, no EventSource, no SDK). Works against any server
 * that speaks the OpenAI `/chat/completions` streaming wire format (OpenAI
 * itself, Ollama, vLLM, LM Studio, etc).
 */
import type { ChatMessage, Provider, ProviderEvent, ProviderRequest, ToolSpec } from './types.js';

/** Options for the openai-compatible provider factory. */
export interface OpenAICompatibleOptions {
  baseURL: string;
  model: string;
  /** Falls back to process.env.OPENAI_API_KEY. Auth header is only sent when
   *  a key resolves — local runtimes (Ollama, LM Studio) need none. */
  apiKey?: string;
  headers?: Record<string, string>;
}

interface WireToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface WireChoice {
  delta?: { content?: string; tool_calls?: WireToolCallDelta[] };
  finish_reason?: string | null;
}

interface WireFrame {
  choices?: WireChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

interface ToolCallAccumulator {
  id?: string;
  name?: string;
  arguments: string;
}

function toWireMessages(req: ProviderRequest): unknown[] {
  const out: unknown[] = [{ role: 'system', content: req.system }];
  for (const m of req.messages) {
    out.push(toWireMessage(m));
  }
  return out;
}

function toWireMessage(m: ChatMessage): unknown {
  if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: m.content,
      tool_calls: m.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    };
  }
  if (m.role === 'tool') {
    return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
  }
  return { role: m.role, content: m.content };
}

function toWireTool(t: ToolSpec): unknown {
  return {
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  };
}

/** Buffers bytes across reads and yields complete lines (newline-delimited),
 *  including a trailing partial line once the stream ends. A single SSE
 *  frame's `data: ...` line may arrive split across separate network chunks
 *  — this is what makes that safe. */
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

/** Creates a `Provider` that speaks the OpenAI-compatible streaming chat
 *  completions wire format over `${baseURL}/chat/completions`. */
export function openaiCompatible(opts: OpenAICompatibleOptions): Provider {
  return {
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent, void, undefined> {
      const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      Object.assign(headers, opts.headers ?? {});

      const res = await fetch(`${opts.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: opts.model,
          stream: true,
          messages: toWireMessages(req),
          tools: req.tools.map(toWireTool),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        yield {
          type: 'provider-error',
          message: `openai-compatible provider request failed with status ${res.status}: ${text.slice(0, 500)}`,
          status: res.status,
        };
        return;
      }

      if (!res.body) {
        yield { type: 'provider-error', message: 'openai-compatible provider response had no body' };
        return;
      }

      const accumulators = new Map<number, ToolCallAccumulator>();
      let usage: { inputTokens?: number; outputTokens?: number } | undefined;

      function* flush(): Generator<ProviderEvent, void, undefined> {
        for (const [index, entry] of accumulators) {
          try {
            const input = JSON.parse(entry.arguments || '{}');
            yield { type: 'tool-call', id: entry.id ?? String(index), name: entry.name ?? '', input };
          } catch (err) {
            yield {
              type: 'provider-error',
              message: `openai-compatible provider: failed to parse arguments for tool call "${
                entry.name ?? entry.id ?? index
              }": ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        }
        accumulators.clear();
      }

      for await (const line of readLines(res.body)) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice('data: '.length);
        if (payload === '[DONE]') break;

        let frame: WireFrame;
        try {
          frame = JSON.parse(payload) as WireFrame;
        } catch {
          continue;
        }

        if (frame.usage) {
          usage = {
            inputTokens: frame.usage.prompt_tokens,
            outputTokens: frame.usage.completion_tokens,
          };
        }

        const choice = frame.choices?.[0];
        const delta = choice?.delta;

        if (delta?.content) {
          yield { type: 'text-delta', text: delta.content };
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const entry = accumulators.get(tc.index) ?? { arguments: '' };
            if (tc.id !== undefined) entry.id = tc.id;
            if (tc.function?.name !== undefined) entry.name = tc.function.name;
            if (tc.function?.arguments !== undefined) entry.arguments += tc.function.arguments;
            accumulators.set(tc.index, entry);
          }
        }

        if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'stop') {
          yield* flush();
        }
      }

      yield* flush();
      yield usage ? { type: 'done', usage } : { type: 'done' };
    },
  };
}
