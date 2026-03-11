# Configuration Management

**Last Updated:** January 24, 2026

## Quick Reference

**Category:** Implementation
**Keywords:** configuration, credentials, SecureStore, demo mode, environment, settings, fallback

Smart three-tier configuration fallback system with SecureStore, development credentials, and demo mode support.

## Related Documentation

- [`CLAUDE-api-reference.md`](./CLAUDE-api-reference.md) - Configuration API methods
- [`CLAUDE-security.md`](./CLAUDE-security.md) - Credential security
- [`CLAUDE-development.md`](./CLAUDE-development.md) - Development environment setup

---

## Development vs Production Configuration

The app uses a smart fallback system:

### Development (with `.env.local`)

1. Checks SecureStore for user-configured settings
2. Falls back to `.env.local` credentials if empty
3. `syncDevCredentials()` runs on app load to populate SecureStore

### Production (App Store builds)

1. `.env.local` is NOT included (git-ignored)
2. Users must configure via Settings screen
3. Credentials stored securely in native secure storage

### Demo Mode (Testing without setup)

1. One-tap connection to Jellyfin's official demo server (`https://demo.jellyfin.org/stable`)
2. Credentials fetched dynamically via API (demo server resets hourly)
3. Stores demo credentials in SecureStore with `IS_DEMO_MODE` flag
4. Users can disconnect from demo and configure their own server anytime
5. Perfect for App Store reviewers or first-time users

### Demo Server Advanced Features

The `connectToDemoServer()` function supports cache management:

```typescript
connectToDemoServer(clearCaches: boolean = true)
```

**Parameters:**

- `clearCaches` (default: `true`): Controls cache behavior
  - `true`: Full cache clear (use when initially connecting to demo server)
  - `false`: Preserve UI state (use when refreshing expired credentials mid-session, e.g., during video playback)

## SecureStore Keys

| Key                     | Purpose                          | Type            |
| ----------------------- | -------------------------------- | --------------- |
| `jellyfin_server_url`   | Jellyfin server URL              | string          |
| `jellyfin_api_key`      | API authentication token         | string (hex)    |
| `jellyfin_user_id`      | User GUID                        | string (hex)    |
| `app_video_quality`     | Transcoding quality preset (0-3) | string (number) |
| `jellyfin_is_demo_mode` | Demo server connection flag      | "true" \| null  |

**Note:** All keys are stored in device Keychain via expo-secure-store.

## Protection Logic

The `syncDevCredentials()` function checks the `jellyfin_is_demo_mode` flag before syncing development credentials to SecureStore. This prevents `.env.local` credentials from overwriting demo server credentials during development.

## Configuration Initialization Pattern

The app uses `configInitPromise` to prevent race conditions between:

1. `syncDevCredentials()` writing to SecureStore (async, runs on app load)
2. Components calling `getConfig()` (sync, reads from cache)

**Solution:**

```typescript
let configInitPromise: Promise<void> | null = null;

export function waitForConfig(): Promise<void> {
  if (configInitPromise) return configInitPromise;
  return Promise.resolve();
}
```

Components that need guaranteed initialized config can await `waitForConfig()`.

## Configuration Migration

**Old Format (v1.x):**

- Separate keys: `JELLYFIN_SERVER_IP`, `JELLYFIN_SERVER_PORT`, `JELLYFIN_SERVER_PROTOCOL`
- Three discrete values combined into URL

**New Format (v2.x+):**

- Single key: `jellyfin_server_url` (full URL string)
- Simpler validation and usage

**Auto-Migration:**
On first load, `migrateOldConfigFormat()` in `services/jellyfinApi.ts`:

1. Checks for old keys in SecureStore
2. Combines into full URL format
3. Writes to new `jellyfin_server_url` key
4. Deletes old keys
5. One-time operation, no user intervention required

## Environment Variables

All environment variables must use `EXPO_PUBLIC_` prefix:

```bash
EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://localhost:8096
EXPO_PUBLIC_DEV_JELLYFIN_API_KEY=your_api_key
EXPO_PUBLIC_DEV_JELLYFIN_USER_ID=your_user_id
```

## Security Considerations

- Never commit `.env.local` (already in `.gitignore`)
- No hardcoded credentials in source code
- ATS (App Transport Security) allows HTTP for all networks (HTTPS recommended for internet servers)
- Credentials stored in device Keychain

### API Key in URLs (Jellyfin Limitation)

The API key must be included in query parameters for certain URLs consumed by native components:

- **Image URLs:** Poster/thumbnail URLs passed to `<Image>` components
- **Video URLs:** Stream URLs passed to `react-native-video` player
- **Download URLs:** Direct file download URLs

This is a Jellyfin API requirement - these native components cannot add custom headers to requests. The API key will appear in:

- Server access logs
- Browser history (web platform)
- Network capture tools during debugging

**Mitigations:**

- Use HTTPS for remote servers (encrypts URLs in transit)
- API keys have limited scope (Jellyfin API access only, not system-level)
- Users can regenerate API keys from Jellyfin dashboard if compromised
- For maximum security, use a dedicated API key for this app with minimal permissions

## Testing Production Behavior

To test the app without dev credentials:

```bash
mv .env.local .env.local.backup
npm start
# App will require manual configuration via Settings screen
mv .env.local.backup .env.local
```

## Settings Screen Implementation

The Settings screen (`app/(tabs)/settings.tsx`) uses specialized patterns for credential management and UI state synchronization.

### Auto-Reload Pattern

The settings screen uses `useFocusEffect` instead of `useEffect` to reload credentials whenever the screen comes into focus:

```typescript
useFocusEffect(
  useCallback(() => {
    loadSettings();
  }, []),
);
```

This ensures:

- Demo server credentials are visible after connecting from error screens
- Settings always reflect current SecureStore state
- Multi-screen workflows work seamlessly

### Form State Management

Uses refs (`currentServerUrl.current`) alongside state to maintain sync between input fields and validation logic without causing unnecessary re-renders.

### Demo Mode UI

Demo server connection is NOT available from Settings screen (removed in commit 740d791). Demo mode is only accessible via:

- "Try Demo Server" button on Library error screen
- Programmatic `connectToDemoServer()` calls
