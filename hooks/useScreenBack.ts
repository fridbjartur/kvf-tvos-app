import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler, Platform, TVEventControl } from "react-native";

// Focus effects can overlap during a stack transition. One screen's cleanup
// must not disable Menu while another screen still needs it.
let menuOwners = 0;

export function useScreenBack(onBack: () => void) {
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useFocusEffect(
    useCallback(() => {
      if (!Platform.isTV && Platform.OS !== "android") return;

      let handled = false;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        // Consume repeats during the pop transition without popping twice.
        if (!handled) {
          handled = true;
          onBackRef.current();
        }
        return true;
      });

      const appleTV = Platform.isTV && Platform.OS === "ios";
      if (appleTV && menuOwners++ === 0) TVEventControl.enableTVMenuKey();

      return () => {
        subscription.remove();
        if (appleTV && --menuOwners === 0) TVEventControl.disableTVMenuKey();
      };
    }, []),
  );
}
