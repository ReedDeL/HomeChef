import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
}

/**
 * Visual and accessible step progress indicator for multi-step flows.
 */
export function StepIndicator({ currentStep, totalSteps, label }: StepIndicatorProps) {
  const { color } = useTheme();

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="header"
      accessibilityLabel={`Step ${currentStep} of ${totalSteps}${label ? `: ${label}` : ''}`}
    >
      <View style={styles.headerRow}>
        <Text variant="caption" tone="accent">
          Step {currentStep} of {totalSteps}
        </Text>
        {label ? (
          <Text variant="caption" tone="muted">
            {label}
          </Text>
        ) : null}
      </View>
      <View style={styles.barRow}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;

          return (
            <View
              key={stepNum}
              style={[
                styles.segment,
                {
                  backgroundColor: isCurrent
                    ? color.accent
                    : isCompleted
                      ? color.ready
                      : color.border,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
    marginBottom: space.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    gap: space.xs,
    height: 4,
    width: '100%',
  },
  segment: {
    flex: 1,
    height: '100%',
    borderRadius: radius.full,
  },
});
