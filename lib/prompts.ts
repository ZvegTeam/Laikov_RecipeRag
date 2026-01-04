/**
 * Prompt service for AI content generation
 * Centralized prompt definitions for scalability and maintainability
 */

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

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
 * Zod schema for validating recipe details response
 * This is the single source of truth for the response structure
 */
export const recipeDetailsZodSchema = z.object({
  cooking_instructions: z.string().describe("Complete step-by-step cooking instructions"),
  additional_info: z
    .object({
      tips: z.array(z.string()).optional().describe("Cooking tips and techniques"),
      variations: z.array(z.string()).optional().describe("Recipe variations or substitutions"),
      serving_suggestions: z.string().optional().describe("Serving and presentation suggestions"),
      difficulty: z.enum(["Easy", "Medium", "Hard"]).optional().describe("Recipe difficulty level"),
      nutrition_tips: z.string().optional().describe("Nutrition tips and information"),
    })
    .optional(),
});

export type RecipeDetailsResponse = z.infer<typeof recipeDetailsZodSchema>;

/**
 * JSON Schema for recipe details response
 * Generated from Zod schema to ensure consistency
 * Used to ensure structured JSON output from Gemini AI
 * The schema is extracted from the zodToJsonSchema result
 */
/**
 * Generate JSON Schema from Zod schema
 * This ensures the schema is always in sync with the Zod validation
 */
const rawSchema = zodToJsonSchema(recipeDetailsZodSchema, {
  name: "RecipeDetails",
});

// Extract the actual schema (zodToJsonSchema may wrap it in definitions)
// For Gemini API, we need the plain schema object
function extractSchema(schema: unknown): {
  type: string;
  properties: Record<string, unknown>;
  required?: string[];
} {
  if (
    typeof schema === "object" &&
    schema !== null &&
    "definitions" in schema &&
    typeof schema.definitions === "object" &&
    schema.definitions !== null &&
    "RecipeDetails" in schema.definitions
  ) {
    return schema.definitions.RecipeDetails as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
  }
  return schema as {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const recipeDetailsSchema = extractSchema(rawSchema);

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

You MUST return a valid JSON object that matches the provided JSON schema exactly. The response must be valid JSON only, without any markdown formatting or additional text.`;
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

You MUST return a valid JSON object that matches the provided JSON schema exactly. The response must be valid JSON only, without any markdown formatting or additional text.`;
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
