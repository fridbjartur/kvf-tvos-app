# TomoTV Development Setup

## Quick Reference

**Category:** Deployment
**Keywords:** development, setup, environment, credentials, .env.local, configuration

Local development configuration with auto-configured server URLs and smart fallback system for credentials.

## Related Documentation

- [`CLAUDE-configuration.md`](./CLAUDE-configuration.md) - Development configuration
- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - Development workflow
- [`CLAUDE-apple-store-checklist.md`](./CLAUDE-apple-store-checklist.md) - Build process for submission

---

## Local Development Configuration

### Quick Start

1. **Copy the environment template:**

   ```bash
   cp .env.example .env.local
   ```

2. **Add your Jellyfin credentials to `.env.local`:**

   ```bash
   # Server URL is auto-configured! Just add:
   EXPO_PUBLIC_DEV_JELLYFIN_API_KEY=your_api_key_here
   EXPO_PUBLIC_DEV_JELLYFIN_USER_ID=your_user_id_here
   ```

3. **Start the development server:**
   ```bash
   npm start
   ```

That's it! The app will:

- ✅ **Auto-detect** your Mac's network IP (falling back to `localhost` if needed)
- ✅ Keep `.env.local` in sync before each start so simulators and TVs point at the same machine

---

## How It Works

### Development vs Production

The app uses a **smart fallback system** for Jellyfin server configuration:

#### **During Development (with `.env.local`):**

1. App checks SecureStore for user-configured settings
2. If empty, falls back to `.env.local` credentials
3. You can develop without configuring settings every time ✅

#### **In Production (App Store builds):**

1. `.env.local` is **NOT included** (it's in `.gitignore`)
2. App requires users to configure their own server
3. No hardcoded credentials exposed ✅

### Environment Variables

Variables in `.env.local` must use the `EXPO_PUBLIC_` prefix to be accessible in the app:

```bash
# ✅ Correct - accessible in app
EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://10.81.1.112:8096

# ❌ Wrong - not accessible
DEV_JELLYFIN_SERVER=http://10.81.1.112:8096
```

---

## Getting Jellyfin Credentials

### 1. Server IP (Auto-Configured!)

Server URL is **automatically set** to your active LAN IP (`http://<ip>:8096`) when available, otherwise `http://localhost:8096`:

- ✅ Works for both simulators and on-network Apple/Android TVs without manual edits
- ✅ Updates before every `npm start`, `npm run ios`, or `npm run android`

**For Physical Devices (Apple TV, iPhone):**
Use the Settings screen in the app (just like production users):

1. Open app on physical device
2. Go to Settings tab
3. Enter your Mac's network IP (e.g., `192.168.1.171`)
4. Add API key and User ID
5. Test connection
6. Save

This is exactly how production users will configure the app!

### 2. API Key

1. Open Jellyfin web interface
2. Go to **Dashboard → API Keys**
3. Click **+ New API Key**
4. Name it "TomoTV Development"
5. Copy the generated key

### 3. User ID

1. Open Jellyfin web interface
2. Go to your **user profile** (click avatar in top right)
3. The URL will show your User ID: `http://server:8096/web/index.html#!/users/user?userId=YOUR_USER_ID`
4. Or check **Dashboard → Users → [Your User]** and look in the URL

---

## Testing Production Behavior

To test how the app behaves for end users (without dev credentials):

1. **Temporarily rename `.env.local`:**

   ```bash
   mv .env.local .env.local.backup
   ```

2. **Restart the dev server:**

   ```bash
   npm start
   ```

3. **Expected behavior:**
   - App shows: "Jellyfin server not configured"
   - Tap "Go to Settings" button
   - Configure your server manually
   - Settings persist in device Keychain

4. **Restore dev credentials:**
   ```bash
   mv .env.local.backup .env.local
   ```

---

## Security Notes

### ⚠️ **DO NOT commit `.env.local` to git!**

Your `.env.local` file contains sensitive credentials and is automatically ignored by git.

**What's safe to commit:**

- ✅ `.env.example` - Template with no real credentials
- ✅ `jellyfinApi.ts` - Uses env vars, no hardcoded values
- ✅ `.gitignore` - Excludes `.env*.local`

**Never commit:**

- ❌ `.env.local` - Contains your real credentials
- ❌ Hardcoded IPs, API keys, or User IDs in code

---

## Troubleshooting

### App shows "not configured" even with `.env.local`

**Check:**

1. Variables use `EXPO_PUBLIC_` prefix
2. No quotes around values: `EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://10.81.1.112:8096` ✅
3. Restart Metro bundler: `npm start -- --clear`

### "Network request timed out" on iOS Simulator

**Solution:** Ensure ATS (App Transport Security) is configured in `app.json`:

```bash
npx expo prebuild --clean
npm run ios
```

See: `app.json` → `ios.infoPlist.NSAppTransportSecurity`

### Can't connect to Jellyfin server

**Check:**

1. Jellyfin server is running
2. IP address is correct (try `http://localhost:8096` if on same machine)
3. Firewall allows port 8096
4. iOS ATS allows HTTP connections (see above)

---

## App Store Submission

Before submitting to App Store, verify:

1. **No hardcoded credentials in source code** ✅
2. **`.env.local` is in `.gitignore`** ✅
3. **Production build doesn't include dev env vars** ✅
4. **First-run experience works** (test without `.env.local`)
5. **Settings screen allows user configuration** ✅

The app is designed to be **safe for App Store distribution** while maintaining an excellent **developer experience**.
