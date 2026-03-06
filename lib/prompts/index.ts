/**
 * Prompt service for AI content generation
 * Uses LangChain ChatPromptTemplate for URL extraction and web-search prompts.
 * Centralized prompt definitions for scalability and maintainability.
 */

import type { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { promptTemplates } from "./templates";
import type { IPromptsService, RecipeContext } from "./types";
import { PromptType } from "./types";

export { PromptType, type RecipeContext, type IPromptsService } from "./types";

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

const rawSchema = zodToJsonSchema(recipeDetailsZodSchema, { name: "RecipeDetails" });
export const recipeDetailsSchema = extractSchema(rawSchema);

/** Prompt service: LangChain templates, validation, and message formatting */
// biome-ignore lint/complexity/noStaticOnlyClass: Intentional static class for grouping prompt logic
export class PromptsService {
  /** Validate prompt context based on type */
  static validateContext(type: PromptType, context: RecipeContext): void {
    switch (type) {
      case PromptType.RECIPE_URL_EXTRACTION:
        if (!context.url) {
          throw new Error("URL is required for recipe URL extraction");
        }
        break;
      case PromptType.RECIPE_WEB_SEARCH:
        break;
      case PromptType.RECIPE_RAG_SYSTEM:
        // No context required
        return;
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

  /** Format prompt template with context and return LangChain messages */
  static async getPromptMessages(type: PromptType, context: RecipeContext): Promise<BaseMessage[]> {
    PromptsService.validateContext(type, context);
    const template = promptTemplates[type];
    if (!template) {
      throw new Error(`Unknown prompt type: ${type}`);
    }
    if (type === PromptType.RECIPE_URL_EXTRACTION) {
      const url = context.url;
      if (!url) throw new Error("URL is required for recipe URL extraction");
      return template.formatMessages({
        recipeName: context.recipeName,
        ingredients: context.ingredients,
        url,
      });
    }
    if (type === PromptType.RECIPE_RAG_SYSTEM) {
      return template.formatMessages({});
    }
    return template.formatMessages({
      recipeName: context.recipeName,
      ingredients: context.ingredients,
    });
  }

  /** Get prompt text by type (for backward compatibility or non-chain use) */
  static async getPrompt(type: PromptType, context: RecipeContext): Promise<string> {
    const messages = await PromptsService.getPromptMessages(type, context);
    const content = messages[0]?.content;
    return typeof content === "string" ? content : String(content ?? "");
  }

  /** Get static prompt text (no context required). For RECIPE_RAG_SYSTEM and similar. */
  static async getStaticPrompt(type: PromptType.RECIPE_RAG_SYSTEM): Promise<string> {
    const template = promptTemplates[type];
    if (!template) {
      throw new Error(`Unknown prompt type: ${type}`);
    }
    const messages = await template.formatMessages({});
    const content = messages[0]?.content;
    return typeof content === "string" ? content : String(content ?? "");
  }
}

export const defaultPromptsService: IPromptsService = {
  getPromptMessages: PromptsService.getPromptMessages.bind(PromptsService),
};
