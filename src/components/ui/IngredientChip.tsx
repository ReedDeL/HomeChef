import { Chip } from '@/components/ui/Chip';
import { lookupIngredient } from '@/data/catalog';
import type { IngredientId } from '@/engine/types';

interface IngredientChipProps {
  id: IngredientId;
  /** Present in the pantry. Absent chips read as "you'd need this". */
  inPantry?: boolean;
  onToggle?: (id: IngredientId) => void;
  /** Long-press: "I don't have this." Omit to make the chip inert. */
  onRemove?: (id: IngredientId) => void;
}

/**
 * The one ingredient chip in the app (spec §5.1).
 *
 * This exists as a single shared component on purpose. Pantry drift (risk R3)
 * is the failure mode that quietly rots recommendations: the pantry is always
 * somewhat wrong, and if correcting it is a chore the user stops trusting the
 * results and leaves. The mitigation is that *every* ingredient name anywhere
 * in the app is correctable in one gesture. Re-implementing this per screen is
 * how one screen ends up without that gesture, so it is deliberately not
 * possible to render an ingredient any other way.
 */
export function IngredientChip({ id, inPantry = false, onToggle, onRemove }: IngredientChipProps) {
  const label = lookupIngredient(id)?.displayName ?? id;

  return (
    <Chip
      label={label}
      selected={inPantry}
      onPress={onToggle ? () => onToggle(id) : undefined}
      onLongPress={onRemove ? () => onRemove(id) : undefined}
      readOnly={!onToggle && !onRemove}
      accessibilityLabel={inPantry ? `${label}, in your pantry` : label}
      accessibilityHint={
        onRemove ? `Double tap to toggle. Long press to remove ${label} from your pantry.` : ''
      }
    />
  );
}
