import { EQUIPMENT, type Equipment } from '@/engine/types';

export type SelectableEquipment = Exclude<Equipment, 'unclassified'>;
export type CookingEquipment = Exclude<SelectableEquipment, 'none'>;

export const COOKING_EQUIPMENT_OPTIONS: readonly {
  id: CookingEquipment;
  label: string;
}[] = [
  { id: 'microwave', label: 'Microwave' },
  { id: 'stove', label: 'Stovetop' },
  { id: 'oven', label: 'Oven' },
  { id: 'kettle', label: 'Electric kettle' },
  { id: 'air_fryer', label: 'Air fryer' },
  { id: 'rice_cooker', label: 'Rice cooker' },
  { id: 'blender', label: 'Blender' },
  { id: 'toaster_oven', label: 'Toaster oven' },
];

export const NO_COOKING_EQUIPMENT_OPTION = {
  id: 'none',
  label: 'No cooking equipment',
} as const satisfies { id: SelectableEquipment; label: string };

export const EQUIPMENT_CHECKLIST_OPTIONS = [
  ...COOKING_EQUIPMENT_OPTIONS,
  NO_COOKING_EQUIPMENT_OPTION,
] as const;

const SELECTABLE_EQUIPMENT = new Set<Equipment>(
  EQUIPMENT.filter((item) => item !== 'unclassified')
);

const LEGACY_TIERS: Readonly<Record<string, readonly CookingEquipment[]>> = {
  microwave: ['microwave'],
  kettle: ['microwave', 'kettle'],
  full: ['microwave', 'stove', 'oven', 'kettle'],
};

/**
 * Keeps persisted equipment inside the closed enum and enforces the mutually
 * exclusive no-equipment choice. An empty list remains empty so onboarding can
 * distinguish an accidental omission from an explicit "none" selection.
 */
export function normalizeOwnedEquipment(values: unknown): SelectableEquipment[] {
  if (!Array.isArray(values)) return [];

  const known = [...new Set(values)].filter(
    (item): item is SelectableEquipment =>
      typeof item === 'string' && SELECTABLE_EQUIPMENT.has(item as Equipment)
  );

  return known.includes('none') ? ['none'] : known;
}

export function toggleOwnedEquipment(
  current: readonly Equipment[],
  equipment: SelectableEquipment
): SelectableEquipment[] {
  const normalized = normalizeOwnedEquipment(current);
  if (equipment === 'none') return normalized.includes('none') ? [] : ['none'];

  const cookingEquipment = normalized.filter((item) => item !== 'none');
  return cookingEquipment.includes(equipment)
    ? cookingEquipment.filter((item) => item !== equipment)
    : [...cookingEquipment, equipment];
}

/**
 * Idempotently upgrades the persisted Zustand state. Explicit equipment is
 * authoritative; legacy tiers are expanded once and merged with known extras.
 * The shallow spread preserves pantry, safety constraints, plans, reminders,
 * history, and fields added by newer store versions.
 */
export function migrateEquipmentState(persisted: unknown): Record<string, unknown> {
  if (persisted === null || typeof persisted !== 'object' || Array.isArray(persisted)) {
    return { equipment: [] };
  }

  const state = persisted as Record<string, unknown>;
  const { tierId, extras, ...preserved } = state;

  if (Object.prototype.hasOwnProperty.call(state, 'equipment')) {
    return { ...preserved, equipment: normalizeOwnedEquipment(state.equipment) };
  }

  const tierEquipment = typeof tierId === 'string' ? (LEGACY_TIERS[tierId] ?? []) : [];
  return {
    ...preserved,
    equipment: normalizeOwnedEquipment([
      ...tierEquipment,
      ...(Array.isArray(extras) ? extras : []),
    ]),
  };
}
