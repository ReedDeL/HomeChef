import type { Equipment, Minutes, Relaxation } from '@/engine/types';

/**
 * Display formatting for engine values.
 *
 * Lives outside `src/engine/` because the engine deals in canonical ids and has
 * no opinion about how they read to a human — and because anything the engine
 * imports has to stay pure.
 */

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  microwave: 'Microwave',
  stove: 'Stove',
  oven: 'Oven',
  air_fryer: 'Air fryer',
  kettle: 'Kettle',
  blender: 'Blender',
  rice_cooker: 'Rice cooker',
  toaster_oven: 'Toaster oven',
  none: 'No equipment',
  unclassified: 'Unknown equipment',
};

export function formatEquipment(equipment: readonly Equipment[]): string {
  if (equipment.length === 0) return EQUIPMENT_LABELS.none;
  return equipment.map((item) => EQUIPMENT_LABELS[item]).join(' · ');
}

export function formatDuration(minutes: Minutes): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * Cuisine values arrive from TheMealDB as a mix of adjectives and country
 * names — "british" alongside "france" and "netherlands". Title-casing is all
 * we can honestly do without a curated mapping.
 */
export function formatCuisine(cuisine: string): string {
  return cuisine.replace(/\b\w/g, (character) => character.toUpperCase());
}

/**
 * Relaxation copy is written for the banner, which is a sentence to the user
 * and not a debug label: it says what was given up, in the words they chose it
 * with (Technical Spec §4.3).
 */
export function formatRelaxation(relaxation: Relaxation): string {
  switch (relaxation.kind) {
    case 'time_widened':
      return `Nothing fits ${relaxation.from} min. Here's what works in ${relaxation.to}.`;
    case 'cuisine_dropped':
      return `Nothing ${formatCuisine(relaxation.cuisine)} fits. Showing everything else.`;
    case 'bucket_promoted':
      return "You're a couple of ingredients short on these.";
    case 'spoonacular_expansion':
      // Never rendered: escalation adds options without removing constraints,
      // so there is nothing to disclose (Technical Spec §4.3).
      return '';
  }
}
