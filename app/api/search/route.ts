import { db } from "@/lib/db";
import { embeddingCacheService } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/embeddings";
import type { Recipe } from "@/types/recipe";
import { sql } from "drizzle-orm";
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
    const body = await request.json();
    const { ingredients, limit } = searchSchema.parse(body);

    const queryText = `Find recipes with these ingredients: ${ingredients.join(", ")}`;
    const cacheKey = getEmbeddingCacheKey(ingredients);

    let queryEmbedding = await embeddingCacheService.get(cacheKey);
    if (!queryEmbedding) {
      queryEmbedding = await generateEmbedding(queryText);
      void embeddingCacheService.set(cacheKey, queryEmbedding);
    }

    const vectorLiteral = `[${queryEmbedding.join(",")}]`;
    const result = await db.execute(
      sql`SELECT id, original_id, name, ingredients, description, url, image, cook_time, prep_time, recipe_yield, date_published, source, cooking_instructions, additional_info, instructions_fetched_at, created_at, updated_at, (1 - (embedding <=> ${vectorLiteral}::vector)) AS similarity
         FROM recipes
         WHERE embedding IS NOT NULL
           AND (1 - (embedding <=> ${vectorLiteral}::vector)) >= 0.3
         ORDER BY embedding <=> ${vectorLiteral}::vector
         LIMIT ${limit}`
    );
    const data = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);

    return NextResponse.json({
      recipes: data as Recipe[],
      count: (data as Recipe[]).length,
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
