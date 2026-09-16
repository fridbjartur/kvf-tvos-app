# Production verification

## Automated checks

Run `yarn check` and a production iOS export before shipping. CI checks types, lint, and tests on pull requests to `main`.

Regression coverage exercises real player/program components for repeated Play/End events, Back during a pending episode lookup, missing streams, episode transitions, background pauses, and live playback with a leftover queue. API/cache tests cover conditional requests, retries, invalid payloads, offline search recovery, cross-section programs, concurrent writes, failed disk writes, and eviction. UI tests cover focus navigation, canonical program routes, and bounded carousel images.

Template-only tests have been removed. The retained watch-progress tests cover future persistence support. A successful Expo export verifies JavaScript bundling, not native compilation, signing, or hardware playback.

### Verified after template cleanup

- TypeScript passes, including `--noUnusedLocals --noUnusedParameters`.
- Whole-project ESLint passes.
- Jest: 16 suites, 189 tests pass, including watch-progress persistence.
- Production iOS export passes.
- Regenerated native projects use `dev.fridbjartur.kvf`; the removed audio bridge and SecureStore are absent from the native dependency configuration.
- Unsigned tvOS Simulator Release build passes for arm64 and x86_64.

Physical-device signing, remote focus, playback, and sleep behavior still require the device checks below. The new identifier installs a separate app with separate storage.

## Required checks on Apple TV

Use a locally signed Release installation and open it from the Home Screen after stopping Xcode debugging. No TestFlight upload is required for this workflow.

- Browse all television and radio sections. Confirm remote focus returns correctly after opening and closing a program, changing tabs, and navigating the radio stack.
- Search for television, radio, and featured-only programs. Open a program linked from a different section.
- Play a normal episode, pause/resume with native controls, seek near the end, and confirm exactly one next episode starts in broadcast order.
- Press Back while an episode lookup is slow. The player must not reopen when the request completes.
- Play each live television/radio channel. A live stream must not show an unrelated Up Next queue. Confirm audio-only playback, including the HTTP radio stream.
- Background the app while playing, then return. Playback must remain paused until resumed using player controls.
- Put the Apple TV to sleep with Xcode closed and the Mac disconnected. Confirm it stays asleep; automated tests cannot establish the device's wake source.
- Start with the API unavailable, then restore connectivity and select Retry. Repeat after warming the cache to confirm stale catalog pages remain usable.
- Update a program's artwork/catalog on the API, refresh, and confirm new images appear without focus jumping.

## Deployment constraints

- The scraper API is a separate service and was not audited here. A private LAN address works only on that network. Set the intended reachable endpoint before creating a Release build.
- The current transport configuration supports the existing LAN API and KVF's HTTP radio stream. Do not remove transport exceptions without testing those paths; do not expose a private API publicly without reviewing its deployment separately.
- Physical installation requires working signing/provisioning. App Store/TestFlight distribution is a separate workflow.
- Cache format version 4 invalidates older cached payloads once. The first launch after this change fetches the catalog again.
- Native dependencies are pinned by the lockfile; the TV image config plugin remains active. Native builds and the device checklist are still required after dependency changes.
