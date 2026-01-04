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

// Database recipe type (matches Supabase schema)
export interface Recipe {
  id: string;
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
  cooking_instructions?: string;
  additional_info?: {
    tips?: string[];
    variations?: string[];
    serving_suggestions?: string;
    difficulty?: string;
    nutrition_tips?: string;
  };
  instructions_fetched_at?: string;
  created_at?: string;
  updated_at?: string;
  similarity?: number; // Computed similarity score from search
}
