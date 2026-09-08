import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { EQUIPMENT_CHECKLIST_OPTIONS, type SelectableEquipment } from '@/lib/equipment';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface EquipmentChecklistProps {
  selected: readonly SelectableEquipment[];
  onToggle: (equipment: SelectableEquipment) => void;
  accessibilityHint?: string;
}

/** Shared atomic equipment control used by onboarding and Kitchen Setup. */
export function EquipmentChecklist({
  selected,
  onToggle,
  accessibilityHint = 'Adds or removes this item from your kitchen',
}: EquipmentChecklistProps) {
  const { color } = useTheme();
  const [focused, setFocused] = useState<SelectableEquipment | null>(null);

  return (
    <View
      style={styles.list}
      accessibilityRole="list"
      accessibilityLabel="Cooking equipment checklist"
      accessibilityHint="Contains selectable cooking equipment items"
    >
      {EQUIPMENT_CHECKLIST_OPTIONS.map((option) => {
        const checked = selected.includes(option.id);
        const isFocused = focused === option.id;

        return (
          <Pressable
            key={option.id}
            accessible
            accessibilityRole="checkbox"
            accessibilityLabel={option.label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{ checked }}
            aria-checked={checked}
            onFocus={() => setFocused(option.id)}
            onBlur={() => setFocused(null)}
            onPress={() => onToggle(option.id)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: checked ? color.surfaceAlt : color.surface,
                borderColor: isFocused ? color.accent : color.border,
                borderWidth: isFocused ? 2 : 1,
                opacity: pressed ? 0.82 : 1,
              },
            ]}
          >
            <Text variant="bodyStrong" style={styles.label}>
              {option.label}
            </Text>
            <View
              importantForAccessibility="no-hide-descendants"
              style={[
                styles.checkbox,
                {
                  backgroundColor: checked ? color.accent : 'transparent',
                  borderColor: checked ? color.accent : color.textMuted,
                },
              ]}
            >
              {checked ? <Icon name="check" size={18} color={color.accentText} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm, width: '100%' },
  row: {
    minHeight: touchTarget.standard,
    width: '100%',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  label: { flex: 1, flexShrink: 1 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
