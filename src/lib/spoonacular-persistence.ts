export interface PersistableSpoonacularRecipe {
  id: string;
  title: string;
  imageUrl: string | null;
}

export function toPersistableSpoonacularRecipe(
  input: unknown
): PersistableSpoonacularRecipe | null {
  if (!isRecord(input)) return null;
  if (!isNonEmptyString(input.id) || !isNonEmptyString(input.title)) return null;
  if (input.imageUrl !== null && typeof input.imageUrl !== 'string') return null;

  return {
    id: input.id,
    title: input.title,
    imageUrl: input.imageUrl,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
