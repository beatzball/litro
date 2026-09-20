---
"@beatzball/create-litro": minor
---

A recipe can now build on another recipe, and can ask its own questions.

- `extends` on a recipe config copies a base recipe's templates in first:
  base `template/`, base `template-<adapter>/`, then the recipe's own
  `template/` and `template-<adapter>/`. Later layers overwrite earlier ones.
  One level only — a deeper chain, an unknown base, or a recipe that extends
  itself is refused with a message naming both recipes.
- The scaffolded `litro.recipe.json` now names the recipe the user chose rather
  than the template the file came from, and records the resolved recipe options
  under `options`.
- Blog removal moved into one shared function. `--for-repo` without
  `--with-blog` behaves exactly as before; a recipe that offers a `blog` option
  gets the same removal, minus the repository link there is nothing to point at.
- `--blog` and `--no-blog` answer a recipe's blog question without a prompt,
  for scripts and CI. A flag for a question the chosen recipe does not ask is
  an error rather than a silently ignored argument.
- `--for-repo` now accepts any recipe that is, or extends, `starlight`.
