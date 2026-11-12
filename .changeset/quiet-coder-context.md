---
"@beatzball/litro-agent": patch
---

Pass the guarded HTTP request to MCP tool contexts and support an optional per-agent session store. Stdio tools continue to receive no request. Agents can now use validated HTTP identity in tools and isolate their durable history from other agents.
