import { join } from 'node:path';
import { defineAgentConfig } from '@beatzball/litro-agent';
import { fileSessionStore } from '@beatzball/litro-agent/sessions/file';

// Quarantine legacy shared logs, which may contain pre-authentication coder data.
export default defineAgentConfig({
  sessions: fileSessionStore({ dir: join(process.env.LITRO_AGENT_SESSIONS_DIR ?? '.litro/sessions', 'public-v2') }),
});
