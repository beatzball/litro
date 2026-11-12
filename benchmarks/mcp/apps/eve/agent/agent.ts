import { defineAgent } from 'eve';

// Required agent metadata; MCP calls execute the tool without invoking this model.
export default defineAgent({ model: 'openai/gpt-5.4' });
