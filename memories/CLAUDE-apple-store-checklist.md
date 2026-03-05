# TomoTV - App Store Submission Checklist

**Status:** ✅ **READY FOR SUBMISSION**

## Quick Reference

**Category:** Deployment
**Keywords:** App Store, submission, checklist, review, screenshots, metadata, deployment

Complete App Store submission checklist with URLs, metadata requirements, and pre-submission testing steps.

## Related Documentation

- [`CLAUDE-apple-store-metadata.md`](./CLAUDE-apple-store-metadata.md) - Metadata requirements
- [`CLAUDE-tvos-icons.md`](./CLAUDE-tvos-icons.md) - Icon requirements
- [`CLAUDE-development.md`](./CLAUDE-development.md) - Build process

---

All required pages have been created and the app.json has been updated with the necessary URLs.

---

## 📱 App Store URLs (REQUIRED)

### Privacy Policy

### Support Page

### Marketing/Landing Page

- **URL:** `https://keiver.dev/lab/tomotv`
- **Location:** `~/keiver.dev/pages/lab/tomotv.tsx`
- **Status:** ✅ Created

---

## 📝 What's Been Done

### 1. Created TomoTV Landing Page

**File:** `~/keiver.dev/pages/lab/tomotv.tsx`

Features:

- Engaging hero section with TomoTV branding
- Key features and additional capabilities sections
- 3-step setup guide
- Supported formats list
- Requirements section
- Privacy policy excerpt
- Support section with common issues
- Known limitations (transparency)
- Contact information
- Placeholder for screenshots (you'll add these)

### 2. Created Privacy Policy Page

**File:** `~/keiver.dev/pages/lab/tomotv-privacy.tsx`

Includes:

- Complete "no data collection" policy
- Credential storage explanation (device Keychain)
- Direct device-to-server communication clarification
- No third-party services disclosure
- GDPR and CCPA compliance sections
- Plain English summary
- Legal requirements for App Store submission

### 3. Created Support Page

**File:** `~/keiver.dev/pages/lab/tomotv-support.tsx`

Includes:

- Getting started guide (3-step setup)
- Common issues and solutions (6 major issues covered)
- Finding credentials tutorial (server URL, API key, User ID)
- Jellyfin server setup tips (FFmpeg, hardware acceleration)
- Supported formats list
- System requirements
- Known limitations
- Contact information
- Additional resources

### 4. Updated app.json

**File:** `./app.json`

Changes:

- ✅ Updated description (better App Store copy)
- ✅ Added privacy URL: `https://keiver.dev/lab/tomotv-privacy`
- ✅ Added `usesNonExemptEncryption: false` (required for App Store submission)

---

## 🚀 Next Steps (Before Submission)

### 1. Deploy Website Pages ⚠️ **CRITICAL**

Before submitting to App Store, you MUST deploy your keiver.dev website so the URLs are live:

```bash
cd ~/keiver.dev
# Build the site (assuming Next.js)
npm run build
# Deploy to your hosting (Vercel, Netlify, etc.)
```

**Verify these URLs work:**

- <https://keiver.dev/lab/tomotv>

### 2. Add Screenshots

**Action Required:** Add TomoTV screenshots to `~/keiver.dev/public/screenshots/tomotv/`

You mentioned you'll add screenshots—place them in the directory that was created:

- `~/keiver.dev/public/screenshots/tomotv/`

Recommended screenshots:

- `1.webp` - Library grid view
- `2.webp` - Video player with controls
- `3.webp` - Search screen with results
- `4.webp` - Settings screen
- `5.webp` - Help screen

Then update `tomotv.tsx` to use real screenshots instead of placeholders (lines 139-167).

### 3. Update Apple App ID

**Action Required:** Once you create the app in App Store Connect, update:

1. `~/keiver.dev/pages/lab/tomotv.tsx` line 106:

   ```tsx
   <meta name="apple-itunes-app" content="app-id=YOUR_APP_ID_HERE" />
   ```

2. Update App Store button URLs in `tomotv.tsx` line 128:

   ```tsx
   appStoreUrl = "https://apps.apple.com/us/app/tomotv/YOUR_APP_ID";
   ```

### 4. Take Apple TV Screenshots (1920x1080)

For App Store Connect, you need actual Apple TV screenshots:

- Size: 1920x1080 pixels
- Required: 3-5 screenshots
- Take screenshots showing:
  1. Library view (with poster art)
  2. Video player
  3. Settings screen
  4. Search with results
  5. Help screen

### 5. Optional: Create App Icon for Website

Consider creating a TomoTV icon for the website (currently using emoji 📺).

Upload to: `~/keiver.dev/public/screenshots/tomotv/icon.png`

---

## 📋 App Store Connect Submission Checklist

### Metadata (Copy from APP_STORE_COPY.md)

- [ ] App Name: "TomoTV - Jellyfin Player"
- [ ] Subtitle: "Stream from your media server"
- [ ] Privacy Policy URL: `https://keiver.dev/lab/tomotv-privacy`
- [ ] Marketing URL: `https://keiver.dev/lab/tomotv`
- [ ] Support URL: `https://keiver.dev/lab/tomotv-support`
- [ ] Promotional Text (165 chars from APP_STORE_COPY.md:20)
- [ ] Description (from APP_STORE_COPY.md:26-86)
- [ ] Keywords: "jellyfin,media,player,video,streaming,plex,server,nas,local,transcode,hevc,movie,tv,remote,codec"
- [ ] What's New (from APP_STORE_COPY.md:106-134)

### Build & Binary

- [ ] Build version: 1.0.7
- [ ] Build number: 3
- [ ] Export compliance: usesNonExemptEncryption: false (already in app.json)
- [ ] Upload build via Xcode or Application Loader

### Screenshots

- [ ] 3-5 Apple TV screenshots (1920x1080)

### App Information

- [ ] Category: Photo & Video (primary), Entertainment (secondary)
- [ ] Age Rating: 4+
- [ ] Copyright: © 2025 Keiver Hernandez (or your name/company)

### Review Information

- [ ] Demo credentials for Apple reviewers (see APP_STORE_COPY.md:289-311)
- [ ] Contact information
- [ ] Notes about requiring Jellyfin server

---

## 🧪 Pre-Submission Testing

### Test URLs

Once deployed, verify these work:

```bash
curl -I https://keiver.dev/lab/tomotv
curl -I https://keiver.dev/lab/tomotv-privacy
curl -I https://keiver.dev/lab/tomotv-support
```

All should return `200 OK`.

### Test App

1. Build app for Apple TV device (not simulator)
2. Test without .env.local to ensure production behavior
3. Verify Settings screen works
4. Verify video playback works
5. Verify transcoding works
6. Test all quality presets

---

## 📚 Reference Documents

- **App Store Copy:** `./APP_STORE_COPY.md`
- **Project Documentation:** `./CLAUDE.md`
- **This Checklist:** `./APP_STORE_SUBMISSION_READY.md`

---

## 🎯 Summary

**What's Complete:**
✅ Privacy policy page created
✅ Support page created
✅ Landing page created
✅ app.json updated with privacy URL
✅ Export compliance configured
✅ All App Store metadata prepared in APP_STORE_COPY.md

**What You Need to Do:**

1. Deploy keiver.dev website (so URLs are live)
2. Add screenshots to website
3. Update App ID placeholders
4. Take Apple TV screenshots for App Store Connect
5. Copy metadata to App Store Connect
6. Submit for review

**Estimated Time to Submission:** 2-3 hours (mostly screenshot capture and metadata entry)

---

## 🆘 Need Help?

If you encounter issues:

1. Check that all URLs return 200 OK
2. Verify app.json is valid JSON
3. Test app on physical Apple TV device
4. Review APP_STORE_COPY.md for any missing metadata
