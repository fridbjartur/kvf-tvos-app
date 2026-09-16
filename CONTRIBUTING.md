# Contributing to KVF

Follow [README.md](README.md) for local setup and [AGENTS.md](AGENTS.md) for repository conventions.

## Before submitting changes

1. Run `yarn check` (TypeScript, whole-project lint, and Jest).
2. Add a regression test for bug fixes; mock network and filesystem operations.
3. For UI changes, verify Apple TV remote focus and include a screenshot or recording.
4. For playback or native dependency changes, complete the relevant checks in [production verification](docs/production-readiness.md).
5. Keep commits focused and use `type: concise summary` messages.

Use Expo config plugins for persistent native configuration. The `ios/` and `android/` projects are generated; `yarn prebuild:tv` recreates them. Never commit `.env.local`, signing credentials, or generated build outputs.

Keep the watch-progress service and hook: they are intentionally reserved for future KVF viewing history. See [retained playback capabilities](docs/playback.md).
