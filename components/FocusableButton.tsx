import React from "react";
import { Pressable, StyleSheet, type PressableProps, type TextStyle, type ViewStyle } from "react-native";
import { ButtonVisual, type ButtonVisualProps } from "./button-visual";

export type { ButtonVariant } from "./button-visual";

interface FocusableButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVisualProps["variant"];
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconName?: ButtonVisualProps["iconName"];
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
  iconName,
  focus = false,
  hasTVPreferredFocus = false,
  disabled = false,
  style,
  textStyle,
  accessibilityLabel,
  ...pressableProps
}: FocusableButtonProps) {
  return (
    <Pressable
      {...pressableProps}
      disabled={disabled || isLoading}
      isTVSelectable={!disabled && !isLoading}
      hasTVPreferredFocus={hasTVPreferredFocus}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || isLoading, busy: isLoading }}
      tvParallaxProperties={{ enabled: false }}>
      {({ pressed, focused }) => (
        <ButtonVisual
          title={title}
          variant={variant}
          focused={focus || focused || false}
          disabled={disabled || isLoading}
          isLoading={isLoading}
          icon={icon}
          iconName={iconName}
          style={[style, pressed && S.pressed]}
          textStyle={textStyle}
        />
      )}
    </Pressable>
  );
}

const S = StyleSheet.create({ pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] } });
