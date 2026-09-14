import { DESIGN } from "@/constants/app";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { LoadingSpinner } from "./loading-spinner";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "debug" | "retry";

export interface ButtonVisualProps {
  title: string;
  variant?: ButtonVariant;
  focused?: boolean;
  disabled?: boolean;
  isLoading?: boolean;
  icon?: ReactNode;
  iconName?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/** Shared appearance only: the caller owns focus and the press target. */
export function ButtonVisual({ title, variant = "primary", focused = false, disabled = false, isLoading = false, icon, iconName, style, textStyle }: ButtonVisualProps) {
  const primary = variant === "primary" || variant === "retry";
  const color = primary ? "#141416" : variant === "destructive" ? "#FF6976" : "#F5F5F7";
  return (
    <View style={[S.surface, primary ? S.primary : S.secondary, focused && (primary ? S.primaryFocused : S.secondaryFocused), disabled && S.disabled, style]}>
      <View style={[S.content, isLoading && S.hidden]}>
        {icon ?? (iconName ? <Ionicons name={iconName} size={Platform.isTV ? 24 : 20} color={color} /> : null)}
        <Text style={[S.label, { color }, textStyle]}>{title}</Text>
      </View>
      {isLoading ? (
        <View style={S.loading}>
          <LoadingSpinner color={primary ? "#636366" : undefined} />
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
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: "#DCDCE0", borderColor: "transparent" },
  primaryFocused: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  secondary: { backgroundColor: "#242428", borderColor: "#424247" },
  secondaryFocused: { backgroundColor: "#36363C", borderColor: "#FFFFFF" },
  content: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Platform.isTV ? 12 : 8 },
  label: { fontSize: Platform.isTV ? 24 : 16, lineHeight: Platform.isTV ? 30 : 22, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1, textAlign: "center" },
  disabled: { opacity: 0.45 },
  hidden: { opacity: 0 },
  loading: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
