import { Tabs } from 'expo-router';

import { type as typeScale } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * Two tabs, and there will not be a third for launch. Home is the product;
 * Pantry exists because the pantry is always somewhat wrong and correcting it
 * has to be reachable from anywhere (risk R3).
 */
export default function TabsLayout() {
  const { color } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border },
        tabBarLabelStyle: { fontSize: typeScale.caption.fontSize },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Cook', tabBarAccessibilityLabel: 'Cook, decide what to make' }}
      />
      <Tabs.Screen
        name="pantry"
        options={{ title: 'Pantry', tabBarAccessibilityLabel: 'Pantry, what you have' }}
      />
    </Tabs>
  );
}
