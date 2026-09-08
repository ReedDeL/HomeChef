import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = 'camera' | 'check' | 'cog' | 'meal';

const iconNames: Record<IconName, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  camera: 'camera-outline',
  meal: 'silverware-fork-knife',
  check: 'check',
  cog: 'cog-outline',
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
