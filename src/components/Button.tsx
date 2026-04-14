import { forwardRef, useState } from "react";
import type { ReactNode } from "react";
import type { PressableProps, StyleProp, TextStyle, View, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text, View as RNView } from "react-native";
import { palette, spacing, type } from "../theme";

type ButtonVariant = "default";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<PressableProps, "style"> & {
  label: string;
  selected?: boolean;
  focused?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
};

const variantStyles: Record<ButtonVariant, {
  base: ViewStyle;
  selected: ViewStyle;
  focused: ViewStyle;
  selectedFocused: ViewStyle;
  text: TextStyle;
  selectedText: TextStyle;
  focusedText: TextStyle;
}> = {
  default: {
    base: {
      backgroundColor: "transparent",
      borderColor: palette.text,
      borderWidth: 1.5,
    },
    selected: {
      backgroundColor: "rgba(255,255,255,0.16)",
      borderColor: "rgba(255,255,255,0.8)",
    },
    selectedFocused: {
      borderColor: palette.text,
      backgroundColor: palette.text,
    },
    focused: {
      backgroundColor: palette.text,
      borderColor: palette.text,
    },
    text: {
      color: palette.text,
      fontWeight: "700",
    },
    selectedText: {
      color: palette.text,
      fontWeight: "800",
    },
    focusedText: {
      color: palette.background,
      fontWeight: "800",
    },
  },
};

const sizeStyles: Record<ButtonSize, { button: ViewStyle; text: TextStyle }> = {
  sm: {
    button: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    text: {
      fontSize: type.body,
    },
  },
  md: {
    button: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    text: {
      fontSize: type.bodyLarge,
    },
  },
  lg: {
    button: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm,
    },
    text: {
      fontSize: type.bodyLarge,
    },
  },
};

export const Button = forwardRef<View, ButtonProps>(function Button({
  label,
  selected = false,
  focused: focusedProp,
  variant = "default",
  size = "md",
  style,
  textStyle,
  contentStyle,
  leftAccessory,
  rightAccessory,
  onBlur,
  onFocus,
  disabled,
  focusable: focusableProp,
  ...props
}, ref) {
  const [isFocused, setIsFocused] = useState(false);
  const currentVariant = variantStyles[variant];
  const currentSize = sizeStyles[size];
  const focused = focusedProp ?? isFocused;

  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      disabled={disabled}
      focusable={focusableProp ?? !disabled}
      onBlur={(event) => {
        setIsFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setIsFocused(true);
        onFocus?.(event);
      }}
      style={[
        styles.button,
        currentVariant.base,
        currentSize.button,
        selected && currentVariant.selected,
        focused && currentVariant.focused,
        selected && focused && currentVariant.selectedFocused,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    >
      <RNView style={[styles.content, contentStyle]}>
        {leftAccessory}
        <Text
          style={[
            styles.label,
            currentVariant.text,
            currentSize.text,
            selected && currentVariant.selectedText,
            focused && currentVariant.focusedText,
            disabled && styles.disabledLabel,
            textStyle,
          ]}
        >
          {label}
        </Text>
        {rightAccessory}
      </RNView>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    borderRadius: 999,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  label: {
    textAlign: "center",
  },
  disabled: {
    opacity: 0.45,
  },
  disabledLabel: {
    color: palette.textMuted,
  },
});
