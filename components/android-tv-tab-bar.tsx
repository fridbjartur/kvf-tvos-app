import Ionicons from "@expo/vector-icons/Ionicons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { useIsFocused } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, BackHandler, Pressable, StyleSheet, Text, TVFocusGuideView, View } from "react-native";
import { ANDROID_TV_NAV_HEIGHT, useAndroidTVNavigation } from "@/contexts/AndroidTVNavigationContext";
import { tvSize } from "@/utils/tvLayout";
import strings from "@/constants/strings.json";

const tabs: Record<string, { label: string; icon?: keyof typeof Ionicons.glyphMap }> = {
  index: { label: strings.tabs.sjon },
  vit: { label: strings.tabs.vit },
  miks: { label: strings.tabs.miks },
  ljod: { label: strings.tabs.ljod },
  schedule: { label: strings.tabs.live },
  search: { label: strings.tabs.search, icon: "search" },
};

const NAV_HEIGHT = tvSize(ANDROID_TV_NAV_HEIGHT);
/** Time for a returning screen to restore its focus after Android's recovery. */
const RECOVERY_SETTLE_MS = 100;
const noop = () => () => {};
const zero = () => 0;
const no = () => false;

/**
 * Android TV's counterpart to the tvOS tab bar. Moving focus along the bar
 * selects tabs, the bar scrolls away with the focused screen, and Back from
 * content returns focus to it before leaving the app.
 */
export function AndroidTVTabBar({ state, navigation }: BottomTabBarProps) {
  const nav = useAndroidTVNavigation();
  const isFocused = useIsFocused();
  const scrolledAway = useSyncExternalStore(nav?.subscribe ?? noop, nav?.isScrolledAway ?? no);
  const focusRequest = useSyncExternalStore(nav?.subscribe ?? noop, nav?.focusRequest ?? zero);
  const [barFocused, setBarFocused] = useState(false);
  // Only the app's first screen starts on the bar. Returning from a program
  // restores the card that opened it.
  const [initialFocus, setInitialFocus] = useState(true);
  const selectedRef = useRef<View>(null);
  const focusedTabRef = useRef<string | null>(null);

  const isFocusedRef = useRef(isFocused);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Registered once, so focused detail screens (program, player, radio
  // category) subscribe later and handle Back before this listener.
  useEffect(() => {
    if (!nav) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      // At the bar, Back follows Android and leaves the app.
      if (!isFocusedRef.current || nav.isBarFocused()) return false;
      nav.focusBar();
      return true;
    });
    return () => subscription.remove();
  }, [nav]);

  useEffect(() => {
    if (focusRequest === 0) return;
    // Fabric runs view commands before the commit that makes the bar
    // focusable again; wait a frame for that commit to mount.
    const frame = requestAnimationFrame(() => selectedRef.current?.requestTVFocus());
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const focusable = isFocused && (!scrolledAway || barFocused);
  const translateY = nav ? nav.scrollY.interpolate({ inputRange: [0, NAV_HEIGHT], outputRange: [0, -NAV_HEIGHT], extrapolate: "clamp" }) : 0;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]} pointerEvents="box-none">
      <LinearGradient colors={["rgba(0,0,0,0.65)", "transparent"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <TVFocusGuideView autoFocus focusable={focusable} trapFocusLeft trapFocusRight style={styles.bar}>
        {state.routes.map((route, index) => {
          const tab = tabs[route.name];
          if (!tab) return null;
          const selected = state.index === index;
          return (
            <Pressable
              key={route.key}
              ref={selected ? selectedRef : undefined}
              disabled={!focusable}
              hasTVPreferredFocus={initialFocus && isFocused && selected}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onFocus={() => {
                const movedAlongBar = nav?.tabFocused() ?? true;
                focusedTabRef.current = route.key;
                setInitialFocus(false);
                setBarFocused(true);
                // Focus entering the bar never changes tabs or scrolls yet: Android's
                // focus recovery lands on the bar when a screen is pushed or popped,
                // and the returning screen then restores its own focus (this tab's
                // blur arrives first). If focus stays, show the selected tab from the top.
                if (!movedAlongBar) {
                  setTimeout(() => {
                    if (focusedTabRef.current !== route.key) return;
                    if (selected) nav?.scrollToTop();
                    else selectedRef.current?.requestTVFocus();
                  }, RECOVERY_SETTLE_MS);
                  return;
                }
                nav?.scrollToTop();
                if (selected) return;
                // Moving along the bar selects tabs, as on tvOS. Reselecting
                // Ljóð must preserve its nested category and scroll.
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onBlur={() => {
                if (focusedTabRef.current === route.key) focusedTabRef.current = null;
                setBarFocused(false);
                nav?.tabBlurred();
              }}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              style={({ focused }) => [styles.tab, selected && styles.selected, focused && styles.focused]}>
              {({ focused }) => (
                <>
                  {tab.icon && <Ionicons name={tab.icon} size={tvSize(26)} color={focused ? "#141414" : "#D5D5D8"} />}
                  <Text style={[styles.label, selected && styles.selectedLabel, focused && styles.focusedLabel]}>{tab.label}</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </TVFocusGuideView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, height: NAV_HEIGHT, zIndex: 100, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: tvSize(4),
    marginTop: tvSize(28),
    padding: tvSize(8),
    borderRadius: tvSize(48),
    backgroundColor: "rgba(32,32,36,0.97)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: tvSize(12),
    paddingHorizontal: tvSize(30),
    minHeight: tvSize(64),
    borderRadius: tvSize(40),
  },
  selected: { backgroundColor: "rgba(255,255,255,0.10)" },
  focused: { backgroundColor: "#FFFFFF" },
  label: { color: "#B9B9BE", fontSize: tvSize(26), fontWeight: "600" },
  selectedLabel: { color: "#FFFFFF" },
  focusedLabel: { color: "#141414" },
});
