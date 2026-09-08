import { Icon } from '@/components/ui/Icon';
import { View } from 'react-native';
import { Tabs } from 'expo-router';

import { PRIMARY_TABS } from '@/lib/navigation';
import { radius, space, type as typeScale } from '@/theme/tokens';
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
          minHeight: 72,
          paddingTop: space.sm,
        },
        tabBarLabelStyle: { fontSize: typeScale.caption.fontSize, fontWeight: '600' },
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
            tabBarIcon: ({ size, focused }) => (
              <View
                style={{
                  width: 48,
                  height: 32,
                  borderRadius: radius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? color.surfaceAlt : 'transparent',
                }}
              >
                <Icon
                  name={focused ? tab.activeIcon : tab.icon}
                  size={size ?? 24}
                  color={focused ? color.accent : color.textMuted}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
