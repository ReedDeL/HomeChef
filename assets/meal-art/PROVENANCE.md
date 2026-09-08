# Meal serving illustrations

`servings.png` is an original AI-generated serving-illustration atlas created
for HomeChef on September 8, 2026 using the built-in image-generation tool.
It contains 5 columns by 8 rows. Mapping is explicit in `src/data/meal-art.ts`;
the final tile is a neutral empty place setting for unknown recipes.

These are illustrative serving suggestions, not photographs of tested recipes.
Ingredients, allergens, equipment and portions are determined exclusively by
the recipe data, never by the artwork. Existing approved recipe photo URLs
take precedence; missing or failed photos use these bundled illustrations.
No images from the retired third-party catalog have been reintroduced.

## Generation prompt

Create ONE production sprite atlas for the HomeChef recipe app: 5 columns and 8 rows, exactly 40 equal square cells, portrait aspect ratio 5:8, no gutters, no borders, no text or numerals, no logos. This is a single technical atlas image used directly by an app. Each cell is a food serving illustration with photorealistic editorial food textures, overhead view, a centered white ceramic plate/bowl/mug on identical warm cream background. Dishes entirely inside their own cell with 15% margin on all sides; no objects crossing cell boundaries. Natural warm daylight, appetizing but ordinary home cooking, no cutlery, no elaborate decorative garnish. Exact row-major order:
Row 1: tuna pasta in bowl; baked potato with butter; spaghetti with red tomato sauce; golden peanut brittle pieces; chocolate chip cookie.
Row 2: rice with mixed vegetables; scrambled eggs in mug; plain porridge in bowl; baked potato with butter; steamed broccoli bowl.
Row 3: macaroni cheese in mug; white cod fillet with lemon wedge; rice with green peas; cooked green beans with garlic; cheesy scrambled eggs in mug.
Row 4: black beans and yellow sweetcorn bowl; porridge topped with banana slices and cinnamon; sliced honey glazed carrots; herbed couscous bowl; cooked spinach with garlic and lemon.
Row 5: pink salmon fillet with lemon wedge; orange spiced lentils bowl; plain quinoa bowl; buttered sliced mushrooms; porridge with peanut butter.
Row 6: chickpeas with cooked tomato; small personal cheese and tomato pizza; cut bean and cheese burrito; cut scrambled egg breakfast burrito; cheese quesadilla wedges.
Row 7: macaroni cheese in mug; baked potato topped with melted cheddar; steamed rice mixed vegetables bowl; cinnamon sugar toast; golden grilled cheese sandwich cut in half.
Row 8: peanut butter jelly sandwich cut in half; scrambled eggs on white plate; toast with butter and red jam; tuna salad sandwich; neutral empty white plate with folded cream napkin (generic fallback).
Ensure exact 5-column 8-row grid geometry, 40 cells, one specified dish in each cell, evenly sized bowls and plates; no repeated neighboring scenes.
