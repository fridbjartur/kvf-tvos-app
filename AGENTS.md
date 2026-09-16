# Repository Guidelines

## Project Structure & Module Organization

KVF is an Expo Router app for KVF television and radio on Apple TV. Platform scaffolding lives in `android/`, `ios/`, and `Images.xcassets/`, while routed screens sit in `app/`. Shared UI primitives belong in `components/`, hooks in `hooks/`, and global state in `contexts/`. Playback and catalog clients live in `services/`; helpers and types stay in `utils/` and `types/`. Tests mirror their targets (e.g., `services/__tests__/kvfCache.test.ts`). Media assets live in `assets/`, and docs in `docs/`.

## Build, Test, and Development Commands

Install dependencies with `yarn install`. `yarn start` launches the Expo dev server. `yarn android` / `yarn ios` build and deploy to the respective simulators. Run `yarn lint` (ESLint + Prettier autofix) before pushing. Execute `yarn test`, `yarn test:watch`, or `yarn test:coverage` to validate logic, and use `yarn prebuild` or `yarn prebuild:tv` (sets `EXPO_TV=1`) when regenerating native projects.

## Coding Style & Naming Conventions

The codebase is TypeScript-first with strict ESLint and Prettier configs—use 2-space indentation, semicolons, and single quotes inside TS/TSX. Components and hooks follow `PascalCase` filenames (`VideoShelf.tsx`, `usePlayback.ts`). Utilities and services use `camelCase`. Keep styles beside components, prefer `StyleSheet.create`, and avoid editing generated outputs inside `android/` or `ios/` unless performing a native patch.

## Testing Guidelines

Jest (via `jest-expo`) drives the suite. Place specs in local `__tests__` folders and suffix files with `.test.ts(x)` or `.threading.test.ts(x)` for concurrency helpers. Mock network I/O within services, lean on `react-test-renderer` harnesses for hooks/contexts (RTL is not wired up here), and aim for ≥80% statement coverage when running `yarn test:coverage`. Every bugfix should ship with a regression test.

## Commit & Pull Request Guidelines

Follow the existing `type: concise summary` format (e.g., `fix: clear player queue`) and keep commits scope-limited. Reference issue IDs when applicable and bundle related asset/config updates with the code. Pull requests should include: a short purpose statement, testing steps (commands + expected outcome), screenshots or recordings for UI changes, and any follow-up tasks. Request reviews from platform owners when touching `services/` or device-specific modules.

## Security & Configuration Tips

Never commit secrets; rely on secure store APIs and Expo config values. The scraper API address is configured at build time through EXPO_PUBLIC_KVF_API_BASE_URL in .env.local; public Expo environment variables must not contain secrets. For TV builds, set `EXPO_TV=1` locally and verify the Apple/Android TV asset sets (`Images.xcassets/`, `app.json`) stay in sync with feature work.

## Intentionally Retained Code

Keep `services/watchProgressService.ts`, `hooks/useWatchProgress.ts`, and the progress tests for future KVF resume support. They are not currently connected to a route. Preserve native HLS/audio playback and episode prefetching; see `docs/playback.md`.
