import { Tabs } from 'expo-router';

import { PRIMARY_TABS } from '@/lib/navigation';
import { type as typeScale } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/**
 * The primary journeys are Now, Plan, and Pantry. Now is the product home;
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
      {PRIMARY_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarAccessibilityLabel: tab.accessibilityLabel }}
        />
      ))}
    </Tabs>
  );
}
