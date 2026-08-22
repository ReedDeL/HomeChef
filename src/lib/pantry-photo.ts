import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  MAX_PHOTOS,
  toCandidates,
  type DetectedItem,
  type PantryCandidate,
} from '@/lib/ingredients/candidates';
import { supabase } from '@/lib/supabase';

/**
 * The I/O half of the photo → pantry pipeline: compress,
 * send, hand the result to the pure mapping in `ingredients/candidates.ts`.
 *
 * Nothing here writes to the pantry. Every detected item goes to the
 * confirmation sheet first, because the user is the only one who can tell a
 * misread from a real ingredient — and a wrong item written silently is the
 * capture-time origin of the inventory drift (risk R3) that rots
 * recommendations.
 *
 * Normalization is client-side to keep the canonical mapping consistent with
 * the vocabulary shipped in this build. It runs against
 * `src/data/ingredients.json`, the same vocabulary the engine matches against.
 * Two things make the client the better seat:
 *
 *  - Correcting a detected name has to re-resolve instantly. Server-side
 *    normalization would make every keystroke a network round trip, or would
 *    need a second implementation on the client — and two normalizers that
 *    disagree is exactly the drift this shared vocabulary is meant to prevent.
 *  - The vocabulary ships with the app. A server normalizing against a newer
 *    list could hand back ids this build has never heard of.
 */

/** The model's input-size contract; anything larger is wasted upload. */
const TARGET_EDGE = 640;

/** The client upload contract's approximate JPEG quality. */
const JPEG_QUALITY = 0.7;

export class PantryPhotoError extends Error {}

/**
 * Resize to 640×640 and JPEG-encode before upload. A 12 MP photo costs the
 * user's data allowance and our egress for no accuracy gain, since the model
 * downsamples to this size anyway.
 */
export async function compressForUpload(uri: string): Promise<string> {
  const rendered = await ImageManipulator.manipulate(uri)
    .resize({ width: TARGET_EDGE, height: TARGET_EDGE })
    .renderAsync();

  const saved = await rendered.saveAsync({
    base64: true,
    compress: JPEG_QUALITY,
    format: SaveFormat.JPEG,
  });

  if (!saved.base64) {
    throw new PantryPhotoError('Image compression returned no data.');
  }

  return saved.base64;
}

/**
 * Send photos for recognition and return candidates ready for confirmation.
 *
 * Throws rather than returning an empty list on failure: an empty fridge and a
 * broken network need different words in the UI, and collapsing them would
 * tell a user with no signal that their kitchen looks empty.
 */
export async function analyzePantryPhotos(uris: readonly string[]): Promise<PantryCandidate[]> {
  if (uris.length === 0) return [];
  if (uris.length > MAX_PHOTOS) {
    throw new PantryPhotoError(`Send at most ${MAX_PHOTOS} photos at a time.`);
  }

  const images = await Promise.all(uris.map(compressForUpload));

  const { data, error } = await supabase.functions.invoke<{ items: DetectedItem[] }>(
    'analyze-pantry-photo',
    { body: { images, mimeType: 'image/jpeg' } }
  );

  if (error) throw new PantryPhotoError(error.message);
  if (!data || !Array.isArray(data.items)) {
    throw new PantryPhotoError('Photo recognition returned an unexpected response.');
  }

  return toCandidates(data.items);
}

export {
  CONFIDENCE_THRESHOLD,
  MAX_PHOTOS,
  acceptedIngredientIds,
  correctCandidate,
  toCandidates,
  type DetectedItem,
  type PantryCandidate,
} from '@/lib/ingredients/candidates';
