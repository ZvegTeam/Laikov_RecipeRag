import {
  PromptType,
  type RecipeContext,
  getPrompt,
  recipeDetailsZodSchema,
  validatePromptContext,
} from "@/lib/prompts";
import type { RecipeDetailsResponse } from "@/lib/prompts";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { HumanMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export interface RecipeDetailsChainOptions {
  /** Override API key (default: GEMINI_API_KEY or GOOGLE_API_KEY) */
  apiKey?: string;
  /** Override model name (default: GEMINI_MODEL from env) */
  model?: string;
}

/**
 * Recipe-details chain: context → prompt (URL or web search) → LLM with structured output → RecipeDetailsResponse.
 * Uses LangChain ChatGoogleGenerativeAI + withStructuredOutput(recipeDetailsZodSchema).
 * Model is read from GEMINI_MODEL (validated at startup via instrumentation).
 */
export class RecipeDetailsChain {
  private readonly options: RecipeDetailsChainOptions;
  private llm: Runnable<BaseLanguageModelInput, RecipeDetailsResponse> | null = null;

  constructor(options: RecipeDetailsChainOptions = {}) {
    this.options = options;
  }

  private getApiKey(): string {
    const key = this.options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
    if (!key) {
      throw new Error(
        "Missing GEMINI_API_KEY or GOOGLE_API_KEY. Set one in .env.local or pass apiKey in options."
      );
    }
    return key;
  }

  private getModel(): string {
    const model = this.options.model ?? process.env.GEMINI_MODEL;
    if (!model) {
      throw new Error(
        "Missing GEMINI_MODEL. Set in .env.local (e.g. gemini-2.5-flash-lite) or pass model in options."
      );
    }
    return model;
  }

  private getLlm(): Runnable<BaseLanguageModelInput, RecipeDetailsResponse> {
    if (!this.llm) {
      const model = this.getModel();
      const base = new ChatGoogleGenerativeAI({
        model,
        temperature: 0,
        apiKey: this.getApiKey(),
      });
      this.llm = base.withStructuredOutput(recipeDetailsZodSchema, {
        name: "RecipeDetails",
      }) as Runnable<BaseLanguageModelInput, RecipeDetailsResponse>;
    }
    return this.llm;
  }

  /**
   * Run the chain: pick prompt from context (URL vs web search), invoke LLM, return validated response.
   */
  async run(context: RecipeContext): Promise<RecipeDetailsResponse> {
    if (!context.recipeName || !context.ingredients) {
      throw new Error("Recipe name and ingredients are required");
    }

    const promptType = context.url
      ? PromptType.RECIPE_URL_EXTRACTION
      : PromptType.RECIPE_WEB_SEARCH;
    validatePromptContext(promptType, context);
    const promptText = getPrompt(promptType, context);

    const result = await this.getLlm().invoke([new HumanMessage(promptText)]);
    return recipeDetailsZodSchema.parse(result) as RecipeDetailsResponse;
  }

  private async runPrompt(
    promptType: PromptType,
    context: RecipeContext
  ): Promise<RecipeDetailsResponse> {
    validatePromptContext(promptType, context);
    const promptText = getPrompt(promptType, context);
    const result = await this.getLlm().invoke([new HumanMessage(promptText)]);
    return recipeDetailsZodSchema.parse(result) as RecipeDetailsResponse;
  }

  /**
   * Run with URL extraction first; on failure fallback to web-search prompt.
   */
  async runWithFallback(context: RecipeContext): Promise<RecipeDetailsResponse> {
    if (context.url) {
      try {
        return await this.runPrompt(PromptType.RECIPE_URL_EXTRACTION, context);
      } catch {
        return await this.runPrompt(PromptType.RECIPE_WEB_SEARCH, context);
      }
    }
    return await this.runPrompt(PromptType.RECIPE_WEB_SEARCH, context);
  }
}

/** Default singleton for app use (shared LLM instance). */
export const recipeDetailsChain = new RecipeDetailsChain();

/** Run chain (no fallback). Uses default singleton. */
export async function runRecipeDetailsChain(
  context: RecipeContext
): Promise<RecipeDetailsResponse> {
  return recipeDetailsChain.run(context);
}

/** Run with URL-first fallback. Uses default singleton. */
export async function runRecipeDetailsChainWithFallback(
  context: RecipeContext
): Promise<RecipeDetailsResponse> {
  return recipeDetailsChain.runWithFallback(context);
}
