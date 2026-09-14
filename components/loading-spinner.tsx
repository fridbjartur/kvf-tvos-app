import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";

interface LoadingSpinnerProps {
  size?: "small" | "large";
  color?: string;
  animating?: boolean;
  hidesWhenStopped?: boolean;
}

/** A neutral indicator with a stable frame, including tvOS's oversized glyph. */
export function LoadingSpinner({ size = "small", color = "#98989D", animating = true, hidesWhenStopped = true }: LoadingSpinnerProps) {
  return (
    <View style={[S.frame, size === "large" ? S.large : S.small]} pointerEvents="none">
      <ActivityIndicator
        size={size}
        color={color}
        animating={animating}
        hidesWhenStopped={hidesWhenStopped}
        style={Platform.isTV && Platform.OS === "ios" && size === "small" ? S.tvSmall : undefined}
      />
    </View>
  );
}

const S = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  small: { width: 24, height: 24 },
  large: { width: 48, height: 48 },
  tvSmall: { transform: [{ scale: 0.5 }] },
});
