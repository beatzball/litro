---
'@beatzball/litro-agent': minor
---

Agent tools now reach the provider with a real JSON Schema for their input. When a tool's Standard Schema vendor implements the Standard JSON Schema converter (`~standard.jsonSchema.input`), the loop sends that schema, so the model sees field names, types and required fields. A vendor without a converter, a converter that throws, or a result that is not an object schema still sends `{ type: 'object' }`, as before.
