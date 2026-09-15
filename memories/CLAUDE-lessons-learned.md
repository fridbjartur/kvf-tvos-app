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

---

## Nested API Sections, Flat TV Navigation (September 2026)

### Problem

`kvf-scraper-api` went from two flat sections (`sjon`, `vit`) to a two-level tree of five —
`sjon`, `sjon/vit`, `sjon/miks`, `ljod`, `ljod/vit` — and added a per-channel schedule endpoint.
`/api/vit` was deleted outright (the scraper pins the 404 with a regression test), so the app's
VIT tab was broken against the live API.

The first attempt mirrored the API's shape in the UI: two channel tabs (Sjón, Ljóð), each with an
in-screen selector for its sub-sections. It was rejected on the right grounds — **this is a TV app,
and the remote is not a mouse.** Every extra level of in-screen chrome is another D-pad journey
before the user sees content.

### Root Cause

Two separate things. Structurally, sections had no representation of their own: the section string
was hardcoded in each tab screen, in `kvfPreload`'s warm-up lists, and _sniffed from a URL_ in
search (`program.path?.includes("/vit/")`) — a test that cannot distinguish `sjon/vit` from
`ljod/vit`, so it silently sent radio programs to the TV endpoint.

Conceptually: an API's hierarchy is not automatically an information architecture. TV's five
sections do not have equal weight — three are TV genres the viewer picks between constantly, two
are radio audiences picked once per session.

### Solution

- `constants/sections.ts` — one registry: `SectionId` (flat slug) ↔ `ApiSectionPath` (the
  `/`-nested wire form), plus label, channel and video/audio kind.
- **The three TV sections became top-level tabs** (Sjón · VIT · MiKS). One press, no chrome.
- **Ljóð became a picker screen** — two large cards, nothing else — pushing to a `/section` stack
  route. Radio's split is a once-per-session choice, so it costs a screen rather than two tabs.
- Beinleiðis merged the old live tab with `/api/{channel}/schedule`: now-playing banner, live
  channel tiles, and the day's listing under a Sjón/Ljóð tab strip.

### Key Takeaways

1. **Depth in the API is not depth in the UI.** Flatten what users pick between often; spend a
   screen on what they pick once. Mirroring the backend's tree was the wrong default.
2. **On tvOS, prefer a tab over an in-screen selector.** The native tab bar is always reachable and
   is not subject to the scroll-containment bug. Anything rendered _above_ scrollable content is.
3. **If a selector must be in-screen, it must live inside the same ScrollView as the content it
   filters.** tvOS blocks an upward focus move whose target lies outside a scroll view with
   `contentOffset.y > 0`. This is why Beinleiðis' channel tabs sit inside its ScrollView. Do **not**
   reach for `TVFocusGuideView` — it already made this worse once.
4. **Never prefix-match a nested API path.** `startsWith("/api/sjon")` also matches
   `/api/sjon/vit/…`. Split on the `/programs/` marker and look the prefix up exactly.
5. **Derive identity, don't sniff it.** Tagging each program with its section when the search index
   is merged removed the `path.includes("/vit/")` guess from two call sites — and made radio
   searchable for the first time.
6. **Across five sources, `Promise.all` is a liability.** One flaky front page emptied the whole
   search index. Gather per section and put an `x` placeholder in the hash for failures, so a later
   recovery still registers as a change.
7. **Don't run a clock to show "what's on now".** A 30s ticker re-renders the schedule 120×/hour,
   and on tvOS every needless re-render is a focus bug. Compute progress once per payload and let
   `kvfPreload` poll the registered schedule at its 5-minute TTL.
8. **Focus needs a continuous chain, and gaps trap the user.** The schedule listing first made only
   the rows with a program link focusable — tidy in theory, broken in practice: KVF links few TV
   rows, so the focusable ones ended up hundreds of points apart, tvOS's directional search could
   not reach across the gap, and the page could be scrolled into but never out of. Every row is
   focusable now, even the inert ones. **Correcting an earlier takeaway in this file:** "a row with
   nowhere to go should be a plain View" is wrong whenever that row sits between two focusable
   ones. A harmless dead end beats a broken chain.
9. **Keep a screen's focusables in one left-aligned column.** tvOS finds the next target by
   projecting straight along the direction of travel. Day-nav buttons parked on the far right with
   `justifyContent: "space-between"` projected up into empty space and trapped focus, even though
   everything was in the same ScrollView. Same reason the screen's title was dropped: it pushed the
   tab strip out of the column the play button sits in.
