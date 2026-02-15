import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

const TAB_COLORS = {
  active: '#4A90D9',
  inactive: '#9CA3AF',
  background: '#FFFFFF',
  border: '#F0F0F0',
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TAB_COLORS.active,
        tabBarInactiveTintColor: TAB_COLORS.inactive,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: TAB_COLORS.background,
          borderTopColor: TAB_COLORS.border,
          borderTopWidth: 0.5,
          paddingTop: 4,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
          }),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: 'Resumen',
          tabBarIcon: ({ color }) => <IconSymbol size={26} name="list.bullet.clipboard.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
