import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type IconName =
  | 'camera'
  | 'check'
  | 'cog'
  | 'meal'
  | 'arrow-right'
  | 'arrow-left'
  | 'swap'
  | 'calendar'
  | 'pantry'
  | 'sunrise'
  | 'sun'
  | 'moon';

const iconNames: Record<IconName, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  camera: 'camera-outline',
  meal: 'silverware-fork-knife',
  check: 'check',
  cog: 'cog-outline',
  'arrow-right': 'arrow-right',
  'arrow-left': 'arrow-left',
  swap: 'swap-horizontal',
  calendar: 'calendar-month-outline',
  pantry: 'fridge-outline',
  sunrise: 'weather-sunset-up',
  sun: 'white-balance-sunny',
  moon: 'moon-waning-crescent',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
}

/** Shared Expo-compatible vector icons for controls and status affordances. */
export function Icon({ name, size = 24, color }: IconProps) {
  return (
    <MaterialCommunityIcons name={iconNames[name]} size={size} color={color} accessible={false} />
  );
}
