# KVF for Apple TV

An Expo Router app for browsing KVF television and radio programs, playing episodes, searching the catalog, and listening to or watching live channels. Built with React Native TV and `react-native-video`.

This is an independent client. Catalog metadata comes from a separately deployed `kvf-scraper-api`; media streams come from KVF.

## Requirements

- Node.js compatible with `package.json` (Node 22.13 or newer in the 22.x line is supported).
- Yarn 1.22.
- Xcode with a tvOS SDK for native Apple TV builds.
- A running KVF scraper API reachable from the Apple TV.
- Appropriate local signing/provisioning for installation on a physical device.

## Setup

```sh
yarn install --frozen-lockfile
cp .env.example .env.local
```

Set `EXPO_PUBLIC_KVF_API_BASE_URL` in `.env.local` to your API address. Use an address the **Apple TV** can reach; `localhost` on a device refers to that device. The URL is embedded at build time, so changing it requires restarting Metro in development or rebuilding a Release app. The development fallback is `http://192.168.1.10:3939`.

`EXPO_PUBLIC_*` values are visible in the shipped application. Never put credentials or secrets in them. `.env.local` is ignored by Git.

```sh
yarn start                # Metro development server
yarn ios                  # Build/run on a simulator
yarn ios:device           # Build/run on a selected device
```

`yarn prebuild:tv` regenerates the ignored native projects from Expo configuration and plugins. It runs with `--clean`; preserve any local native changes before using it. Native changes that must survive regeneration belong in `plugins/` or a reviewed dependency patch in `patches/`.

## Local Release build

```sh
yarn ios:device:release --no-bundler
```

This builds and installs locally; it does not upload to TestFlight or the App Store. Device signing still applies. Stop any Xcode debugging session and quit Xcode after testing, then launch KVF from the Apple TV Home Screen. Release playback should also be checked with the Mac disconnected.

The app pauses playback when it enters the background and does not automatically resume on foregrounding. Resume with the native player controls. This behavior does not establish the cause of any device-level wake problem; verify sleep on the physical device.

## Validation

```sh
yarn check
```

This runs TypeScript, ESLint/Prettier checks, and Jest. `yarn lint` applies lint fixes. The PR workflow runs the same three checks. For a production JavaScript bundle without device signing:

```sh
CI=1 yarn expo export --platform ios --output-dir /tmp/kvf-export
```

See [production verification](docs/production-readiness.md) for device checks and the limits of automated validation.

## Structure

- `app/`: television/radio tabs, live schedules, search, program details, player.
- `components/`: shared UI and TV focus handling.
- `services/kvfApi.ts`, `kvfPayload.ts`: conditional HTTP requests and payload validation.
- `services/kvfCache.ts`, `kvfPreload.ts`: bounded persistent cache and coordinated refresh.
- `hooks/useKvfResource.ts`, `useVideoPlayback.ts`: resource and playback lifecycles.
- `contexts/PlayQueueContext.tsx`: broadcast-order episode queue.

The cache uses the tvOS cache directory, which the OS may purge. Cached catalog pages remain usable during network failures; playing media still requires access to its stream. Background refreshes preserve object identity when content is unchanged, helping retain TV focus.

The repository originated from [TomoTV](https://github.com/keiver/tomotv). Some legacy Jellyfin services, tests, assets, and native plugins remain for now; the active KVF route tree does not provide Jellyfin authentication, transcoding, or continue-watching features. The legacy multi-audio plugin is no longer registered at KVF startup.

## License

[MIT](LICENSE).
