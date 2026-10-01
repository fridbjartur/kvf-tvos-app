# Playback capabilities

## Active audio and video support

KVF passes the API's stream URL directly to `react-native-video`, which uses AVPlayer on Apple TV. Keep these capabilities when changing playback:

- Native player controls and the stream's available audio/subtitle tracks.
- System-language audio-track selection and adaptive HLS stream selection. These are player defaults; see the [react-native-video v6 props](https://docs.thewidlarzgroup.com/react-native-video/docs/v6/component/props/).
- Direct live radio streams, including the HTTP AAC stream and its host-specific transport exception in `app.json`.
- Cached episode resolution and prefetching when an episode receives focus or Up Next appears.
- Background pause handling in `hooks/useVideoPlayback.ts`.

The removed custom audio loader was specific to Jellyfin: it added a `jellyfin-multi://` URL scheme, fetched one transcoding session per audio track using server credentials, and combined their manifests. KVF supplies playable stream URLs and no equivalent transcoding API, so that implementation provided no benefit to this app. Its Swift bridge, Expo plugin, JavaScript adapter, and dependency patch were removed together. Standard native audio support remains.

## Up Next

On tvOS the native `AVPlayerViewController` owns remote focus, so React views drawn over it can never take focus. `modules/kvf-up-next` (a local Expo module, autolinked on prebuild) therefore adds a **Næsta sending** button to the player's own transport bar via `transportBarCustomMenuItems`. It sits in the row above the scrubber, next to the audio and subtitle buttons. It appears with the native controls, and up/down move between it and the scrubber as usual. Other transport bar items are kept.

- In the last 20 seconds (at most half the episode), `components/up-next-overlay.tsx` shows a passive card (artwork, title, countdown) in the bottom right, above the transport bar. It never takes focus.
- When the episode ends, the next one starts automatically. The card stays up at 0 seconds until it does. Seeking back out of the window hides it.
- If no native player controller is found, or on iOS and Android, the card shows its own **Spæl nú** button instead.

Rejected on tvOS: a floating contextual action (`contextualActions`) appears on Apple's schedule and takes over the remote while focused. Hiding the native controls for a takeover screen removes scrubbing. `contextualActionsInfoView` and `contextualActionsPreviewImage` are iOS-only.

After changing the module's native code, regenerate the native project with `yarn prebuild:tv`.

## Watch progress and Continue Watching

Episodes resume where they were left, show their progress, and feed the home screen's **Halt fram at hyggja** row. Live streams are never recorded. History is stored on the device only.

### Storage

`services/watchProgressStorage.ts` holds one JSON value. On Apple platforms it is stored in `NSUserDefaults` through React Native's `Settings`, the only app storage tvOS keeps: Documents is not writable, and the Caches directory (used for the catalog) may be purged whenever the app is not running. tvOS caps `NSUserDefaults` at 500 KB per app. The history is capped at 600 episodes and 40 programs, about 70 KB at most. `Settings` reads are synchronous, so the row renders on its first frame. Android uses an atomically written file in the document directory.

### Model (`services/watchProgressService.ts`)

- **episodes**, keyed `section:programSlug:sid`: position, full duration, completed, and update time. These drive resume, the progress bars, and the **Sæð** badges on episode cards.
- **programs**, keyed `section:programSlug`: the single episode the program's Continue Watching card points at, with the titles and artwork needed to draw it offline.

Rules:

- Nothing is recorded before 10 seconds, and positions below that never overwrite saved progress. An episode Up Next has started shows "Næsta sending" on its card until then, and its own progress after.
- At 95% of the runtime, when the episode ends, or when the viewer chooses Up Next, the episode is marked watched. Its card moves on to the next episode in the queue. If it was the last episode, the card leaves the row.
- Resume starts 3 seconds before the saved position. Watching a finished episode again returns it to in-progress after 30 seconds; a briefer look keeps its **Sæð** badge.
- The row shows up to 20 programs, most recently watched first. Programs untouched for 90 days drop off. Evicting old episodes never removes one that a card points at.
- Entries are immutable, and UI binds through `useSyncExternalStore` (`hooks/useWatchHistory.ts`). A card re-renders only when its own entry changes; the row's array keeps its identity until a program changes.
- Writes reach storage at most every 10 seconds during playback, and immediately on pause, close, end, and skip. `startWatchProgressSync` (root layout) flushes when the app leaves the foreground.

### Player (`hooks/useWatchProgress.ts`)

The hook reads `currentTime` from the player's `onProgress` events, which are already subscribed for Up Next, instead of polling the native player. It records every 5 seconds of movement, including seeks. When the stream reports no duration on load, the duration is taken from `seekableDuration`, so the bar can always be drawn.

The saved position is read once per session. A resumed episode mounts with `paused` held true and behind the loader. It seeks on load, and the hold is released on `onSeek`, on the first progress sample at the target, or after 4 seconds. Do not replace this with a plain seek while playing. On tvOS, AVPlayer pauses itself for that seek while the `paused` prop stays `false`, so nothing would start it again and the viewer would have to press Play. Releasing the hold flips the prop to `false`, which always starts playback. After Retry, the reload returns to the position playback had reached. The player tracks an episode only when its route carries `section`, `programSlug`, and `episodeSid`. `programTitle`, `thumb`, and `programThumb` carry the card's metadata, and auto-advance passes them on with the program's own slug, so a whole series lands on one card. `fromStart=true` ignores saved progress.

### Screens

- **Home:** Select on a Continue Watching card resumes playback directly; holding Select opens the program page. Resuming takes the stream URL from the episode cache. The Up Next queue comes from the cached program page only, because a cold program scrape can take most of a minute. If the stream cannot be resolved, the program page opens instead.
- **Program:** The episode to continue is preselected, and focus starts on **Halt fram** (Resume), with **Frá byrjan** (Start Over) beside it. The focused episode's info shows the minutes left.
