/**
 * Demo server action. Every export of a *.server.ts module becomes a public
 * endpoint — validate anything that touches data with an input schema.
 * This module and its imports never enter the client bundle.
 */
import { defineAction, type StandardSchemaV1 } from '@beatzball/litro/actions';

const greetSchema: StandardSchemaV1<unknown, { name: string }> = {
  '~standard': {
    version: 1,
    vendor: '{{projectName}}',
    validate(value) {
      const v = value as { name?: unknown } | null;
      if (typeof v?.name !== 'string' || v.name.trim() === '') {
        return { issues: [{ message: 'Name is required' }] };
      }
      return { value: { name: v.name.trim() } };
    },
  },
};

export const greet = defineAction({
  input: greetSchema,
  async handler({ name }) {
    return { greeting: `Hello, ${name}!`, at: new Date() };
  },
});
