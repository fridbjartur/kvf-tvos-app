import { DESIGN } from "@/constants/app";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { LoadingSpinner } from "./loading-spinner";

export interface ButtonVisualProps {
  title: string;
  focused?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  iconName?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Shared appearance only: the caller owns focus and the press target. */
export function ButtonVisual({ title, focused = false, disabled = false, isLoading = false, iconName, style, textStyle }: ButtonVisualProps) {
  const color = focused ? "#141416" : "#FFFFFF";
  return (
    <View style={[S.surface, focused && S.focused, disabled && S.disabled, style]}>
      <View style={[S.content, isLoading && S.hidden]}>
        {iconName ? <Ionicons name={iconName} size={Platform.isTV ? 24 : 20} color={color} /> : null}
        <Text style={[S.label, { color }, textStyle]}>{title}</Text>
      </View>
      {isLoading ? (
        <View style={S.loading}>
          <LoadingSpinner color={color} />
        </View>
      ) : null}
    </View>
  );
}

const S = StyleSheet.create({
  surface: {
    minHeight: Platform.isTV ? 64 : 48,
    minWidth: Platform.isTV ? 220 : 144,
    paddingHorizontal: Platform.isTV ? 28 : 20,
    paddingVertical: Platform.isTV ? 12 : 10,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    borderWidth: Platform.isTV ? 3 : 2,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  focused: { backgroundColor: "#FFFFFF" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Platform.isTV ? 12 : 8 },
  label: { fontSize: Platform.isTV ? 24 : 16, lineHeight: Platform.isTV ? 30 : 22, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1, textAlign: "center" },
  disabled: { opacity: 0.45 },
  hidden: { opacity: 0 },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
