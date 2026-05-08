import { searchRecipesByQuery } from "@/lib/search";
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

    const recipesList = await searchRecipesByQuery(queryText, { limit, cacheKey });

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
