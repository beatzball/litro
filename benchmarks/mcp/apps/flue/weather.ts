import { defineTool } from '@flue/runtime/tool';
import * as v from 'valibot';

export default defineTool({
  name: 'get-weather',
  description: 'Get the current weather for a city.',
  input: v.object({
    city: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  }),
  async run({ data: { city } }) {
    return { output: { city, tempC: 21, summary: 'sunny' } };
  },
});
