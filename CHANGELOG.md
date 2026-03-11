# Changelog

All notable changes to Tomo TV are documented here.

## [1.3.3] - 2026-03-11

### Changed

- Allow HTTP connections on all networks via `NSAllowsArbitraryLoads` (previously local-only via `NSAllowsLocalNetworking`)

## [1.3.1] - 2026-02-25

### Added

- 4K (2160p) transcoding — stream in Ultra HD quality
- Per-preset H.264 levels for optimal encoding (level 5.1 for 4K)

### Changed

- Updated quality selector with 5 presets (480p through 4K)

## [1.3.0] - 2026-01-24

### Added

- Quick Connect — sign in with a code from any Jellyfin device
- Username & password sign-in
- Continue watching — resume where you left off

### Changed

- Larger text for better readability on TV
- Scrolling titles on cards for long names
- Refined settings layout

## [1.2.0]

### Added

- Play next queue — videos queue up and auto-continue
- Up next overlay with progress bar
- Seamless multi-audio track switching during playback
- Subtitle support — external (.srt) and embedded tracks with native tvOS picker
- Native audio player improvements
- Updated app icons

### Changed

- Enhanced tvOS focus and navigation reliability
- Faster native search loading
- UI and stability fixes

## [1.1.1]

### Changed

- Updated expo-tvos-search to v1.3.1 with improved native search integration
- Removed deprecated UI code for better performance
- Updated settings screen for improved reliability
- Documentation updates for developers
- Minor bug fixes and optimizations

## [1.1.0]

### Added

- Demo mode — try TomoTV instantly with Jellyfin's official demo server
- Full playlist support — browse and play videos from your Jellyfin playlists
- One-tap demo connection in Settings
- Navigate into playlists with breadcrumb navigation

### Changed

- Auto-fetched demo credentials from Jellyfin's public demo server
- Playlist-specific API endpoint for proper Jellyfin integration
- Improved folder type detection for UserView and Playlist types
- Enhanced error handling for demo server connectivity

## [1.0.8]

### Added

- Audio files visible when browsing folders
- Audio files auto-play when selected
- Dedicated audio player UI with play/pause controls

### Changed

- Play/pause button auto-focuses on Apple TV remote
- TV remote select and play/pause buttons toggle playback
- Improved button styling in audio player

## [1.0.7]

### Changed

- Native tvOS search shows error alerts when connection fails
- Debug Info screen protects API key (shows only last 4 characters)
- Improved logging throughout the app
- Cleaner validation flow for server settings

### Fixed

- Silent failures in tvOS native search
- Error recovery during search operations

## [1.0.6]

### Added

- Folder navigation with breadcrumb trail
- Back button in grid for parent folder navigation
- Redesigned Help screen with QR code to documentation

### Changed

- Unified dark background (#1C1C1E) across all screens
- Removed animations for smoother folder navigation
- Better focus feedback with instant border highlights
- Settings sections with elevated card styling

### Fixed

- Jumpiness when switching folders
- Animation lag on app startup

## [1.0.5]

### Added

- Initial release
- Automatic codec detection and transcoding
- 4 quality presets (480p, 540p, 720p, 1080p)
- Library browsing with infinite scroll
- Remote search with live results
- Autoplay playlist (continuous video playback)
- Subtitle support (external tracks embedded automatically)
- Secure on-device credential storage
- Help section with troubleshooting
- Native Apple TV remote support
