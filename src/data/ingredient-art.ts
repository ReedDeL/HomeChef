import egg from '../../assets/ingredient-art/egg.png';
import chicken from '../../assets/ingredient-art/chicken.png';
import beef from '../../assets/ingredient-art/beef.png';
import yogurt from '../../assets/ingredient-art/yogurt.png';
import milk from '../../assets/ingredient-art/milk.png';
import butter from '../../assets/ingredient-art/butter.png';
import cheese from '../../assets/ingredient-art/cheese.png';
import rice from '../../assets/ingredient-art/rice.png';
import oats from '../../assets/ingredient-art/oats.png';
import pasta from '../../assets/ingredient-art/pasta.png';
import bread from '../../assets/ingredient-art/bread.png';
import flour from '../../assets/ingredient-art/flour.png';
import sugar from '../../assets/ingredient-art/sugar.png';
import onion from '../../assets/ingredient-art/onion.png';
import garlic from '../../assets/ingredient-art/garlic.png';
import potato from '../../assets/ingredient-art/potato.png';
import tomato from '../../assets/ingredient-art/tomato.png';
import carrot from '../../assets/ingredient-art/carrot.png';
import lemon from '../../assets/ingredient-art/lemon.png';
import apple from '../../assets/ingredient-art/apple.png';
import banana from '../../assets/ingredient-art/banana.png';
import oil from '../../assets/ingredient-art/oil.png';
import salt from '../../assets/ingredient-art/salt.png';
import pepper from '../../assets/ingredient-art/pepper.png';
import fallback from '../../assets/ingredient-art/fallback.png';

export const INGREDIENT_ART = {
  chicken,
  beef,
  yogurt,
  egg,
  milk,
  butter,
  cheese,
  rice,
  oats,
  pasta,
  bread,
  flour,
  sugar,
  onion,
  garlic,
  potato,
  tomato,
  carrot,
  lemon,
  apple,
  banana,
  oil,
  salt,
  pepper,
  fallback,
} as const;
export type IngredientArt = keyof typeof INGREDIENT_ART;
