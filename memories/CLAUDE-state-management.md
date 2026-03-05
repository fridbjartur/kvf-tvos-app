# State Management Architecture

**Last Updated:** January 24, 2026

## Quick Reference

**Category:** Implementation
**Keywords:** state, manager, context, singleton, pub-sub, caching, library, navigation

TomoTV uses a Singleton Manager + Context wrapper pattern for global state with 5-minute TTL caching and pub/sub reactivity.

## Related Documentation

- [`CLAUDE-api-reference.md`](./CLAUDE-api-reference.md) - API integration layer
- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - State usage patterns

---

TomoTV uses a **Singleton Manager + Context wrapper** pattern for global state.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│ React Components                                    │
│ (use hooks: useLibrary, useFolderNavigation)        │
│                    ↓                                 │
├─────────────────────────────────────────────────────┤
│ Context Providers (React Layer)                     │
│ - LibraryContext                                    │
│ - FolderNavigationContext                           │
│ - LoadingContext                                    │
│                    ↓ subscribe to managers          │
├─────────────────────────────────────────────────────┤
│ Singleton Managers (State Layer)                    │
│ - LibraryManager.getInstance()                      │
│ - FolderNavigationManager.getInstance()             │
│                    ↓ pub/sub pattern                │
├─────────────────────────────────────────────────────┤
│ API Layer                                           │
│ - jellyfinApi.ts (fetch functions)                  │
│                    ↓ HTTP requests                  │
├─────────────────────────────────────────────────────┤
│ Jellyfin Server                                     │
└─────────────────────────────────────────────────────┘
```

## Why This Pattern

- **Singleton Managers:** State persists across component re-mounts (navigate away and back)
- **React Context:** Provides reactivity and hooks API for components
- **Pub/Sub:** Components re-render only when subscribed state changes
- **Cache Management:** 5-minute TTL handled in managers, not scattered across components
- **Type Safety:** Full TypeScript interfaces throughout
- **Performance:** Prevents duplicate API calls via loading state guards

**Alternative Considered:** Redux/Zustand (rejected due to overhead for this app's scope)

## Singleton Managers

Location: `services/`

### LibraryManager

**Public API:**

- `getInstance()` - Get singleton instance
- `getState()` - Get current state snapshot
  ```typescript
  {
    videos: JellyfinItem[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMoreResults: boolean;
    error: string | null;
    libraryName: string;
  }
  ```
- `subscribe(callback)` - Subscribe to state changes (returns unsubscribe function)
- `refreshLibrary()` - Force refresh from API
- `loadMore()` - Load next page
- `clearCache()` - Clear cached videos and state

**Cache Strategy:**

- 5-minute TTL on library data
- Automatic refresh on cache expiration
- Clears on credential changes

### FolderNavigationManager

**Public API:**

- `getInstance()` - Get singleton instance
- `getState()` - Get navigation state snapshot
  ```typescript
  {
    items: JellyfinItem[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMoreResults: boolean;
    error: string | null;
    folderStack: FolderStackEntry[];
    currentFolder: FolderStackEntry | null;
  }
  ```
- `subscribe(callback)` - Subscribe to state changes (returns unsubscribe function)
- `navigateToFolder(folder)` - Navigate into folder/playlist
- `navigateBack()` - Navigate to parent folder (returns boolean)
- `navigateToBreadcrumb(index)` - Jump to specific breadcrumb
- `loadRoot()` - Load root library views
- `loadMore()` - Load next page
- `clearCache()` - Clear all folder caches

**Folder Stack:**
Each entry tracks:

- `id` - Folder/playlist ID
- `name` - Display name
- `type` - Entry type (folder, playlist, root)
- Enables breadcrumb navigation

## Context Wrappers

Location: `contexts/`

- `LibraryContext` - React wrapper for `LibraryManager`, provides `useLibrary()` hook
- `FolderNavigationContext` - React wrapper for `FolderNavigationManager`, provides `useFolderNavigation()` hook
- `LoadingContext` - Global loading state (modal spinner)

## Other State

- **SecureStore:** Persistent storage for credentials (device Keychain / Android Keystore)
- **Component State:** React hooks (`useState`, `useReducer`) for local state
- **Configuration:** Three-tier fallback (user settings → dev credentials → defaults)

## Usage Examples

### Using Library State

```typescript
import { useLibrary } from "@/contexts/LibraryContext";

const { videos, isLoading, hasMoreResults, loadMore, refreshLibrary } = useLibrary();
```

### Using Folder Navigation

```typescript
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";

const { items, folderStack, navigateToFolder, navigateBack, loadMore, isLoading } = useFolderNavigation();
```

Features:

- Breadcrumb sidebar (rotated text on left edge)
- Back item at grid start for parent navigation
- Per-folder caching with 5-minute TTL
- Pagination support via `loadMore()`
- Auto-navigates into first library on root load
- **Playlist support:** Playlists use a different API endpoint (`/Playlists/{id}/Items`) and are automatically detected via the `type` field in `FolderStackEntry`

### Using Global Loading

```typescript
import { useLoading } from "@/contexts/LoadingContext";

const { showGlobalLoader, hideGlobalLoader } = useLoading();

showGlobalLoader();
// ... async operation
hideGlobalLoader();
```
