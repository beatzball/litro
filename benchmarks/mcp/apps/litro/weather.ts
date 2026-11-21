import { defineTool } from '@beatzball/litro-agent';
import { z } from 'zod';

export const weather = defineTool({
  description: 'Get the current weather for a city.',
  input: z.object({
    city: z.string().trim().min(1).max(80).describe('The city name, e.g. "Lisbon".'),
  }),
  app: 'weather',
  async execute({ city }) {
    return { city, tempC: 21, summary: 'sunny' };
  },
});
