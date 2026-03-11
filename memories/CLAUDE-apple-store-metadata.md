# App Store Metadata for TomoTV

**Last Updated:** February 11, 2026

## Quick Reference

**Category:** Deployment
**Keywords:** App Store, metadata, screenshots, description, keywords, ASO, privacy policy

Complete App Store metadata including app name, description, keywords, screenshots, privacy policy, and marketing copy.

## Related Documentation

- [`CLAUDE-apple-store-checklist.md`](./CLAUDE-apple-store-checklist.md) - Metadata validation

---

## App Name (30 characters max)

**TomoTV - Jellyfin Player**
(29 characters)

---

## Subtitle/Tagline (30 characters max)

**Stream from your media server**
(30 characters)

Alternative:
**Your Jellyfin on Apple TV**
(26 characters)

---

## Promotional Text (170 characters max)

**Stream any video from your Jellyfin server. Automatic transcoding, multi-audio switching, and subtitles. Just hit play. No codec headaches. Made for Apple TV.**
(158 characters)

---

## Description (4,000 characters max)

TomoTV connects your Apple TV to your Jellyfin media server. Select a video, it plays. No configuration needed.

**FEATURES**
• Browse and search your entire library
• Demo mode to try the app instantly without setup
• Full playlist support with auto-continue
• Up next queue and overlay
• Multi-audio track switching
• Subtitle support
• Audio file playback
• Quality presets: 480p, 540p, 720p, 1080p, 4K
• Secure on-device credential storage

**SETUP**

1. Run Jellyfin on your Mac, PC, or NAS
2. Enter your server URL and credentials in Settings
3. Start watching

**REQUIREMENTS**
• Jellyfin 10.8 or later
• Transcoding enabled on your server
• Network connection (HTTP or HTTPS)

**COMPATIBILITY**
Most video formats just work. Common formats play directly on your Apple TV, while others convert automatically on your server.

**PRIVACY**
No analytics. No tracking. No ads. Your credentials stay in device Keychain. Video streams directly from your server to your Apple TV.

---

## Keywords (100 characters max, comma-separated)

**jellyfin,media,player,video,streaming,plex,server,nas,local,transcode,hevc,movie,tv,remote,codec**
(99 characters)

Keywords Strategy:

- "jellyfin" (primary - core users)
- "plex" (competitor spillover)
- "media server", "nas" (adjacent searches)
- "transcode", "codec", "hevc" (technical users searching for solutions)
- "local", "remote" (usage context)

---

## What's New (4,000 characters max)

### Version 1.3.1

**4K Support**

**New Features:**
• 4K (2160p) transcoding — stream in Ultra HD quality
• Per-preset H.264 levels for optimal encoding (level 5.1 for 4K)

**Improvements:**
• Updated quality selector with 5 presets (480p through 4K)

---

### Version 1.3.0

**Quick Connect, Sign-In & Continue Watching**

**New Features:**
• Quick Connect — sign in with a code from any Jellyfin device
• Username & password sign-in
• Continue watching — resume where you left off

**Improvements:**
• Larger text for better readability on TV
• Scrolling titles on cards for long names
• Refined settings layout

---

### Version 1.2.0

**Queue Playback, Multi-Audio & Subtitles**

**New Features:**
• Play next queue — videos queue up and auto-continue so you can keep watching
• Up next overlay with progress bar shows what's coming
• Seamless multi-audio track switching during playback
• Subtitle support — external (.srt) and embedded tracks with native tvOS picker
• Native audio player improvements
• Updated app icons

**Improvements:**
• Enhanced tvOS focus and navigation reliability
• Faster native search loading
• UI and stability fixes

---

### Version 1.1.1

**Stability & Polish**

**Improvements:**
• Updated expo-tvos-search to v1.3.1 with improved native search integration
• Removed deprecated UI code for better performance
• Updated settings screen for improved reliability
• Documentation updates for developers
• Minor bug fixes and optimizations

---

### Version 1.1.0

**Demo Mode & Playlist Support**

**New Features:**
• Demo mode - Try TomoTV instantly with Jellyfin's official demo server (no setup required)
• Full playlist support - Browse and play videos from your Jellyfin playlists
• One-tap demo connection in Settings for instant testing
• Navigate into playlists just like folders with breadcrumb navigation

**Technical:**
• Auto-fetched demo credentials from Jellyfin's public demo server
• Added playlist-specific API endpoint for proper Jellyfin integration
• Improved folder type detection for UserView and Playlist types
• Enhanced error handling for demo server connectivity

---

### Version 1.0.8

**Audio Playback Support**

**New Features:**
• Audio files now visible when browsing folders in your library
• Audio files auto-play when selected, consistent with video behavior
• Dedicated audio player UI with play/pause controls

**Improvements:**
• Play/pause button auto-focuses on Apple TV remote
• TV remote select button and play/pause button toggle playback
• Improved button styling and visibility in audio player

