# Lessons Learned

**Last Updated:** February 10, 2026

## Quick Reference

**Category:** Implementation
**Keywords:** debugging, bugs, lessons, case studies, audio tracks, HLS, platform behavior, compliance tests, anti-patterns

Case studies of significant bugs encountered during TomoTV development with root causes, solutions, and key takeaways.

## Related Documentation

- [`CLAUDE-patterns.md`](./CLAUDE-patterns.md) - Lessons inform best practices
- [`CLAUDE-multi-audio.md`](./CLAUDE-multi-audio.md) - Audio track debugging cases

---

This document captures important lessons from debugging sessions, bugs, and issues encountered during TomoTV development. Each lesson reinforces the workflow and decision-making rules in the main CLAUDE.md.

---

## UIHostingController Containment Bug — .searchable Keyboard Disappears (February 2026)

### Problem

After interacting with any TextInput on the Settings tab (which opens a tvOS keyboard dialog/UIAlertController), navigating to the Search tab caused the native `.searchable` SwiftUI keyboard to stop appearing entirely. Fresh app launches worked fine.

### Root Cause

In `expo-tvos-search`, the `UIHostingController` hosting the SwiftUI `NavigationView` with `.searchable` was created and its **view** was added as a subview, but the controller itself was never added as a child view controller via `addChild`/`didMove(toParent:)`. This meant:

- The hosting controller never received `viewWillAppear`/`viewDidAppear` lifecycle events
- SwiftUI's `.searchable` modifier relies on UIKit's focus system integration, which requires proper VC containment
- It worked "by accident" on fresh launch (no prior focus state to conflict with)
- After a Settings TextInput opened a UIAlertController (keyboard dialog), UIKit's focus engine state changed, and returning to Search, the focus engine couldn't route focus back to `.searchable` because the hosting controller wasn't in the VC hierarchy

### Solution

Added proper UIKit view controller containment in `ExpoTvosSearchView.swift`:

1. `didMoveToWindow()` override — when view enters a window, find nearest parent VC via responder chain and call `addChild`/`didMove(toParent:)`. When removed, call `willMove(toParent: nil)`/`removeFromParent()`
2. Early containment in `setupView()` for cases where the view already has a window at setup time
3. Cleanup in `deinit` to remove VC relationship

### What Went Wrong

- First attempt tried `Keyboard.dismiss()` + `.blur()` cleanup in settings.tsx `useFocusEffect` — this was a red herring because the issue wasn't a lingering first responder on the JS side
- The real issue was a missing Apple-documented UIKit pattern in the native Swift library

### What Worked

- Reading Apple's documentation on UIHostingController containment requirements
- Tracing the lifecycle: Settings TextInput -> UIAlertController -> focus engine state change -> missing VC hierarchy -> .searchable can't reclaim focus

### Key Takeaways

1. **UIHostingController requires proper child VC containment** — adding just the `.view` as a subview is not sufficient. Without `addChild`/`didMove(toParent:)`, SwiftUI never receives lifecycle events
2. **"Works on first launch but breaks after X" is a containment/lifecycle smell** — if something works initially but breaks after unrelated UIKit interactions, suspect missing lifecycle integration
3. **Focus engine bugs on tvOS are often VC hierarchy bugs** — the tvOS focus engine relies on the view controller hierarchy to route focus. If a VC isn't in the hierarchy, its views can't participate in focus updates

### Files Affected

- `expo-tvos-search/ios/ExpoTvosSearchView.swift` (library fix)
- `app/(tabs)/settings.tsx` (defensive cleanup, kept but not the fix)

---

## Audio Track Label Bug (January 2026)

### Problem

tvOS showed "Unknown language" instead of track name for undefined language tracks in the native audio picker.

### Root Cause

iOS/tvOS **ALWAYS prioritizes LANGUAGE attribute** over NAME for display in native picker. When LANGUAGE="und" (undefined), iOS displays its own localized string "Unknown language" regardless of what NAME says.

