/**
 * LangChain Retriever that wraps recipe vector search.
 * Input: user message (e.g. ingredients string or "What can I make with chicken?").
 * Output: Document[] for use in RAG chains.
 */

import { searchRecipesByQuery } from "@/lib/search";
import type { RecipeSearchResult } from "@/lib/search";
import type { Recipe } from "@/types/recipe";
import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";

export interface RecipeRetrieverOptions {
  /** Number of recipes to retrieve (default: 10) */
  k?: number;
}

function recipeToPageContent(recipe: Recipe): string {
  const parts = [`Recipe: ${recipe.name}`, `Ingredients: ${recipe.ingredients}`];
  if (recipe.description) {
    parts.push(`Description: ${recipe.description}`);
  }
  return parts.join("\n\n");
}

function recipeToDocument(recipe: RecipeSearchResult): Document {
  return new Document({
    pageContent: recipeToPageContent(recipe),
    metadata: {
      id: recipe.id,
      name: recipe.name,
      ingredients: recipe.ingredients,
      url: recipe.url,
      similarity: recipe.similarity,
    },
  });
}

/**
 * Retriever that searches recipes by embedding + pgvector.
 * Use in RAG chains for "What can I make with X?" or "Summarize recipes for these ingredients".
 */
export class RecipeRetriever extends BaseRetriever {
  lc_namespace = ["lib", "retrievers", "recipe-retriever"];

  private readonly k: number;

  static lc_name(): string {
    return "RecipeRetriever";
  }

  constructor(options: RecipeRetrieverOptions = {}) {
    super();
    this.k = options.k ?? 10;
  }

  async _getRelevantDocuments(query: string): Promise<Document[]> {
    const queryText = query.trim().startsWith("Find recipes")
      ? query.trim()
      : `Find recipes with these ingredients: ${query.trim()}`;
    const recipes = await searchRecipesByQuery(queryText, { limit: this.k });
    return recipes.map(recipeToDocument);
  }
}
