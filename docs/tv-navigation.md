# TV navigation

The native tab bar owns tab selection. Ljóð has its own stack, anchored at the
picker. Radio categories, program details, and the player use `useScreenBack`:
only the focused screen subscribes to BackHandler. On tvOS it enables Menu
capture while a detail screen is active, then releases it at the tab roots.
The category dismisses to its picker; the player and program pop one level.
Retained screens have no Menu listeners, and repeated presses during a pop are
consumed once. Ljóð also disables TV tab-reselection resets so returning focus
to its tab does not dismiss the category or move its scroll position.

Scrollable tab screens use `TVScreenScrollView`. Its first native screen child
is a vertical ScrollView with automatic content insets on every tab. The hero's
artwork extends upward by the top safe-area inset, while its separate focusable
rectangle stays below the tab bar. This keeps the image behind navigation
without overlapping the tab bar's focus region or disabling UIKit's scroll
coordination. Put headers and controls inside the scroll view; do not add a
safe-area spacer on top of automatic insets. The inner
TVFocusGuideView remembers the last focused child and excludes inactive retained
screens from focus. It does not trap Up or Down or repeatedly request preferred
focus.

Use full-width `TVFocusGuideView autoFocus` regions when controls on neighboring
rows do not align. Beinleiðis uses these around its selector, live banner,
channel row, and schedule navigation. Horizontal catalog lists remain virtualized;
the surrounding guide includes the category title. Decorative hero controls are
Views with the shared small corner radius, leaving one actual focusable action
per banner. The hero guide traps only Left/Right; Up/Down remain native exits.
Full-banner parallax is disabled. Slide selection survives refreshed arrays,
tvOS tap events with `eventKeyAction: 1` advance normally (the tap recognizer
emits Ended only). Android down/up pairs advance on down only. Do not apply
Android's key-up filter to tvOS. Auto-advance stops while the banner is focused
or its screen is inactive. Slide animations stop on cleanup.

`useKvfResource` scopes data, error, and loading callbacks to the active resource
and request. Late completions after a category change cannot clear the new page.

References:

- [React Native TV focus guides](https://github.com/react-native-tvos/react-native-tvos#code-changes)
- [Expo native tabs and scroll views](https://docs.expo.dev/router/advanced/native-tabs/)

## Automated checks

`yarn test --runInBand --watchman=false` includes component regressions for the
scroll/focus boundary, inactive screens, Ljóð selection and return, hero actions,
and live-screen focus guides. Hook tests cover out-of-order category requests,
revisiting the same category, errors, retries, and disabled resources.

These checks do not simulate UIKit's spatial focus algorithm.

## Required device acceptance pass

Use an Apple TV remote or the tvOS simulator remote. Also run these paths on
Android TV before shipping that platform.

1. Enter Sjón, VIT, and MiKS. Move right along a shelf, then Up through the hero
   or earlier shelves to the native tabs. Repeat after scrolling several rows.
2. Enter Beinleiðis. Focus the second live channel tile and press Up. It should
   reach the banner action without first moving left. Continue Up to the channel
   selector and native tabs. Repeat with Ljóð selected and from the day controls.
3. Enter Ljóð and select each category. Open a program, return, then return to the
   picker. Repeat, including rapid double Select. There must be one category
   screen per selection, and the picker should remember the selected card.
4. Leave Ljóð while a category is open, then re-enter. Confirm visible content
   and focus are usable. Reselect the active tab: on TV the current category and
   scroll position should stay intact. Back/Menu should still return to the picker.
5. Repeat the Ljóð paths with a cold cache and slow/offline API. Loading or errors
   must remain visible without letting an old request replace the active page.
6. Enter Search, move between the search input and results, and return Up to the tabs.
7. Confirm Back returns player → program → radio category → picker, one screen
   per press. At a tab root, Menu should retain normal system behavior.
8. On a hero page, confirm the artwork reaches the top edge behind the navigation
   bar, including after a cold load. Move Left/Right on the hero: one press should
   move one slide without shifting or scaling the banner. Move Up/Down to exit.
   Confirm the decorative play button has the same small radius as the cards.
