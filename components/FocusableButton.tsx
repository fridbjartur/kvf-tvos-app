import { Pressable, StyleSheet, type PressableProps, type TextStyle, type ViewStyle } from "react-native";
import { ButtonVisual, type ButtonVisualProps } from "./button-visual";

interface FocusableButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVisualProps["variant"];
  isLoading?: boolean;
  iconName?: ButtonVisualProps["iconName"];
  hasTVPreferredFocus?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function FocusableButton({
  title,
  variant = "primary",
  isLoading = false,
  iconName,
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
          focused={focused || false}
          disabled={disabled || isLoading}
          isLoading={isLoading}
          iconName={iconName}
          style={[style, pressed && S.pressed]}
          textStyle={textStyle}
        />
      )}
    </Pressable>
  );
}

const S = StyleSheet.create({ pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] } });
