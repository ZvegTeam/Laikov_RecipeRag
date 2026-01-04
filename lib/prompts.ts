/**
 * Prompt service for AI content generation
 * Centralized prompt definitions for scalability and maintainability
 */

export enum PromptType {
  RECIPE_URL_EXTRACTION = "recipe_url_extraction",
  RECIPE_WEB_SEARCH = "recipe_web_search",
  // Future prompt types can be added here
  // RECIPE_SUGGESTIONS = "recipe_suggestions",
  // INGREDIENT_SUBSTITUTION = "ingredient_substitution",
}

interface RecipeContext {
  recipeName: string;
  ingredients: string;
  url?: string;
}

/**
 * Generate prompt for recipe URL extraction
 * Primary method: Extract cooking instructions from recipe URL
 */
export function getRecipeUrlExtractionPrompt(context: RecipeContext): string {
  const { recipeName, ingredients, url } = context;

  if (!url) {
    throw new Error("URL is required for recipe URL extraction prompt");
  }

  return `You are a recipe extraction assistant. Please extract the complete cooking instructions and additional information from this recipe URL: ${url}

Recipe Name: ${recipeName}
Ingredients: ${ingredients}

Please provide:
1. Step-by-step cooking instructions (detailed and clear)
2. Cooking tips and techniques
3. Recipe variations or substitutions (if any)
4. Serving suggestions
5. Any additional helpful information (difficulty level, nutrition tips, storage instructions, etc.)

Format the response as JSON with the following structure:
{
  "cooking_instructions": "Step-by-step instructions...",
  "additional_info": {
    "tips": ["tip1", "tip2"],
    "variations": ["variation1", "variation2"],
    "serving_suggestions": "suggestions text",
    "difficulty": "Easy/Medium/Hard",
    "nutrition_tips": "tips text"
  }
}`;
}

/**
 * Generate prompt for recipe web search
 * Fallback method: Search the web for recipe information
 */
export function getRecipeWebSearchPrompt(context: RecipeContext): string {
  const { recipeName, ingredients } = context;

  return `Search the web for detailed cooking instructions and recipe information for: ${recipeName}

Ingredients: ${ingredients}

Find and provide:
1. Complete step-by-step cooking instructions
2. Cooking tips and best practices
3. Recipe variations or modifications
4. Serving and presentation suggestions
5. Any additional relevant information

Format the response as structured JSON with cooking_instructions and additional_info fields:
{
  "cooking_instructions": "Step-by-step instructions...",
  "additional_info": {
    "tips": ["tip1", "tip2"],
    "variations": ["variation1", "variation2"],
    "serving_suggestions": "suggestions text",
    "difficulty": "Easy/Medium/Hard",
    "nutrition_tips": "tips text"
  }
}`;
}

/**
 * Get prompt by type
 * Centralized prompt retrieval for scalability
 */
export function getPrompt(type: PromptType, context: RecipeContext): string {
  switch (type) {
    case PromptType.RECIPE_URL_EXTRACTION:
      return getRecipeUrlExtractionPrompt(context);
    case PromptType.RECIPE_WEB_SEARCH:
      return getRecipeWebSearchPrompt(context);
    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}

/**
 * Validate prompt context based on type
 */
export function validatePromptContext(type: PromptType, context: RecipeContext): void {
  switch (type) {
    case PromptType.RECIPE_URL_EXTRACTION:
      if (!context.url) {
        throw new Error("URL is required for recipe URL extraction");
      }
      break;
    case PromptType.RECIPE_WEB_SEARCH:
      // Web search doesn't require URL
      break;
    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }

  if (!context.recipeName) {
    throw new Error("Recipe name is required");
  }

  if (!context.ingredients) {
    throw new Error("Ingredients are required");
  }
}
