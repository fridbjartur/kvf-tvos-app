# Playback capabilities

## Active audio and video support

KVF passes the API's stream URL directly to `react-native-video`, which uses AVPlayer on Apple TV. Keep these capabilities when changing playback:

- Native player controls and the stream's available audio/subtitle tracks.
- System-language audio-track selection and adaptive HLS stream selection. These are player defaults; see the [react-native-video v6 props](https://docs.thewidlarzgroup.com/react-native-video/docs/v6/component/props/).
- Direct live radio streams, including the HTTP AAC stream and its host-specific transport exception in `app.json`.
- Cached episode resolution and prefetching when an episode receives focus or Up Next appears.
- Background pause handling in `hooks/useVideoPlayback.ts`.

The removed custom audio loader was specific to Jellyfin: it added a `jellyfin-multi://` URL scheme, fetched one transcoding session per audio track using server credentials, and combined their manifests. KVF supplies playable stream URLs and no equivalent transcoding API, so that implementation provided no benefit to this app. Its Swift bridge, Expo plugin, JavaScript adapter, and dependency patch were removed together. Standard native audio support remains.

## Watch progress — retained for later

`services/watchProgressService.ts`, `hooks/useWatchProgress.ts`, and the service tests remain in the project deliberately. They are independent of server authentication and are not currently imported by any route.

The service stores up to 50 entries in the tvOS cache directory, using playback position, duration, and update time. The hook samples the native player's position every eight seconds and exposes `markEnded()` to clear completed episodes. The operating system may purge this cache; it is not permanent viewing-history storage.

Before enabling this feature, choose a stable KVF episode key containing section, program slug, and episode SID, connect duration and player refs, restore the saved position after loading, and add lifecycle tests for episode changes, backgrounding, and requests completing after unmount. The old Continue Watching UI depended on the template library API and was removed; a future KVF row should resolve metadata through the KVF catalog.