---

### Version 1.0.7

**Stability & Polish**

**Improvements:**
• Native tvOS search now shows error alerts when connection fails
• Debug Info screen now protects your API key (shows only last 4 characters)
• Improved logging throughout the app for better debugging
• Cleaner validation flow for server settings

**Bug Fixes:**
• Fixed silent failures in tvOS native search
• Improved error recovery during search operations

---

### Version 1.0.6

**Folder Navigation & UI Improvements**

**New Features:**
• Folder navigation - browse your library by folders with breadcrumb trail
• Back button in grid for easy parent folder navigation
• Redesigned Help screen - clean landing page with QR code to documentation

**Improvements:**
• New unified dark background (#1C1C1E) across all screens
• Removed animations for smoother folder navigation
• Better focus feedback with instant border highlights
• Settings sections now have elevated card styling

**Bug Fixes:**
• Fixed jumpiness when switching folders
• Fixed animation lag on app startup

---

### Version 1.0.5

**Initial Release - Welcome to TomoTV!**

We're excited to bring you the first release of TomoTV, built from the ground up for Apple TV and Jellyfin.

**What's Included:**
• Automatic codec detection and transcoding
• 4 quality presets (480p, 540p, 720p, 1080p)
• Library browsing with infinite scroll
• Remote search with live results
• Autoplay playlist (continuous video playback)
• Subtitle support (external tracks embedded automatically)
• Secure on-device credential storage
• Comprehensive help section with troubleshooting
• Native Apple TV remote support

**Known Limitations (Coming Soon):**
• Resume playback - currently starts from beginning
• Watch history tracking
• Video metadata display (year, rating, plot)
• Continue watching section

We built TomoTV to solve one major problem: codec compatibility on Apple TV. If you've ever gotten a black screen or "cannot play" error with your Jellyfin videos, TomoTV handles it automatically.

**Feedback Welcome:**
This is our first release, and we'd love to hear from you. Visit our support page to share suggestions or report issues.

Thank you for supporting independent development!

---

## App Store Categories

**Primary Category:** Photo & Video
**Secondary Category:** Entertainment

---

## Age Rating

**Rating:** 4+ (No objectionable content)

**Why 4+:**

- User-provided content (videos from user's own Jellyfin server)
- No in-app purchases or ads
- No data collection
- No social features or user-generated content beyond their own library

**Content Warnings:** None required
(App displays content from user's personal media server - similar to VLC or other media players)

---

## Privacy Policy URL (Required)

**URL:** https://keiver.dev/lab/tomotv

**Minimum Privacy Policy Content:**

```
TomoTV Privacy Policy

Last Updated: [Date]

OVERVIEW
TomoTV is a local media player that connects to your Jellyfin server. We do not collect, store, or transmit any user data.

DATA COLLECTION
• None. TomoTV does not collect analytics, crash reports, or usage data.
• No third-party tracking or advertising SDKs are included.

CREDENTIAL STORAGE
• Server credentials (URL, API key, User ID) are stored locally on your device using the tvOS Keychain (secure, device-local storage).
• Credentials never leave your device. tvOS does not support iCloud Keychain sync.
• We never have access to your credentials.

DATA TRANSMISSION
• Video streams directly between your device and your Jellyfin server.
• No data passes through our servers (we don't have any servers).
• All network requests are made directly to your configured Jellyfin instance.

CONTACT
For questions or concerns: contact@keiver.dev
```

---

## Support URL (Required)

**URL:** https://keiver.dev/lab/tomotv

**Minimum Support Page Content:**

```
TomoTV Support

GETTING STARTED
1. Install Jellyfin (https://jellyfin.org)
2. Find your API key: Jellyfin Dashboard → API Keys → Create new key
3. Find your User ID: Jellyfin Dashboard → Users → Click your username → Copy ID from URL
4. Enter these in TomoTV Settings

COMMON ISSUES

Q: Videos won't play / black screen
A: Enable transcoding in Jellyfin Dashboard → Playback → Transcoding. Install FFmpeg if needed.

Q: Can't connect to server
A: Ensure TomoTV and Jellyfin are on same network. Check server URL includes port (e.g., http://192.168.1.100:8096)

Q: Transcoding is slow
A: Lower quality in Settings → Video Quality. Enable hardware acceleration in Jellyfin if available.

Q: Settings not saving
A: Try restarting the app. Credentials are stored in the device Keychain and persist across app launches.

CONTACT
Email: contact@keiver.dev
GitHub Issues: https://github.com/keiver/tomotv/issues
```

---

## Marketing URL (Optional)

**URL:** https://keiver.dev/lab/tomotv

**Suggested Landing Page Sections:**

1. Hero: "Stream Your Jellyfin Library on Apple TV"
2. Features: Smart transcoding, quality control, TV optimized
3. Screenshots carousel
4. Setup guide (3 steps)
5. FAQ
6. Download badge (links to App Store)

---

## Copyright

**Copyright Text:** © 2025 [Your Name or Company]. All rights reserved.

---

## App Store Screenshots Requirements

### Apple TV (Required if submitting tvOS app)

- **Size:** 1920x1080 pixels
- **Required:** 1-5 screenshots
- **Recommended:** 3-5 screenshots showing:
  1. Library grid view (with poster art)
  2. Video player with controls visible
  3. Settings screen
  4. Search screen with results
  5. Help screen (shows features)

### iPhone (if applicable)

- **6.7" Display:** 1290x2796 pixels
- **Required:** 1-10 screenshots

### iPad (if applicable)

- **12.9" Display:** 2048x2732 pixels
- **Required:** 1-10 screenshots

---

## App Preview Video (Optional but Recommended)

**Duration:** 15-30 seconds
**Content Suggestions:**

1. Show library browsing (2-3 seconds)
2. Select a video (1 second)
3. Video starts playing immediately (3-4 seconds)
4. Show remote control navigation (2-3 seconds)
5. Show search feature (2-3 seconds)
6. Show quality settings (2 seconds)
7. End with app icon and tagline: "TomoTV - Your Jellyfin on Apple TV"

**Technical Requirements:**

- Resolution: 1920x1080 (Apple TV)
- Format: M4V, MP4, or MOV
- Codec: H.264 or HEVC
- Max file size: 500 MB

---

## App Store Review Notes (For Apple Reviewers)

**Demo Account Information:**

```
For testing purposes, reviewers can use our demo Jellyfin server:

Server URL: [Provide a public demo server or local setup instructions]
API Key: [Provide demo API key]
User ID: [Provide demo user ID]

Alternatively, set up a local Jellyfin server:
1. Download Jellyfin from jellyfin.org
2. Install on Mac/PC
3. Add sample videos to library
4. Create API key in dashboard
5. Use those credentials in app

Notes:
- App requires a running Jellyfin server (similar to how Plex apps require Plex server)
- Transcoding features require FFmpeg installed on Jellyfin server
- App supports both local and remote connections over HTTP or HTTPS
```

---

## Build Number & Version Notes

**Version:** 1.3.1 (matches app.json)
**Build Number:** 1 (auto-increments on Xcode Archive)

**Version Naming Convention Going Forward:**

- 1.0.x - Bug fixes, minor tweaks
- 1.x.0 - New features (resume playback, metadata, etc.)
- x.0.0 - Major updates (UI overhaul, new platforms)

---

## Localization (Future)

**Current:** English only
**Priority Languages for v1.1+:**

1. Spanish (es)
2. French (fr)
3. German (de)
4. Japanese (ja)
5. Portuguese (pt-BR)

---

## App Store Optimization (ASO) Strategy

**Primary Goal:** Reach Jellyfin users searching for Apple TV clients

**Target Search Terms:**

1. "jellyfin apple tv" (exact match - high intent)
2. "jellyfin player" (broad - competitor to official app)
3. "media server apple tv" (adjacent - Plex users)
4. "video player apple tv" (broad - general market)
5. "transcode player" (specific - technical users)

**Competitive Positioning:**

- Primary competitor: Swiftfin (free, open source)
- Advantage: Smart transcoding UX, quality presets, simplified setup
- Disadvantage: Missing resume playback, metadata

**Conversion Strategy:**

- Lead with "automatic transcoding" (solves immediate pain)
- Emphasize Apple TV optimization (native feel)
- Show quality presets (control over experience)
- Include screenshot of help section (reduces support burden)

---

## Character Count Summary

| Field            | Limit | Current | Status |
| ---------------- | ----- | ------- | ------ |
| App Name         | 30    | 29      | ✅     |
| Subtitle         | 30    | 30      | ✅     |
| Promotional Text | 170   | 158     | ✅     |
| Description      | 4,000 | ~2,400  | ✅     |
| Keywords         | 100   | 99      | ✅     |
| What's New       | 4,000 | ~1,800  | ✅     |

---

## Next Steps Checklist

- [ ] Create privacy policy page and get URL
- [ ] Create support page and get URL
- [ ] (Optional) Create marketing landing page
- [ ] Take 3-5 Apple TV screenshots (1920x1080)
- [ ] (Optional) Record 15-30 second app preview video
- [ ] Set up demo Jellyfin server for Apple reviewers
- [ ] Update app.json with App Store URLs
- [ ] Generate app icon in all required sizes (already have assets)
- [ ] Submit for review via App Store Connect

---

## Post-Launch Marketing

**Reddit:**

- r/jellyfin (main community)
- r/selfhosted
- r/AppleTV
- r/cordcutters

**Forums:**

- Jellyfin Community Forum
- Jellyfin Discord

**Messaging:**
"Built TomoTV to solve codec issues on Apple TV. Automatically handles transcoding so you can just hit play. Free, no ads, no tracking. Would love feedback from the community."
