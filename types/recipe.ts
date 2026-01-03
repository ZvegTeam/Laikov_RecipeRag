// Recipe type definitions

export interface MongoRecipe {
  _id: { $oid: string };
  name: string;
  ingredients: string;
  description?: string;
  url?: string;
  image?: string;
  cookTime?: string;
  prepTime?: string;
  recipeYield?: string;
  datePublished?: string;
  source?: string;
  ts?: { $date: number };
  totalTime?: string;
  recipeCategory?: string;
  creator?: string;
  dateModified?: string;
}

export interface ParsedRecipe {
  original_id: string;
  name: string;
  ingredients: string;
  description?: string;
  url?: string;
  image?: string;
  cook_time?: string;
  prep_time?: string;
  recipe_yield?: string;
  date_published?: string;
  source?: string;
}
