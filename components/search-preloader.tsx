import { isNativeSearchAvailable, TvosSearchView } from "expo-tvos-search";
import { StyleSheet, View } from "react-native";

const noop = () => {};

/**
 * Warms the native tvOS search subsystem at app launch.
 *
 * The Search tab is hidden until login, so its screen (and the expensive SwiftUI
 * `.searchable`/`UIHostingController` init) only mounts after the user connects. This parks a
 * minimal, off-screen, inert `TvosSearchView` in the root layout so that native machinery is
 * already initialized, making the first real Search open instant once the tab appears.
 *
 * Off-screen + 1×1 + opacity 0 + pointerEvents none keeps it out of the layout and out of the
 * way; it exists only to prime native init.
 */
export function SearchPreloader() {
  if (!isNativeSearchAvailable()) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <TvosSearchView results={[]} onSearch={noop} onSelectItem={noop} style={styles.view} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: -10000,
    top: -10000,
    width: 1,
    height: 1,
    opacity: 0,
  },
  view: {
    width: 1,
    height: 1,
  },
});
