import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Text } from '@/components/ui/Text';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface StepFooterProps {
  onForward: () => void;
  forwardLabel?: string;
  forwardHint?: string;
  forwardDisabled?: boolean;
  onBack?: () => void;
  backLabel?: string;
  backHint?: string;
  secondaryAction?: {
    label: string;
    onPress: () => void;
    accessibilityHint?: string;
  };
}

/**
 * Step navigation footer with Back and Forward buttons.
 *
 * Provides clear, accessible navigation between multi-step screens with
 * touch targets meeting WCAG AA specifications.
 */
export function StepFooter({
  onForward,
  forwardLabel = 'Continue',
  forwardHint = 'Goes to the next step',
  forwardDisabled = false,
  onBack,
  backLabel = 'Back',
  backHint = 'Returns to the previous step',
  secondaryAction,
}: StepFooterProps) {
  const { color } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.buttonRow}>
        {onBack ? (
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            accessibilityHint={backHint}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              {
                borderColor: color.border,
                backgroundColor: color.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text variant="bodyStrong" tone="default">
              ‹ {backLabel}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.forwardWrapper}>
          <PrimaryButton
            label={forwardLabel}
            onPress={onForward}
            accessibilityHint={forwardHint}
            disabled={forwardDisabled}
          />
        </View>
      </View>

      {secondaryAction ? (
        <PrimaryButton
          label={secondaryAction.label}
          variant="ghost"
          onPress={secondaryAction.onPress}
          accessibilityHint={secondaryAction.accessibilityHint ?? secondaryAction.label}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.sm,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    width: '100%',
  },
  backButton: {
    height: touchTarget.primaryCtaHeight,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  forwardWrapper: {
    flex: 1,
  },
});
