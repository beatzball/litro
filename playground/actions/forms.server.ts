/**
 * Demo actions for the /forms page: guestbook writes via no-JS + enhanced
 * form posts, plus streaming demos. In-memory store — playground only.
 */
import { defineAction, type StandardSchemaV1 } from '@beatzball/litro/actions';

export interface GuestbookEntry {
  name: string;
  message: string;
  at: Date;
}

const entries: GuestbookEntry[] = [];

interface EntryInput {
  name: string;
  message: string;
}

// Hand-rolled Standard Schema (same pattern as demo.server.ts). STRICT about
// unknown keys — proves the _litro_csrf field is stripped before validation.
const entrySchema: StandardSchemaV1<unknown, EntryInput> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground',
    validate(value) {
      const v = value as Record<string, unknown> | null;
      if (!v || typeof v !== 'object') return { issues: [{ message: 'Expected an object' }] };
      const issues: { message: string }[] = [];
      if (typeof v.name !== 'string' || v.name.trim() === '') issues.push({ message: 'Name is required' });
      if (typeof v.message !== 'string' || v.message.trim() === '') issues.push({ message: 'Message is required' });
      for (const k of Object.keys(v)) {
        if (k !== 'name' && k !== 'message') issues.push({ message: `Unknown field: ${k}` });
      }
      if (issues.length > 0) return { issues };
      return { value: { name: (v.name as string).trim(), message: (v.message as string).trim() } };
    },
  },
};

export const addEntry = defineAction({
  input: entrySchema,
  form: { redirect: '/forms' },
  async handler(input) {
    entries.push({ ...input, at: new Date() });
    return { count: entries.length };
  },
});

export const addEntryWithToken = defineAction({
  input: entrySchema,
  csrf: 'token',
  form: { redirect: '/forms' },
  async handler(input) {
    entries.push({ ...input, at: new Date() });
    return { count: entries.length };
  },
});

export async function listEntries(): Promise<GuestbookEntry[]> {
  return entries.slice().reverse();
}

const countSchema: StandardSchemaV1<unknown, { from: number }> = {
  '~standard': {
    version: 1,
    vendor: 'litro-playground',
    validate(value) {
      const v = value as { from?: unknown } | null;
      const from = Number(v?.from);
      if (!Number.isInteger(from) || from < 1 || from > 10) {
        return { issues: [{ message: 'from must be an integer between 1 and 10' }] };
      }
      return { value: { from } };
    },
  },
};

export const countdown = defineAction({
  input: countSchema,
  async *handler({ from }) {
    for (let i = from; i >= 1; i--) {
      yield { i, at: new Date() };
    }
  },
});

export const failingStream = defineAction({
  input: countSchema,
  async *handler({ from }) {
    yield { i: from, at: new Date() };
    throw new Error('stream blew up');
  },
});