### Solution

Omit LANGUAGE attribute entirely for "und" tracks. Per RFC 8216, LANGUAGE is OPTIONAL. When LANGUAGE is omitted, iOS falls back to displaying the NAME attribute.

### What Went Wrong

- ❌ Proposed solutions without reading Apple HLS spec
- ❌ Assumed LANGUAGE was required (it's optional per RFC 8216)
- ❌ Went in circles trying NAME variations without understanding root cause
- ❌ Forgot platform context (iOS HLS ≠ generic HLS)
- ❌ Didn't read the actual Swift implementation before suggesting changes

### What Worked

- ✅ Read RFC 8216 to confirm LANGUAGE is optional
- ✅ Read Apple HLS Authoring Specification
- ✅ Inspected actual Swift code in `native/ios/MultiAudioResourceLoader/`
- ✅ Tested one solution at a time with clear hypothesis
- ✅ Asked user for confirmation before implementing

### Key Takeaways

1. **Display and auto-selection are separate concerns:**
   - LANGUAGE/NAME control what's displayed in picker
   - DEFAULT/AUTOSELECT control which track plays automatically
2. **Platform-specific behavior requires platform-specific documentation:**
   - Generic HLS specs (RFC 8216) define what's allowed
   - Apple HLS implementation defines actual behavior on iOS/tvOS
3. **Read implementation code BEFORE proposing solutions:**
   - Assumptions about how code works are often wrong
   - 5 minutes reading Swift code saves hours of iteration

### Files Affected

- `native/ios/MultiAudioResourceLoader/HLSManifestGenerator.swift:156-180`

### Commit

- Hash: 703c7a2
- Message: "fix: audio tracks show correct name, no default selected mark in list tradeoff"

---

## Compliance Test Anti-Pattern (January 2026)

### Problem

AI-generated tests sometimes use `fs.readFileSync` to scan source code files and assert on string presence/absence, rather than testing actual runtime behavior. These "compliance tests" provide false confidence and test nothing meaningful.

### Root Cause

When asked to verify a code property (e.g., "ensure no console.log statements"), the path of least resistance is to read the source file and check for string patterns. This satisfies the request superficially but doesn't exercise any code paths.

### Solution

Established a rule: **all tests must exercise actual code paths.** If the only way to verify something is scanning source text, use a linter rule instead or skip the test entirely. No test is better than a fake test.

### What Went Wrong

- ❌ Used `fs.readFileSync` in test files to scan source code
- ❌ Asserted on code text patterns instead of runtime behavior
- ❌ Created tests that pass/fail based on string matching, not functionality
- ❌ Provided false confidence that "everything is tested"

### What Worked

- ✅ Identified the anti-pattern and documented it
- ✅ Added explicit rule to testing best practices
- ✅ Audited all existing test files for violations (none found)
- ✅ Clear guidance: use ESLint for code style, Jest for behavior

### Key Takeaways

1. **Tests must exercise code paths:** A test that reads source files is not a test — it's a linter with extra steps
2. **No test > fake test:** If you can't write a meaningful behavioral test, skip it
3. **Right tool for the job:** Use ESLint for code style enforcement, Jest for behavior verification
4. **Question AI-generated tests:** Compliance tests are a common AI failure mode — always review test quality, not just quantity

### Files Affected

- `memories/CLAUDE-testing.md` (added No Compliance Tests rule)
- No existing test files were in violation

---

## False Apple Docs Claim in tvOS Focus Fix (January 2026)

### Problem

Implemented a tvOS focus restoration function based on an unverified claim about Apple's documentation. The code comment stated "Per Apple docs, UIKit rebuilds the focus spatial map when a focusable view is removed from the hierarchy." This claim was false.

### Root Cause

The plan stated an Apple docs fact that was never verified. The implementation was coded, commented, and JSDoc'd with "Per Apple docs" without anyone checking what Apple actually says. What Apple actually says: "UIKit automatically updates focus when a **focused** view is removed from the view hierarchy." The word "focused" is critical — it means the currently-focused view, not any arbitrary focusable view. Additionally, Apple doesn't use the term "spatial map" at all.

### Solution

Caught the error when the user asked for verification. Research confirmed the claim was false. The implementation (adding/removing a non-focused temporary focusable view) is almost certainly a no-op — UIKit has no reason to do anything when a view that never had focus is removed.

### What Went Wrong

- ❌ Implemented a plan without verifying its core assumption
- ❌ Wrote "Per Apple docs" in code comments without reading Apple docs
- ❌ Treated the plan's assertion as fact and coded it without due diligence
- ❌ The plan itself had ~50% confidence but the code comments stated it as documented fact
- ❌ Violated the Research-First Protocol from CLAUDE.md

### What Worked

- ✅ User asked a direct yes/no verification question
- ✅ Fetched actual Apple documentation (App Programming Guide for tvOS, WWDC 2016/2017 transcripts)
- ✅ Found the exact discrepancy: "focused view" vs "any focusable view"
- ✅ Admitted the error immediately and transparently

### Key Takeaways

1. **Never write "Per docs" without reading the docs:** If a plan claims something is documented, verify it before implementing. "Per Apple docs" in a code comment is a factual assertion — treat it with the same rigor as a test assertion.
2. **Verify facts from plans the same way you'd verify facts from memory:** A plan written by an AI is not a primary source. It can be wrong. The plan said "Per Apple docs" but had never checked.
3. **Low-confidence plans need higher verification, not lower:** The plan stated ~50% confidence. That should have triggered MORE verification, not less.
4. **The Research-First Protocol exists for a reason:** CLAUDE.md says "NEVER propose solutions based on assumptions alone." This applies to implementing plans too — the plan was the assumption.

### Files Affected

- `@keiver/expo-tvos-search/ios/ExpoTvosSearchModule.swift` (incorrect implementation)
- `@keiver/expo-tvos-search/src/index.tsx` (incorrect JSDoc)

---

## tvOS FlatList Focus Escape Bug (January 2026)

### Problem

Focus cannot escape FlatList to reach tab bar when pressing UP. Within the grid, up/down/left/right navigation works. But vertical navigation to elements OUTSIDE the ScrollView (like tab bar) is blocked.

### Root Cause (CONFIRMED)

`RCTScrollViewComponentView.mm` lines 1177-1182 contains an overly restrictive containment check:

```objc
BOOL isMovingUp = (context.focusHeading == UIFocusHeadingUp && self.scrollView.contentOffset.y > 0);
BOOL isMovingDown = (context.focusHeading == UIFocusHeadingDown &&
    self.scrollView.contentOffset.y < self.scrollView.contentSize.height - MAX(self.scrollView.visibleSize.height, 1));

if (isMovingUp || isMovingDown) {
    return (context.nextFocusedItem && [UIFocusSystem environment:self containsEnvironment:context.nextFocusedItem]);
}
```

When scrolled (`contentOffset.y > 0`), pressing UP triggers the containment check. If `nextFocusedItem` (tab bar) is OUTSIDE the ScrollView, `containsEnvironment` returns NO, blocking the focus update entirely.

### What We Ruled Out

- ❌ **Video overlay / modal transitions** — Bug exists without playing video
- ❌ **expo-router / react-navigation** — Not involved
- ❌ **TVFocusGuideView** — Our addition made it worse, but bug exists without it
- ❌ **expo-tvos-search native module** — Not the cause
- ❌ **requestTVFocus() with staggered delays** — Controls position, not traversal
- ❌ **hasTVPreferredFocus** — Only affects initial mount
- ❌ **setNeedsFocusUpdate()** — Controls where focus goes, not if it CAN go

### Key Distinction

All attempted fixes work on **focus POSITION** (where focus is). The bug is in **focus TRAVERSAL** (where focus can go). These are separate systems in UIKit.

### What We Attempted (All Failed)

1. Multiple `requestTVFocus()` calls with staggered delays (150ms, 300ms, 500ms)
2. `TVFocusGuideView` wrapper with `autoFocus` and `destinations` props
3. `hasTVPreferredFocus={true}` on grid items
4. `focusRestoreKey` state to trigger re-evaluation
5. Passing refs via `forwardRef` to first grid item

### The Real Fix (Not Yet Implemented)

Patch `react-native-tvos` to change the containment check to defer to parent hierarchy when target exists outside:

```objc
if (isMovingUp || isMovingDown) {
    if (!context.nextFocusedItem) {
        return NO;  // No target, block (scroll instead)
    }
    if ([UIFocusSystem environment:self containsEnvironment:context.nextFocusedItem]) {
        return YES;  // Target inside scroll view, allow
    }
    // Target exists but OUTSIDE - defer to parent hierarchy
    return [super shouldUpdateFocusInContext:context];  // ← THE FIX
}
```

### Key Takeaways

1. **Focus position and focus traversal are different systems** — restoring position doesn't fix traversal
2. **Verify root cause before implementing fixes** — We wasted time on JS-level fixes when the bug is in native code
3. **Test without the suspected cause** — Testing grid navigation WITHOUT playing video proved overlay wasn't the issue
4. **Read the actual native code** — The answer was in `RCTScrollViewComponentView.mm` the whole time
5. **TVFocusGuideView can make things worse** — It interfered with normal focus behavior
6. **Core RN bugs require core RN patches** — JS-level workarounds cannot fix native containment checks

### Files Relevant

- `node_modules/react-native/React/Fabric/Mounting/ComponentViews/ScrollView/RCTScrollViewComponentView.mm:1177-1182` (the bug)
- `app/(tabs)/index.tsx` (where we attempted JS fixes)

### Status

Codebase reset to clean state. Awaiting `patch-package` implementation to fix the native code.

---

## Template for Future Lessons

When adding new lessons, use this format:

```markdown
## [Issue Title] ([Month Year])

### Problem

[1-2 sentence description of user-facing issue]

### Root Cause

[Technical explanation of why it happened]

### Solution

[What fixed it]

### What Went Wrong

- ❌ [Anti-pattern we fell into]
- ❌ [Assumption we made]

### What Worked

- ✅ [Process that led to solution]
- ✅ [Tool or technique that helped]

### Key Takeaways

1. [Lesson 1]
2. [Lesson 2]

### Files Affected

- [file:line]

### Commit

- Hash: [commit hash]
- Message: "[commit message]"
```

---

## Watch Progress Never Persisted on tvOS (June 2026)

### Problem

Continue-watching never updated. Every 8s during playback the app logged "Failed to persist watch progress" with `NSFileWriteNoPermissionError`: "You don't have permission to save the file watch_progress.json in the folder Documents." Reads succeeded, writes always failed.

### Root Cause

`watchProgressService.ts` stored the file in `FileSystem.documentDirectory`. The build is tvOS (`SDKROOT = appletvos`), and tvOS denies apps writing to `Documents` — local persistent storage is restricted to `Library/Caches` (purgeable) or iCloud key-value store. In `expo-file-system@56`, the legacy module's `ensurePathPermission` (sandbox scoped-access check) passes, but the real `data.write(to:url, .atomic)` at `FileSystemLegacyModule.swift:112` throws the OS-level no-permission error.

### Solution

Switched `STORAGE_FILE` to `FileSystem.cacheDirectory`. Updated the test mock to expose `cacheDirectory`.

### What Worked

- ✅ Traced the native write path (legacy Swift module) instead of guessing at JS.
- ✅ Confirmed the platform from `project.pbxproj` (`SDKROOT = appletvos`) before concluding.
- ✅ Separated the scoped-permission check (passed) from the OS write (failed) via the `causedBy` error chain.

### Key Takeaways

1. On tvOS, never write to `documentDirectory` — use `cacheDirectory` (purgeable) or iCloud KV.
2. A passing expo scoped-permission check does not mean the OS will allow the write.

### Files Affected

- `services/watchProgressService.ts:8`
- `services/__tests__/watchProgressService.test.ts:8`

---

## Project-Wide Lint/TS Cleanup — Hidden Config Bugs (July 2026)

### Problem

`expo lint` crashed outright ("could not find plugin @typescript-eslint"), so lint had silently stopped running project-wide. Separately, `tsc` had ~20 errors and builds spammed duplicate/missing React key warnings from API-sourced lists.

### Root Cause

1. **ESLint flat config scoping:** in `eslint.config.js`, a rules-override object without a `files` key applies to ALL files. `eslint-config-expo/flat` registers the `@typescript-eslint` plugin only for `**/*.ts(x)`, so referencing its rules in an unscoped block crashed ESLint on every `.js` file.
2. **expo-file-system 56 API split:** `FileSystem.cacheDirectory` no longer exists on the main entry — legacy constants/functions moved to `expo-file-system/legacy`.
3. **Stale fork tests:** three test suites tested exports (`videoPlayerReducer`, `PlaybackMode`, `buildQueue`) deleted when the Jellyfin hook/context was rewritten for KVF.
4. **API keys:** KVF API can return duplicate/missing `slug`/`sid`, and lists used those raw as React keys.

### Solution

- Scoped the `@typescript-eslint` rule override with `files: ["**/*.ts", "**/*.tsx"]`; added jest globals for `jest.setup.js`; allowed `require()` in test files (jest.doMock pattern).
- `import * as FileSystem from "expo-file-system/legacy"` in `services/kvfCache.ts`.
- Deleted the three uncompilable stale suites; rewrote `PlayQueueContext.integration.test.tsx` against the current API.
- Added `utils/keys.ts` `withListKeys()` — attaches a unique `listKey` (`id`, `id-2`, … or generated fallback) to every list item at the kvfApi layer; all `keyExtractor`s/`key`s use `listKey`.
- Extracted `components/focus-scale-card.tsx` (`FocusScaleCard` + `useFocusSpring`) replacing the copy-pasted `useRef(new Animated.Value())` focus animation (a react-hooks/refs lint error) in kvf-program-card, EpisodeCard, ChannelTile. Animated.Values are created via `useState` lazy init.

### Key Takeaways

1. In ESLint flat config, every override block that uses plugin rules must be scoped with `files` matching where the plugin is registered.
2. Reset-state-on-prop-change belongs in render ("adjust state during render" pattern) or derived `useMemo`, not `useEffect` — the `react-hooks/set-state-in-effect` rule enforces this.
3. Never trust API ids as React keys — normalize once at the API layer, not per-screen.

### Files Affected

- `eslint.config.js`, `services/kvfCache.ts`, `utils/keys.ts`, `services/kvfApi.ts`, `types/kvf.ts`, `components/focus-scale-card.tsx`

---

## Instant-Launch Caching: Revalidation Must Not Re-Render (September 2026)

### Problem

The app showed a spinner on launch and on every visit to Sendingar (search), even though the KVF
catalogue only changes when new shows are published. Background refreshes also rebuilt every list,
which on tvOS can throw D-pad focus back to the first card mid-browse.

### Root Cause

1. **`getAllPrograms` bypassed the cache entirely** — it called `apiFetch` directly for both
   `/api/sjon` and `/api/vit`, so search paid two full round-trips on every mount.
2. **SWR always re-emitted.** `fetchSWR` called `onData(fresh)` after every revalidation. Because
   `withListKeys` maps to new objects, an unchanged payload still produced a brand-new tree →
   every `FlatList` re-rendered → focus could jump.
3. **No timeout on `fetch`.** An unreachable NAS hung until React Native's default timeout.
4. **Filename sanitiser collided:** `key.replace(/[^a-zA-Z0-9_\-]/g, "_")` mapped
   `kvf:sjon:program:x` and `kvf_sjon_program_x` onto the same file.
5. No cache versioning, no base-URL namespacing, no eviction, no in-flight dedupe.

### Solution

- **Content-hash gate.** Every entry stores a ~64-bit fingerprint of the raw response body. A
  refetch that hashes identically refreshes only freshness metadata — subscribers are never
  notified, so object identity survives and nothing re-renders. This is the _common_ path.
- **Hash checked before `JSON.parse`.** `jsonFetcher` compares hashes on the raw text, so an
  unchanged front page costs one request and zero parsing/re-keying.
- **Conditional requests.** `If-None-Match` / `If-Modified-Since` with 304 handling; the hash gate
  makes this a pure bonus when the server sends no validators.
- **Manifest-based metadata.** A single `index.json` holds freshness for all keys, hydrated once at
  boot, so staleness checks never touch the filesystem and an "unchanged" result rewrites only that
  small file — not the payload.
- **Search index is derived, not fetched.** `allProgramsResource` merges the two _cached_ front
  pages; its hash is the pair of source hashes. Zero extra network.
- **Centralised sync.** `services/kvfPreload.ts` owns launch warm-up, foreground refresh and the
  idle interval. The native tab bar keeps every tab mounted, so per-screen refresh logic would fan
  one user action out into N identical requests.
- Also added: `AbortController` timeouts, `retryWithBackoff` with HTTP-status classification,
  FNV-1a filename hashing, `CACHE_VERSION`, base-URL namespacing, LRU eviction, in-flight dedupe,
  and `expo-image` poster prefetching.

### What Went Wrong

- ❌ Assuming "we already have SWR" meant caching was solved — the cache existed but the _emission_
  policy made every refresh as expensive as a cold load.
- ❌ Sanitising a cache key into a filename instead of hashing it.
- ❌ Leaving `getAllPrograms` outside the cache because it was "just an aggregation".

### What Worked

- ✅ Asking "what does the UI actually do when data is unchanged?" rather than only "is it cached?".
  On tvOS an unnecessary re-render is a _correctness_ bug (focus), not just a perf one.
- ✅ Separating metadata (manifest) from payload, so the cheap path stays cheap.
- ✅ Making the fetcher return `{status: "unchanged"} | {status: "ok"}` — it forces every call site
  to handle "nothing changed" explicitly instead of defaulting to re-emit.

### Key Takeaways

1. **A cache that always re-emits is only half a cache.** SWR's value is skipping the _render_, not
   just skipping the network. Gate emission on content, not on fetch completion.
2. **Hash the raw body before parsing.** It turns the common "nothing new" refresh into a
   near-free operation.
3. **Never derive a filename from a key by character substitution** — different keys collapse onto
   one file. Hash it.
4. **Own foreground/interval refresh centrally** when the tab bar keeps screens mounted; per-screen
   `useAppStateRefresh` multiplies requests by the number of live tabs.
5. **Version and namespace persistent caches.** Without `CACHE_VERSION` an app update deserialises
   old JSON into the new shape; without a base-URL namespace, switching servers serves the wrong data.
6. tvOS gives no OS-level background fetch without a native module — "background refresh" here
   means non-blocking revalidation behind visible data, not `BGTaskScheduler`.

### Files Affected

- `services/kvfCache.ts` (rewritten), `services/kvfApi.ts` (rewritten), `services/kvfPreload.ts` (new),
  `hooks/useKvfResource.ts` (new), `app/(tabs)/index.tsx`, `app/(tabs)/vit.tsx`,
  `app/(tabs)/search.tsx`, `app/(tabs)/settings.tsx`, `app/program.tsx`, `app/_layout.tsx`,
  `constants/strings.json`, `services/__tests__/kvfCache.test.ts`,
  `services/__tests__/kvfApi.conditional.test.ts`
