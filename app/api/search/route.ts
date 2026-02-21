import { embeddingCacheService } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/embeddings";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Recipe } from "@/types/recipe";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request body schema
const searchSchema = z.object({
  ingredients: z.array(z.string()).min(1, "At least one ingredient is required"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

/** Stable cache key from ingredients (sorted, lowercased) so order-independent queries hit the same embedding cache. */
function getEmbeddingCacheKey(ingredients: string[]): string {
  return ingredients
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * POST /api/search
 * Search for recipes based on ingredients using vector similarity
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const { ingredients, limit } = searchSchema.parse(body);

    const queryText = `Find recipes with these ingredients: ${ingredients.join(", ")}`;
    const cacheKey = getEmbeddingCacheKey(ingredients);

    let queryEmbedding = await embeddingCacheService.get(cacheKey);
    if (!queryEmbedding) {
      queryEmbedding = await generateEmbedding(queryText);
      void embeddingCacheService.set(cacheKey, queryEmbedding);
    }

    // Query Supabase using cosine similarity via RPC function
    const supabase = createSupabaseServerClient();

    // Use RPC function for efficient vector similarity search
    const { data, error } = await supabase.rpc("search_recipes_by_embedding", {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, // Minimum similarity threshold (0-1, lower = more results)
      match_count: limit,
    });

    if (error) {
      console.error("Error searching recipes:", error);
      return NextResponse.json(
        {
          error: "Failed to search recipes",
          details: error.message,
          hint: "Make sure the search_recipes_by_embedding function exists in the database. Run migration 003_create_search_function.sql",
        },
        { status: 500 }
      );
    }

    // Return results from RPC function
    return NextResponse.json({
      recipes: (data as Recipe[]) || [],
      count: data?.length || 0,
    });
  } catch (error) {
    console.error("Search API error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
