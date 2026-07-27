import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipMultiSelectProps<T extends string> {
  options: ChipOption<T>[];
  selected: T[];
  onChange: (next: T[]) => void;
}

export function ChipMultiSelect<T extends string>({
  options,
  selected,
  onChange,
}: ChipMultiSelectProps<T>) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <View style={styles.wrap}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => toggle(option.value)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D0D5CE',
    backgroundColor: 'white',
  },
  chipSelected: {
    backgroundColor: '#1F6F50',
    borderColor: '#1F6F50',
  },
  chipLabel: {
    color: '#333',
    fontSize: 14,
  },
  chipLabelSelected: {
    color: 'white',
    fontWeight: '600',
  },
});
