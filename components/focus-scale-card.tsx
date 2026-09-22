/**
 * Shared TV focus behavior: a TouchableOpacity wrapping a card that springs
 * to `scaleTo` and fades in a border overlay while focused.
 *
 * Used by the program cards (home/vit/search), episode cards (program screen)
 * and channel tiles (live screen) so the animation logic lives in one place.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, TouchableOpacity, type AccessibilityRole, type AccessibilityState, type StyleProp, type ViewStyle } from "react-native";

const SPRING = { tension: 220, friction: 22, useNativeDriver: true } as const;

interface FocusSpringOptions {
  /** Card scale while focused. */
  scaleTo?: number;
  /** Border overlay opacity while NOT focused (e.g. 0.5 for an "active" card). */
  restBorderOpacity?: number;
}

/**
 * Focus state + spring-animated scale/border-opacity values.
 * The Animated.Values are created once via useState lazy init (they are
 * mutated imperatively by Animated, never read during render).
 */
export function useFocusSpring({ scaleTo = 1.05, restBorderOpacity = 0 }: FocusSpringOptions = {}) {
  const [focused, setFocused] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));
  const [borderOpacity] = useState(() => new Animated.Value(restBorderOpacity));

  // Latest option values for the stable focus/blur callbacks.
  const optsRef = useRef({ scaleTo, restBorderOpacity });
  useEffect(() => {
    optsRef.current = { scaleTo, restBorderOpacity };
  }, [scaleTo, restBorderOpacity]);

  // Selection can change while this card is blurred (e.g. another episode is
  // selected). Keep its resting outline in sync without waiting for another blur.
  useEffect(() => {
    if (!focused) Animated.spring(borderOpacity, { toValue: restBorderOpacity, ...SPRING }).start();
  }, [borderOpacity, focused, restBorderOpacity]);

  const onFocus = useCallback(() => {
    setFocused(true);
    Animated.spring(scale, { toValue: optsRef.current.scaleTo, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: 1, ...SPRING }).start();
  }, [scale, borderOpacity]);

  const onBlur = useCallback(() => {
    setFocused(false);
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
    Animated.spring(borderOpacity, { toValue: optsRef.current.restBorderOpacity, ...SPRING }).start();
  }, [scale, borderOpacity]);

  return { focused, scale, borderOpacity, onFocus, onBlur };
}

interface FocusScaleCardProps extends FocusSpringOptions {
  onPress?: () => void;
  /** Called when the card gains focus (after the animation is kicked off). */
  onFocus?: () => void;
  onBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  disabled?: boolean;
  isTVSelectable?: boolean;
  activeOpacity?: number;
  /** Style for the outer TouchableOpacity (padding / width). */
  style?: StyleProp<ViewStyle>;
  /** Style for the scaled card. */
  cardStyle?: StyleProp<ViewStyle>;
  /** Style for the border overlay whose opacity animates with focus. */
  borderStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  /** Card content. Pass a function to receive the current focused state. */
  children: ReactNode | ((focused: boolean) => ReactNode);
  /** Rendered inside the touchable but below/outside the scaled card. */
  footer?: ReactNode;
}

export function FocusScaleCard({
  onPress,
  onFocus,
  onBlur,
  hasTVPreferredFocus,
  disabled,
  isTVSelectable = true,
  activeOpacity = 0.95,
  scaleTo,
  restBorderOpacity,
  style,
  cardStyle,
  borderStyle,
  accessibilityLabel,
  accessibilityRole = "button",
  accessibilityState,
  children,
  footer,
}: FocusScaleCardProps) {
  const { focused, scale, borderOpacity, onFocus: animateFocus, onBlur: animateBlur } = useFocusSpring({ scaleTo, restBorderOpacity });

  const handleFocus = useCallback(() => {
    animateFocus();
    onFocus?.();
  }, [animateFocus, onFocus]);

  const handleBlur = useCallback(() => {
    animateBlur();
    onBlur?.();
  }, [animateBlur, onBlur]);

  return (
    <TouchableOpacity
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={activeOpacity}
      isTVSelectable={isTVSelectable}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      style={style}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      accessibilityRole={accessibilityRole}>
      <Animated.View style={[cardStyle, { transform: [{ scale }] }]}>
        {typeof children === "function" ? children(focused) : children}
        <Animated.View style={[borderStyle, { opacity: borderOpacity }]} pointerEvents="none" />
      </Animated.View>
      {footer}
    </TouchableOpacity>
  );
}
