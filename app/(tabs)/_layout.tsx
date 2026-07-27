import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#1F6F50' }}>
      <Tabs.Screen name="index" options={{ title: 'What to Cook' }} />
      <Tabs.Screen name="inventory" options={{ title: 'Pantry' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
      <Tabs.Screen name="shopping-list" options={{ title: 'Shopping List' }} />
    </Tabs>
  );
}
