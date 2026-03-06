# Contributing

NanoClaw is the runnable Qwen/WhatsApp app. Contributions should stay focused on the current runtime, its tests, and its operational docs.

## Good Changes

- Bug fixes
- Security fixes
- Simplifications and refactors that reduce operational complexity
- Runtime-focused improvements that fit the current product scope
- Test coverage and documentation updates for the live Qwen harness

## Out Of Scope Here

- The old skills/customization system
- Provider-agnostic template tooling for downstream forks
- Archived Claude-specific workflows

Customization tooling no longer lives in this repo. If that work returns, it should live in a separate customizations repo.

## Expectations

- Keep changes scoped and reviewable.
- Update tests when behavior changes.
- Update docs when setup, runtime behavior, or operator workflows change.
- Avoid unrelated cleanup in the same change.

## Verification

Before opening a PR, run:

```bash
npm run build
npm test
```
