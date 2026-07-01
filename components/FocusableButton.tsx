import { DESIGN } from "@/constants/app";
import React from "react";
import { ActivityIndicator, Platform, Pressable, PressableProps, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "debug" | "retry";

interface FocusableButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
  focus?: boolean;
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function FocusableButton({
  title,
  variant = "primary",
  isLoading = false,
  icon,
  focus = false,
  hasTVPreferredFocus = false,
  disabled = false,
  style,
  textStyle,
  ...pressableProps
}: FocusableButtonProps) {
  const getButtonStyle = (focused: boolean): ViewStyle => {
    const baseStyle = [
      styles.button,
      variant === "primary" && styles.primaryButton,
      variant === "primary" && focused && styles.primaryButtonFocused,
      variant === "secondary" && styles.secondaryButton,
      variant === "secondary" && focused && styles.secondaryButtonFocused,
      variant === "destructive" && styles.destructiveButton,
      variant === "destructive" && focused && styles.destructiveButtonFocused,
      variant === "debug" && styles.debugButton,
      variant === "debug" && focused && styles.debugButtonFocused,
      variant === "retry" && styles.retryButton,
      variant === "retry" && focused && styles.retryButtonFocused,
      (disabled || isLoading) && styles.buttonDisabled,
      style,
    ].filter(Boolean) as ViewStyle[];
    return StyleSheet.flatten(baseStyle);
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = [
      styles.buttonText,
      variant === "primary" && styles.primaryButtonText,
      variant === "secondary" && styles.secondaryButtonText,
      variant === "destructive" && styles.destructiveButtonText,
      variant === "debug" && styles.debugButtonText,
      variant === "retry" && styles.retryButtonText,
      (disabled || isLoading) && styles.buttonTextDisabled,
      textStyle,
    ].filter(Boolean) as TextStyle[];
    return StyleSheet.flatten(baseStyle);
  };

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed, focused }) => [getButtonStyle(focus || focused || false), pressed && styles.buttonPressed]}
      disabled={disabled || isLoading}
      isTVSelectable={!disabled && !isLoading}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      tvParallaxProperties={{ magnification: 1.05, pressMagnification: 1.0 }}>
      <View style={styles.buttonContent}>
        {isLoading ? (
          <ActivityIndicator color={variant === "primary" ? "#000000" : "#FFFFFF"} size="small" />
        ) : (
          <>
            {icon}
            <Text style={getTextStyle()}>{title}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Platform.isTV ? 15 : 10,
    paddingHorizontal: Platform.isTV ? 38 : 32,
    borderRadius: DESIGN.BORDER_RADIUS_SMALL,
    alignItems: "center",
    justifyContent: "center",
    minHeight: Platform.isTV ? 60 : 50,
    minWidth: Platform.isTV ? 260 : 200,
    borderWidth: Platform.isTV ? 3 : 2,
    borderColor: "transparent",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Platform.isTV ? 12 : 8,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontSize: Platform.isTV ? 28 : 18,
    fontWeight: "600",
  },
  buttonTextDisabled: { opacity: 0.6 },

  // Primary — white background, black text
  primaryButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "transparent",
    opacity: 0.8,
  },
  primaryButtonFocused: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
    opacity: 1,
  },
  primaryButtonText: { color: "#000000" },

  // Secondary — transparent with white border
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.5)",
  },
  secondaryButtonFocused: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.2,
    elevation: 6,
  },
  secondaryButtonText: { color: "#FFFFFF" },

  // Destructive
  destructiveButton: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  destructiveButtonFocused: {
    backgroundColor: "rgba(255,59,48,0.15)",
    borderColor: "#FF3B30",
    shadowColor: "#FF3B30",
    shadowOpacity: 0.4,
    elevation: 6,
  },
  destructiveButtonText: { color: "#FF3B30", fontSize: Platform.isTV ? 24 : 17 },

  // Debug
  debugButton: {
    backgroundColor: "transparent",
    borderColor: "#8E8E93",
  },
  debugButtonFocused: {
    backgroundColor: "rgba(142,142,147,0.15)",
    borderColor: "#FFFFFF",
    shadowColor: "#8E8E93",
    shadowOpacity: 0.4,
    elevation: 6,
  },
  debugButtonText: { color: "#8E8E93", fontSize: Platform.isTV ? 24 : 17 },

  // Retry — white background
  retryButton: {
    backgroundColor: "#FFFFFF",
    borderColor: "transparent",
  },
  retryButtonFocused: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
    shadowColor: "#FFFFFF",
    shadowOpacity: 0.4,
    elevation: 8,
  },
  retryButtonText: { color: "#000000" },
});
