import { defineAction } from '@beatzball/litro/actions';

// Canary: must appear in the server bundle and NEVER in dist/client/**.
// The externalization proof (Task 11) greps for it.
const SERVER_ONLY_SECRET = 'LITRO_CANARY_9f3a1c';

export async function getServerTime() {
  return { now: new Date(), secretLength: SERVER_ONLY_SECRET.length };
}

// Minimal hand-rolled Standard Schema validator — keeps the playground
// dependency-free. Any Standard Schema library (Zod, Valibot, ArkType)
// works here too.
const echoInput = {
  '~standard': {
    version: 1 as const,
    vendor: 'playground',
    validate(value: unknown) {
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as { text?: unknown }).text === 'string'
      ) {
        return { value: value as { text: string } };
      }
      return { issues: [{ message: 'expected { text: string }' }] };
    },
  },
};

export const echoUpper = defineAction({
  input: echoInput,
  async handler({ text }) {
    return { upper: text.toUpperCase(), at: new Date() };
  },
});

