# TomoTV Development Setup

## Quick Reference

**Category:** Deployment
**Keywords:** development, setup, configuration, connect

Run the app and connect to a Jellyfin server from the in-app Settings screen — same flow in development and production.

## Related Documentation

- [`CLAUDE-configuration.md`](./CLAUDE-configuration.md) - Development configuration
- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - Development workflow
- [`CLAUDE-apple-store-checklist.md`](./CLAUDE-apple-store-checklist.md) - Build process for submission

---

## Local Development Configuration

### Quick Start

```bash
yarn install
yarn start
```

Then connect to your Jellyfin server from the in-app **Settings** screen — exactly the
same flow production users follow:

1. Open the app and go to the **Settings** tab
2. Enter your server IP/hostname (e.g. `192.168.1.171`) or full URL — the app
   auto-discovers protocol and port
3. Authorize with a **Quick Connect** code (or username/password)
4. On success the app drops you on the Library root; credentials persist in the device
   Keychain (SecureStore) across restarts

There is no `.env.local` / build-time credential mechanism — connecting through Settings
is the only path, on simulator and device alike.

---

## Getting a Quick Connect Code

1. Sign in to the Jellyfin web interface as the user you want to connect
2. Open **user profile → Quick Connect** and note the 6-digit code shown in the app's
   Quick Connect screen, then authorize it
3. Alternatively use username/password directly in the Settings screen

---

## Troubleshooting

### App shows "not configured"

**Check:**

1. You completed the Settings connect flow (server IP + Quick Connect / password)
2. The server is reachable from the device/simulator on the network
3. Restart Metro bundler if needed: `yarn start --clear`

### "Network request timed out" on iOS Simulator

**Solution:** Ensure ATS (App Transport Security) is configured in `app.json`:

```bash
yarn expo prebuild --clean
yarn ios
```

See: `app.json` → `ios.infoPlist.NSAppTransportSecurity`

### Can't connect to Jellyfin server

**Check:**

1. Jellyfin server is running
2. IP address is correct (try `http://localhost:8096` if on same machine)
3. Firewall allows port 8096
4. iOS ATS allows HTTP connections (see above)

---

## Running on a Physical Apple TV

### Debug builds carry no JS

The Xcode build phase _Bundle React Native code and images_ sets `SKIP_BUNDLING=1` for
every `*Debug*` configuration, so a Debug device build contains **no** `main.jsbundle`.
It is entirely dependent on reaching Metro at launch. (Verify:
`ls ~/Library/Developer/Xcode/DerivedData/KVF-*/Build/Products/Debug-appletvos/KVF.app`
— no `main.jsbundle`; the `Release-appletvos` product has one.)

### Xcode's Run does not start Metro — `expo run:ios` does

There is no "Start Packager" build phase in the Expo template. `yarn ios` / `yarn ios:device`
spin up the dev server as part of the command; ⌘R in Xcode does not. Building from Xcode
with no dev server running installs a JS-less app that has nothing to load:

```
No script URL provided. Make sure the packager is running or you have embedded a JS bundle in your application bundle.
unsanitizedScriptURLString = (null)
```

**Fix:** keep `yarn start` running in a terminal before pressing ⌘R, or just use
`yarn ios:device`.

### The `(null)` URL, explained

`AppDelegate.swift` → `bundleURL()` calls
`RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot:)` under `#if DEBUG`.
On a **physical device** (unlike the simulator) that provider does not default to
`localhost`. It reads the host from an `ip.txt` written into the `.app` at build time from
`ipconfig getifaddr en0`, probes `http://<ip>:8081/status`, and returns `nil` if the probe
fails. With no `main.jsbundle` to fall back to, `bundleURL()` is `nil` — hence the null
script URL rather than a connection error naming the host.

### Second cause: stale `ip.txt`

Because the IP is baked in at build time, a Mac LAN-IP change (DHCP lease, Wi-Fi ↔
Ethernet switch) produces the **identical** error even with Metro running. Diagnose:

```bash
ipconfig getifaddr en0
cat ~/Library/Developer/Xcode/DerivedData/KVF-*/Build/Products/Debug-appletvos/KVF.app/ip.txt
curl -s "http://$(ipconfig getifaddr en0):8081/status"   # expect: packager-status:running
```

If the two IPs differ, rebuild — the build phase rewrites `ip.txt`. If `curl` fails, Metro
is not running (or is bound to localhost only; `expo start` defaults to LAN).

### Network prerequisites

- Apple TV and Mac on the same subnet — no guest SSID, no AP client isolation.
- tvOS local-network permission granted to the app (`NSLocalNetworkUsageDescription` and
  `NSAllowsLocalNetworking` are already set in `app.json`).
- macOS firewall must not be blocking `node` on port 8081.

### Mac-free install

For using the app rather than developing it, build Release once — the JS bundle is
embedded and the app launches from the tvOS home screen with nothing running on the Mac:

```bash
yarn ios:device:release
```

---

## App Store Submission

Before submitting to App Store, verify:

1. **No hardcoded credentials in source code** ✅
2. **First-run experience works** (fresh install shows the connect screen) ✅
3. **Settings screen allows user configuration** (server IP + Quick Connect / password) ✅

The app is designed to be **safe for App Store distribution** with a single runtime
connect flow shared by developers and end users.