10. **Height above the first focusable is height the user must climb back through.** The tab bar is
    outside the ScrollView, so escaping upward only works from offset 0. Every heading and spacer
    above the topmost focusable makes that climb longer.
11. **Select on press, never on focus.** Focus-select swaps content under every tab the user D-pads
    across on the way to the one they wanted.
12. **Sub-navigation belongs on a stack nested inside the tab.** The Ljóð picker went through three
    attempts before landing:
    - Pushing `/section` on the **root** stack covered the native tab bar — a root push always does.
    - Swapping the tab screen's own content kept the tab bar but left no way back: **the Menu key
      is not enabled for JS anywhere in this app**, so `useTVEventHandler`'s `"menu"` event never
      fires and Menu goes to the system instead. `/program` only appears to handle Menu because
      UIKit's navigation controller pops it — the JS handler there is dead code.
    - The fix is a `Stack` in `app/(tabs)/ljod/_layout.tsx`. A push inside the tab keeps the tab bar
      on screen with Ljóð selected, and gives UIKit a navigation controller to pop, so the remote's
      back button works without touching the Menu key at all.
      **Rule: if a screen needs a back button on tvOS, it must be a pushed route.** In-screen state
      plus a JS Menu handler is not a substitute.

### Files Affected

- New: `constants/sections.ts`, `components/section-screen.tsx`, `components/segmented-tabs.tsx`,
  `components/now-playing-card.tsx`, `components/channel-tile.tsx`,
  `components/schedule-entry-row.tsx`, `app/(tabs)/ljod/_layout.tsx`, `app/(tabs)/ljod/index.tsx`,
  `app/(tabs)/ljod/[section].tsx`, `app/(tabs)/vit.tsx`,
  `app/(tabs)/miks.tsx`, `app/(tabs)/ljod.tsx`, `app/(tabs)/schedule.tsx`,
  `constants/__tests__/sections.test.ts`, `services/__tests__/kvfSchedule.test.ts`
- Changed: `types/kvf.ts`, `services/kvfApi.ts`, `services/kvfCache.ts` (CACHE_VERSION 2→3),
  `services/kvfPreload.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`,
  `app/(tabs)/search.tsx`, `app/program.tsx`, `components/kvf-program-card.tsx`,
  `constants/strings.json`, `services/__tests__/kvfApi.conditional.test.ts`
- Deleted: `app/(tabs)/live.tsx`

---

## Centrally-Driven Refreshes Were Invisible to the UI (September 2026)

### Problem

Inside a program, the cached episode list painted instantly (correct), but a newly
published episode appeared only after the background fetch finished — with no
warning that anything was still in flight. The same on every main tab. Users read
the silent swap as a glitch rather than as an update.

### Root Cause

Two separate gaps, both in the seam between `kvfCache` and the UI:

1. `useKvfResource` already exposed `isRefreshing`, but **no screen destructured
   it** — all four call sites took only `{ data, isLoading, error }`.
2. More fundamentally, `isRefreshing` could not have worked for the case that
   matters. It was fed by `swr`'s `onRefreshing` callback, which only fires for a
   revalidation _that hook started_. The refreshes users actually notice — the
   15-minute interval and the foreground sweep in `kvfPreload` — go through
   `ensure()`, which takes no callbacks at all. Those fetches reached the screen
   only via the `subscribe()` data callback, i.e. as a finished fact.

Separately, `isLoading` was true on the first paint of _every_ screen, even with
the payload already in `memData`, because the state seed was unconditionally
`data: null` and `cacheGet` is async.

### Solution

- `kvfCache` broadcasts its own in-flight state: `subscribeStatus(key, cb)` /
  `isRevalidating(key)`, notified from inside `revalidate()`. Every network
  round-trip funnels through there, so the signal is correct no matter who
  started the fetch.
- `useKvfResource` takes `isRefreshing` from that broadcast instead of from
  `swr`'s callback, and seeds state from a new synchronous `cachePeek()` so a
  warm screen never renders a spinner frame.
- `useDelayedFlag` smooths the flag (show after 400ms, hold 700ms) so a 304 —
  the common case — never flashes an indicator.
- Episode placeholders render as the FlatList's **header**, not as list data, so
  real episodes keep their identity and tvOS focus while placeholders come and go.

### What Went Wrong

- ❌ Assumed a field existing in a hook's public interface meant it was wired to
  anything. `isRefreshing` had been dead on both ends since it was written.
