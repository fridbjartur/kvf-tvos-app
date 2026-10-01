# Search layout and scroll reset

The app reserves 140 points above the native search view in its React Native
container. The library's `topInset` is zero to avoid applying the same spacing
again inside SwiftUI. This establishes the view's frame before the search field
receives focus.

Search stays mounted across tab changes. On route focus, the app calls the
patched `scrollToTop()` view method. Expo dispatches this view method on the main
queue; the method updates an observable request counter, and SwiftUI's
`ScrollViewReader` scrolls the results grid to its top anchor without animation.
The search text, results, keyboard, and native focus implementation stay in the
existing view. No UIKit view traversal or gesture overrides are added.

The React Native fallback uses `FlatList.scrollToOffset` on route focus.

## Maintaining the native patch

`patches/expo-tvos-search+2.0.0.patch` adds the native method and its TypeScript
ref type. `yarn install` applies it through `patch-package` in `postinstall`.
Patch failures stop installation so upgrades cannot silently remove the method.
Review the patch when upgrading `expo-tvos-search`, and remove it if upstream
provides an equivalent method.

A new native Apple TV build is required after applying or changing this patch;
reloading JavaScript alone does not add the method to an existing binary.

## Verification

Run `yarn test --runInBand --watchman=false app/__tests__/search.lifecycle.test.tsx`
and `yarn typecheck`.

On Apple TV, verify the input clears the tab bar on first entry. Search for a
term with several rows, scroll down, switch tabs, and return. Results should
start at the top with the same search term. Check native keyboard input and
Siri Remote navigation on real hardware.

The implementation follows [Expo's view method API](https://docs.expo.dev/modules/module-api/)
and [SwiftUI's ScrollViewReader API](https://developer.apple.com/documentation/swiftui/scrollviewreader).
