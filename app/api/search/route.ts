import { db } from "@/lib/db";
import { embeddingCacheService } from "@/lib/embedding-cache";
import { generateEmbedding } from "@/lib/embeddings";
import { binaryQuantize } from "@/lib/quantize";
import type { Recipe } from "@/types/recipe";
import { sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const searchSchema = z.object({
  ingredients: z.array(z.string()).min(1, "At least one ingredient is required"),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

function getEmbeddingCacheKey(ingredients: string[]): string {
  return ingredients
    .map((s) => s.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(",");
}

/**
 * POST /api/search
 * Search recipes by ingredients using binary-quantized embeddings (bit(384)) and HNSW (Hamming).
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

    const queryBit = binaryQuantize(queryEmbedding);

    const result = await db.execute(
      sql`
        SELECT
          r.id, r.original_id, r.name, r.ingredients, r.description, r.url, r.image,
          r.cook_time, r.prep_time, r.recipe_yield, r.date_published, r.source,
          r.cooking_instructions, r.additional_info, r.instructions_fetched_at,
          r.created_at, r.updated_at,
          (1 - ((e.embedding <~> ${queryBit}::bit(384)) / 384.0)) AS similarity
        FROM recipes r
        INNER JOIN recipe_embeddings e ON e.recipe_id = r.id
        ORDER BY e.embedding <~> ${queryBit}::bit(384)
        LIMIT ${limit}
      `
    );

    const rows = Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? []);
    const recipesList = rows as (Recipe & { similarity: number })[];

    return NextResponse.json({
      recipes: recipesList,
      count: recipesList.length,
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
