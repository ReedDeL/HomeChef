// Supabase Edge Function (Deno). Proxies photo-based ingredient recognition
// to Clarifai's `food-item-recognition` model so the Clarifai key stays
// server-side — this app's source is public, so it can never live in client
// code or an EXPO_PUBLIC_* env var.
//
// Deploy:
//   supabase functions deploy recognize-ingredients
//   supabase secrets set CLARIFAI_API_KEY=<your Clarifai Personal Access Token>
//
// Then point the app at it:
//   EXPO_PUBLIC_INGREDIENT_RECOGNITION_URL=https://<project-ref>.supabase.co/functions/v1/recognize-ingredients
//
// Response shape matches what src/features/inventory/recognizeIngredients.ts expects:
//   { ingredients: { name: string; confidence: number }[] }

const CLARIFAI_MODEL_URL = 'https://api.clarifai.com/v2/models/food-item-recognition/outputs';
const MIN_CONFIDENCE = 0.5;
const MAX_RESULTS = 10;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ClarifaiConcept {
  name: string;
  value: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = Deno.env.get('CLARIFAI_API_KEY');
  if (!apiKey) {
    return json({ error: 'CLARIFAI_API_KEY is not configured on this function' }, 500);
  }

  let base64Image: string;
  try {
    const form = await req.formData();
    const file = form.get('image');
    if (!(file instanceof File)) {
      return json({ error: 'Expected multipart/form-data with an "image" file field' }, 400);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    base64Image = base64Encode(bytes);
  } catch {
    return json({ error: 'Could not read the uploaded image' }, 400);
  }

  const clarifaiResponse = await fetch(CLARIFAI_MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_app_id: { user_id: 'clarifai', app_id: 'main' },
      inputs: [{ data: { image: { base64: base64Image } } }],
    }),
  });

  if (!clarifaiResponse.ok) {
    const detail = await clarifaiResponse.text();
    return json({ error: `Clarifai request failed: ${clarifaiResponse.status}`, detail }, 502);
  }

  const payload = await clarifaiResponse.json();
  const concepts: ClarifaiConcept[] = payload?.outputs?.[0]?.data?.concepts ?? [];

  const ingredients = concepts
    .filter((c) => c.value >= MIN_CONFIDENCE)
    .slice(0, MAX_RESULTS)
    .map((c) => ({ name: c.name.toLowerCase(), confidence: c.value }));

  return json({ ingredients });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function base64Encode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