- ❌ Nearly passed `isLoading` to `FocusableButton` for the play button. That prop
  disables the button, and a disabled button drops the tvOS focus it holds —
  mid-press. The existing label-swap was deliberate; the comment now says so.

### What Worked

- ✅ Tracing the _call path_ of the refresh the user complained about, rather than
  the component rendering it. The bug was two layers below the screen.
- ✅ Treating "who initiates the fetch" as the design question. Broadcasting from
  the single choke point (`revalidate`) fixed every screen at once.

### Key Takeaways

1. An observable that only reports work _this_ caller started is not an
   observable. Broadcast from the choke point every path funnels through.
2. Stale-while-revalidate needs a third UI state. `loading` vs `idle` cannot
   express "showing you the old list, checking for a newer one".
3. On tvOS, never express a loading state by disabling a focusable control.
   Placeholders belong in list headers, not in list data.
4. A spinner frame on warm data is a bug, not a formality: if the payload is in
   memory, read it synchronously during render.

### Files Touched

- New: `components/refresh-indicator.tsx`, `components/shimmer-block.tsx`,
  `hooks/useDelayedFlag.ts`
- Changed: `services/kvfCache.ts`, `hooks/useKvfResource.ts`,
  `components/tv-screen-scroll-view.tsx`, `components/section-screen.tsx`,
  `app/program.tsx`, `app/(tabs)/schedule.tsx`, `app/(tabs)/search.tsx`,
  `constants/strings.json`

---

## "No script URL provided" Only When Building From Xcode (September 2026)

### Problem

Running on a physical Apple TV via `yarn ios` worked. Building and running the same app
from Xcode crashed at launch with `No script URL provided ...
unsanitizedScriptURLString = (null)`.

### Root Cause

Two facts compounding:

1. The _Bundle React Native code and images_ build phase sets `SKIP_BUNDLING=1` for every
   `*Debug*` configuration, so the Debug device product has no `main.jsbundle` at all.
2. `expo run:ios` starts the Metro dev server as part of the command; Xcode's Run does
   not — the Expo template has no "Start Packager" build phase. So an Xcode build
   installed a JS-less app with no server to load from.

The `(null)` rather than a named host is `RCTBundleURLProvider` behaviour on device: it
reads the host from `ip.txt` baked into the `.app`, probes `http://<ip>:8081/status`, and
returns `nil` when the probe fails — it does **not** fall back to `localhost` off-simulator.
No jsbundle fallback either, so `bundleURL()` came back `nil`.

### Solution

Keep `yarn start` running before ⌘R, or use the new `yarn ios:device`. For a Mac-free
install, `yarn ios:device:release` embeds the bundle. No app code changed — this was a
workflow gap, and the docs now say so.

### What Went Wrong

- ❌ `CLAUDE.md` claimed `yarn start` "Refreshes dev IP". It never did — `start` is
  literally `expo start`, and nothing in the repo writes a dev IP anywhere. A false line
  in the docs sent debugging toward an IP problem that did not exist.
- ❌ The error text ("Make sure the packager is running") is accurate but the `(null)`
  reads like a misconfiguration, which invites native-side theories first.

### What Worked

- ✅ Inspecting the actual build products instead of reasoning about the config:
  `Debug-appletvos/KVF.app` had `ip.txt` = the correct current LAN IP and **no**
  `main.jsbundle`, while `Release-appletvos/KVF.app` had the bundle. That pinned the
  cause to "no server", not "wrong host", in one command.
- ✅ `curl http://<ip>:8081/status` to confirm nothing was listening, and
  `socketfilterfw --getglobalstate` to rule out the firewall before blaming the network.

### Key Takeaways

1. `yarn ios` and Xcode ⌘R are **not** equivalent on this project — one starts Metro, the
   other does not. Any "works with yarn, fails in Xcode" report starts here.
2. On a physical device `RCTBundleURLProvider` never falls back to `localhost`. A `(null)`
   script URL means the `ip.txt` host did not answer, not that no host was configured.
3. A stale `ip.txt` after a DHCP change produces the identical error with Metro running.
   Compare `ipconfig getifaddr en0` against the `ip.txt` inside the built `.app`.
4. Check documented commands against `package.json` before trusting them. The stale
   "refreshes dev IP" comment cost time.

### Files Affected

- `package.json` (added `ios:device`, `ios:device:release`)
- `CLAUDE.md` (corrected `yarn start` description, added Xcode note to Platform Context)
- `memories/CLAUDE-development.md` ("Running on a Physical Apple TV")
