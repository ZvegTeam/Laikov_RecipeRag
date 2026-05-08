/**
 * Prompt types and context for recipe-details chain.
 */

import type { BaseMessage } from "@langchain/core/messages";

export enum PromptType {
  RECIPE_URL_EXTRACTION = "recipe_url_extraction",
  RECIPE_WEB_SEARCH = "recipe_web_search",
  RECIPE_RAG_SYSTEM = "recipe_rag_system",
  // Future prompt types can be added here
  // RECIPE_SUGGESTIONS = "recipe_suggestions",
  // INGREDIENT_SUBSTITUTION = "ingredient_substitution",
}

export interface RecipeContext {
  recipeName: string;
  ingredients: string;
  url?: string;
}

/** Interface for DI; use defaultPromptsService or provide a mock for tests */
export interface IPromptsService {
  getPromptMessages(type: PromptType, context: RecipeContext): Promise<BaseMessage[]>;
}
