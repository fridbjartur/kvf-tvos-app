# tvOS App Icons & Top Shelf Images

## Quick Reference

**Category:** Deployment
**Keywords:** tvOS, icons, top shelf, Apple TV, brand assets, imagestack, validation

Apple TV icon setup with automatic generation, folder structure, naming requirements, and common validation errors.

## Related Documentation

- [`CLAUDE-apple-store-checklist.md`](./CLAUDE-apple-store-checklist.md) - Icon validation requirements

---

This document covers Apple TV icon setup, folder structure, naming requirements, and common validation errors.

## Automatic Icon Generation

The `@react-native-tvos/config-tv` plugin is now configured with `appleTVImages` paths in `app.json`. This means tvOS icons are automatically generated during prebuild from the flattened source images in `assets/images/tvos-flattened/`.

```bash
export EXPO_TV=1
npm run prebuild
```

The plugin will automatically:

1. Create the `TVAppIcon.brandassets` folder structure
2. Generate imagestack layers from the flattened source images
3. Copy top shelf images for the tvOS home screen
4. Configure the Xcode project to use the brand assets

**No manual restoration is needed!** The icons are preserved across prebuild runs.

### Backup Reference

A backup copy of the original multilayer icons exists in `./Images.xcassets/Brand Assets.brandassets/` for reference. The flattened versions used by the plugin are in `assets/images/tvos-flattened/`.

## Asset Location

Located in `ios/tomotv/Images.xcassets/Brand Assets.brandassets/`

## Required Structure

```
Brand Assets.brandassets/
├── Contents.json
├── App Icon.imagestack/           # Home screen icon (400x240)
│   ├── Front.imagestacklayer/
│   ├── Middle.imagestacklayer/
│   └── Back.imagestacklayer/
├── App Icon - App Store.imagestack/  # App Store icon (1280x768)
│   ├── Front.imagestacklayer/
│   ├── Middle.imagestacklayer/
│   └── Back.imagestacklayer/
├── Top Shelf Image.imageset/      # Top shelf (1920x720 @1x, @2x)
└── Top Shelf Image Wide.imageset/ # Top shelf wide (2320x720 @1x, @2x)
```

## Critical Naming Requirements

Asset names in `Contents.json` must match exactly:

- `"App Icon"` (with space)
- `"App Icon - App Store"` (with spaces and hyphen)
- `"Top Shelf Image"` (with spaces)
- `"Top Shelf Image Wide"` (with spaces)

## Xcode Project Settings

In `project.pbxproj`:

```
ASSETCATALOG_COMPILER_APPICON_NAME = "Brand Assets"
```

In Xcode UI:

1. App Icon -> `Brand Assets`

## Info.plist Required Keys

```xml
<key>CFBundleIcons</key>
<dict>
  <key>CFBundlePrimaryIcon</key>
  <string>App Icon</string>
</dict>
<key>TVTopShelfImage</key>
<dict>
  <key>TVTopShelfPrimaryImage</key>
  <string>Top Shelf Image</string>
  <key>TVTopShelfPrimaryImageWide</key>
  <string>Top Shelf Image Wide</string>
</dict>
```

## Common Validation Errors

| Error                                                        | Solution                                                                    |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `Missing Info.plist Key 'CFBundleIcons.CFBundlePrimaryIcon'` | Add CFBundleIcons to Info.plist                                             |
| `Missing 'TVTopShelfImage.TVTopShelfPrimaryImageWide'`       | Add TVTopShelfImage to Info.plist                                           |
| App icon not showing                                         | Check `ASSETCATALOG_COMPILER_APPICON_NAME` matches brand assets folder name |

## Image Dimensions

| Asset                | Size     | Scale    |
| -------------------- | -------- | -------- |
| App Icon (Home)      | 400x240  | @1x      |
| App Icon (App Store) | 1280x768 | @1x      |
| Top Shelf            | 1920x720 | @1x, @2x |
| Top Shelf Wide       | 2320x720 | @1x, @2x |

## Layered Icon Structure

tvOS icons use a parallax effect with 3 layers:

- **Front** - Foreground elements (logo, text)
- **Middle** - Mid-ground elements (secondary graphics)
- **Back** - Background (solid color, gradient, or pattern)

Each layer is a separate PNG in its respective `.imagestacklayer` folder.

## Source Images for Automatic Generation

The plugin uses flattened composite images from `assets/images/tvos-flattened/`:

| File                        | Dimensions | Purpose                |
| --------------------------- | ---------- | ---------------------- |
| icon-1280x768.png           | 1280×768   | App Store icon (large) |
| icon-400x240.png            | 400×240    | Home screen icon @1x   |
| icon-800x480.png            | 800×480    | Home screen icon @2x   |
| topshelf-1920x720.png       | 1920×720   | Top shelf @1x          |
| topshelf-3840x1440.png      | 3840×1440  | Top shelf @2x          |
| topshelf-wide-2320x720.png  | 2320×720   | Top shelf wide @1x     |
| topshelf-wide-4640x1440.png | 4640×1440  | Top shelf wide @2x     |

These flattened images are composites of the layered icons from `assets/images/icon/` and `assets/images/app-store/`, where each icon consists of three layers (back, middle, front) that are composited together.
