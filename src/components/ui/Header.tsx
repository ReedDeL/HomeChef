import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useSafeBack } from '@/lib/useSafeBack';
import { space, touchTarget } from '@/theme/tokens';

export interface HeaderBackButtonProps {
  /** Optional custom handler. If omitted, uses safe back navigation. */
  onPress?: () => void;
  /** Label for the back button. Defaults to 'Back'. */
  label?: string;
  /** Accessibility label for screen readers. Defaults to label. */
  accessibilityLabel?: string;
  /** Accessibility hint explaining what pressing back does. */
  accessibilityHint?: string;
  /** Fallback URL if navigation history is empty. Defaults to '/'. */
  fallbackHref?: string;
  /** Visual tone of the text. Defaults to 'accent'. */
  tone?: 'accent' | 'default' | 'muted';
  /** Optional container style override. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Standard Header Back Button meeting WCAG AA touch targets (min 44x44pt).
 * Provides safe back navigation to ensure the user never gets stuck.
 */
export function HeaderBackButton({
  onPress,
  label = 'Back',
  accessibilityLabel,
  accessibilityHint = 'Returns to the previous screen',
  fallbackHref = '/',
  tone = 'accent',
  style,
}: HeaderBackButtonProps) {
  const safeBack = useSafeBack(fallbackHref);
  const handlePress = onPress ?? safeBack;

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Back to ${label}`}
      accessibilityHint={accessibilityHint}
      onPress={handlePress}
      style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Text variant="heading" tone={tone}>
        ‹ {label}
      </Text>
    </Pressable>
  );
}

export interface HeaderProps {
  /** Optional title in the header */
  title?: string | ReactNode;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Whether to display the back button. Defaults to true. */
  showBack?: boolean;
  /** Optional custom back click handler. If omitted, uses safe back navigation. */
  onBack?: () => void;
  /** Custom label for the back button (e.g. 'Back', 'Results', 'Pantry', 'Cook') */
  backLabel?: string;
  /** Accessibility label for the back button */
  backAccessibilityLabel?: string;
  /** Accessibility hint for the back button */
  backHint?: string;
  /** Fallback route if navigation history is empty. Defaults to '/' */
  fallbackHref?: string;
  /** Visual tone for back button text. Defaults to 'accent' */
  backTone?: 'accent' | 'default' | 'muted';
  /** Optional custom left node (overrides standard back button if provided) */
  leftAction?: ReactNode;
  /** Optional right action component (e.g. Settings link, step indicator badge, close button) */
  rightAction?: ReactNode;
  /** Optional container style override */
  style?: StyleProp<ViewStyle>;
}

/**
 * Global UI Header for consistent screen navigation across the application.
 */
export function Header({
  title,
  subtitle,
  showBack = true,
  onBack,
  backLabel = 'Back',
  backAccessibilityLabel,
  backHint = 'Returns to the previous screen',
  fallbackHref = '/',
  backTone = 'accent',
  leftAction,
  rightAction,
  style,
}: HeaderProps) {
  return (
    <View style={[styles.headerContainer, style]}>
      <View style={styles.leftContainer}>
        {leftAction ? (
          leftAction
        ) : showBack ? (
          <HeaderBackButton
            onPress={onBack}
            label={backLabel}
            accessibilityLabel={backAccessibilityLabel}
            accessibilityHint={backHint}
            fallbackHref={fallbackHref}
            tone={backTone}
          />
        ) : null}
      </View>

      {title ? (
        <View style={styles.titleContainer}>
          {typeof title === 'string' ? (
            <Text variant="heading" numberOfLines={1} style={styles.titleText}>
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle ? (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.rightContainer}>{rightAction ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: touchTarget.standard,
    width: '100%',
  },
  leftContainer: {
    minHeight: touchTarget.standard,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  titleText: {
    textAlign: 'center',
  },
  rightContainer: {
    minHeight: touchTarget.standard,
    justifyContent: 'center',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  backButton: {
    minHeight: touchTarget.standard,
    minWidth: touchTarget.standard,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
});
