import { defineTool } from 'eve/tools';
import { z } from 'zod';

export default defineTool({
  description: 'Get the current weather for a city.',
  inputSchema: z.object({ city: z.string().trim().min(1).max(80) }),
  async execute({ city }) {
    return { city, tempC: 21, summary: 'sunny' };
  },
});
