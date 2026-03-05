# External Dependencies

**Last Updated:** January 24, 2026

## Quick Reference

**Category:** Implementation
**Keywords:** expo-tvos-search, native search, external packages, dependencies, Swift module

External packages and repositories maintained separately from the main TomoTV codebase, including expo-tvos-search.

## Related Documentation

- [`CLAUDE-multi-audio.md`](./CLAUDE-multi-audio.md) - Usage in multi-audio feature

---

This document tracks external packages and repositories maintained separately from the main TomoTV codebase.

---

## expo-tvos-search

The native tvOS search functionality is maintained in a **separate repository**.

### Repository Details

- **GitHub:** [github.com/keiver/expo-tvos-search](https://github.com/keiver/expo-tvos-search)
- **npm:** `expo-tvos-search@^1.3.1`
- **Package reference:** `"expo-tvos-search": "^1.3.1"` (npm registry)
- **Demo app:** Local clone at `~/@keiver/expo-tvos-search-demo`

**Note:** The package at `~/@keiver/expo-tvos-search` is for reference only. TomoTV uses the npm registry version, not a local file dependency.

### GitHub Dependency Syntax

When testing unreleased changes, use a git branch reference instead of a local file path (local `file:` paths don't work with Metro bundler):

```json
// Use GitHub branch (WORKS)
"expo-tvos-search": "github:keiver/expo-tvos-search#branch-name"

// DON'T use local file path (Metro bundler fails to resolve)
"expo-tvos-search": "file:../@keiver/expo-tvos-search"
```

**Supported formats:**

- `github:user/repo#branch` - Specific branch
- `github:user/repo#commit-sha` - Specific commit
- `github:user/repo#tag` - Specific tag
- `github:user/repo` - Default branch

After updating package.json, run:

```bash
npm install
npm run prebuild:tv
```

### Features

- Native tvOS keyboard integration
- Grid display with poster images (configurable columns)
- Marquee text scrolling for long titles
- Focus management with SwiftUI focus engine
- Comprehensive input validation (500-char limit, URL scheme checking)
- Customizable card dimensions (default 280×420, 2:3 aspect ratio)
- Image content modes: fill, fit, contain
- Error and validation warning events
- **Apple TV hardware keyboard support** (v1.3.2+) - `onSearchFieldFocused`/`onSearchFieldBlurred` callbacks for `TVEventControl` integration

### Current Integration

- **Version:** 1.3.2 (GitHub branch during development, npm for releases)
- **Last updated:** January 25, 2026
- **Status:** Stable, production-ready
- **Local modifications:** None needed

### Usage in TomoTV

```typescript
import { TvosSearchView, isNativeSearchAvailable } from "expo-tvos-search";

if (isNativeSearchAvailable()) {
  // Use native search on tvOS
} else {
  // Fallback to React Native TextInput
}
```

**Implementation:**

- Used in `app/(tabs)/search.tsx`
- Provides native SwiftUI `.searchable` modifier
- Fixed 280x420 card grid with poster images

### Modifying the Package

To contribute to the search package:

1. Clone repository:

   ```bash
   git clone https://github.com/keiver/expo-tvos-search.git
   cd expo-tvos-search
   ```

2. Make changes to `ios/ExpoTvosSearchView.swift`

3. Test in demo app:

   ```bash
   cd example
   npm run prebuild:tv && npm run ios
   ```

4. Submit PR to repository

5. After merge, update TomoTV:
   ```bash
   npm install expo-tvos-search@latest
   npm run prebuild:tv && npm run ios
   ```

### Why Separate Repository?

- **Reusability:** Can be used in other Expo tvOS projects
- **Independent versioning:** Package updates don't require TomoTV releases
- **Testing:** Has its own demo app for isolated testing
- **npm distribution:** Easy installation for other developers

---

## Template for Future External Dependencies

When adding new external packages, document them here:

````markdown
## [Package Name]

### Repository Details

- **GitHub:** [url]
- **npm:** `package-name@version`
- **Demo/docs:** [url or path]

### Features

- [Feature 1]
- [Feature 2]

### Current Integration

- **Version:** [version]
- **Last updated:** [date]
- **Status:** [stable/beta/experimental]
- **Local modifications:** [none/list]

### Usage in TomoTV

```typescript
// Example code
```
````

### Why Separate Repository?

- [Reason 1]
- [Reason 2]

```

```
