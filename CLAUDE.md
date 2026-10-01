# KVF project context

KVF is an independent Apple TV client for KVF television and radio. It uses Expo Router, React Native TV, `react-native-video`, and a separately deployed KVF scraper API.

Read [AGENTS.md](AGENTS.md) for repository guidelines and [README.md](README.md) for setup and commands. See [TV navigation](docs/tv-navigation.md) and [production verification](docs/production-readiness.md) before changing playback or focus behavior.

## Preserve intentionally

- Watch progress and Continue Watching are live: `services/watchProgressService.ts` (store), `services/watchProgressStorage.ts` (NSUserDefaults on tvOS, not the purgeable cache directory), `hooks/useWatchProgress.ts` (player), and `hooks/useWatchHistory.ts` (UI bindings). See [playback](docs/playback.md#watch-progress-and-continue-watching). Player routes for episodes must keep passing `section`, `programSlug`, `episodeSid`, `programTitle`, `thumb` and `programThumb`.
- Native HLS playback, audio-track selection, radio streams, and episode prefetching are the playback capabilities used by KVF. There is no custom transcoding server or custom media protocol.
- `Images.xcassets/` and the two images referenced by `app.json` are active build assets.
- Keep all source artwork, icon layers, flattened exports, screenshots, and image documentation, including `assets/` and `_bg.psd`. These are intentionally retained even when not imported by application code.

## Development

- Start Metro with `yarn start` before launching a Debug app from Xcode, or use `yarn ios:device`.
- A local Release install uses `yarn ios:device:release --no-bundler`; this does not publish anything.
- Run `yarn check` before completing changes. Test remote focus, audio/video playback, and sleep behavior on Apple TV when relevant.
- `.env.local` contains local build configuration. Never print its contents or commit secrets.
