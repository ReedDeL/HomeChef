import { MaterialCommunityIcons } from '@expo/vector-icons';
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
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopColor: color.border,
          minHeight: 56,
        },
        tabBarLabelStyle: { fontSize: typeScale.caption.fontSize },
        tabBarItemStyle: { minHeight: 44 },
      }}
    >
      {PRIMARY_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.accessibilityLabel,
            tabBarIcon: ({ color: iconColor, size, focused }) => (
              <MaterialCommunityIcons
                name={focused ? tab.activeIcon : tab.icon}
                size={size ?? 24}
                color={iconColor}
                accessible={false}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
