import { GeminiLlmService } from "@/lib/llm";
import {
  type IPromptsService,
  PromptType,
  type RecipeContext,
  defaultPromptsService,
  recipeDetailsZodSchema,
} from "@/lib/prompts";
import type { RecipeDetailsResponse } from "@/lib/prompts";
import type { BaseMessage } from "@langchain/core/messages";

/** LLM that generates RecipeDetailsResponse from messages */
export interface IRecipeDetailsLlm {
  generate(messages: BaseMessage[]): Promise<RecipeDetailsResponse>;
}

const defaultLlm: IRecipeDetailsLlm = new GeminiLlmService<RecipeDetailsResponse>({
  responseSchema: recipeDetailsZodSchema,
});

export interface RecipeDetailsChainOptions {
  /** Prompts service for DI (default: defaultPromptsService) */
  promptsService?: IPromptsService;
  /** LLM service for DI (default: GeminiLlmService with recipeDetailsZodSchema) */
  llmService?: IRecipeDetailsLlm;
}

/**
 * Recipe-details chain: context → prompt (URL or web search) → LLM with structured output → RecipeDetailsResponse.
 * Uses PromptsService and IRecipeDetailsLlm via DI.
 */
export class RecipeDetailsChain {
  private readonly promptsService: IPromptsService;
  private readonly llmService: IRecipeDetailsLlm;

  constructor(options: RecipeDetailsChainOptions = {}) {
    this.promptsService = options.promptsService ?? defaultPromptsService;
    this.llmService = options.llmService ?? defaultLlm;
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
    const messages = await this.promptsService.getPromptMessages(promptType, context);
    return this.llmService.generate(messages);
  }

  private async runPrompt(
    promptType: PromptType,
    context: RecipeContext
  ): Promise<RecipeDetailsResponse> {
    const messages = await this.promptsService.getPromptMessages(promptType, context);
    return this.llmService.generate(messages);
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

/** Default singleton for app use. */
export const DefaultRecipeDetailsChain = new RecipeDetailsChain();
