/**
 * Photo-based ingredient recognition. The product doc marks this "API-based"
 * for MVP but doesn't pin a vendor yet — this module is the seam to plug one
 * in (Google Cloud Vision, Clarifai, a custom model, etc.) without touching
 * any screen code. Swap `recognizeIngredientsFromImage` below for a real call.
 */

export interface RecognizedIngredient {
  name: string;
  confidence: number;
}

const RECOGNITION_ENDPOINT = process.env.EXPO_PUBLIC_INGREDIENT_RECOGNITION_URL;

export async function recognizeIngredientsFromImage(
  imageUri: string
): Promise<RecognizedIngredient[]> {
  if (!RECOGNITION_ENDPOINT) {
    if (__DEV__) {
      console.warn(
        '[recognizeIngredients] EXPO_PUBLIC_INGREDIENT_RECOGNITION_URL is not set — ' +
          'returning a mock result so the scan flow is demoable. Wire up a real vision API here.'
      );
    }
    return mockRecognize();
  }

  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    name: 'ingredient-photo.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const response = await fetch(RECOGNITION_ENDPOINT, { method: 'POST', body: formData });
  if (!response.ok) {
    throw new Error(`Ingredient recognition failed: ${response.status}`);
  }
  const data = (await response.json()) as { ingredients: RecognizedIngredient[] };
  return data.ingredients;
}

async function mockRecognize(): Promise<RecognizedIngredient[]> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return [
    { name: 'egg', confidence: 0.94 },
    { name: 'milk', confidence: 0.88 },
    { name: 'cheddar cheese', confidence: 0.71 },
  ];
}
