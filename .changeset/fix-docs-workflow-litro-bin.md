---
---

Fix docs deploy workflow invoking litro CLI directly via node to avoid pnpm bin resolution failure (dist/cli/index.js doesn't exist at install time)
