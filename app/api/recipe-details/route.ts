import { rateLimit } from "@/lib/rate-limit";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchAndSaveRecipeDetails } from "./fetch-and-save-details";
import { getRecipeForDetails } from "./get-recipe";

const recipeDetailsRequestSchema = z
  .object({
    recipeId: z.string().uuid().optional(),
    recipeUrl: z.string().url().optional(),
  })
  .refine((data) => data.recipeId || data.recipeUrl, {
    message: "Either recipeId or recipeUrl must be provided",
  });

/**
 * POST /api/recipe-details
 * Fetch detailed recipe information including cooking instructions.
 * Uses LangChain recipe-details chain (Gemini + structured output).
 * Rate limited to 10 requests per minute per IP address.
 */
export async function POST(request: NextRequest) {
  try {
    const { result: rateLimitResult, headers: rateLimitHeaders } = rateLimit(request, {
      maxRequests: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Please try again after ${new Date(
            rateLimitResult.resetAt
          ).toISOString()}`,
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
        },
        { status: 429, headers: rateLimitHeaders }
      );
    }

    const body = await request.json();
    const { recipeId, recipeUrl } = recipeDetailsRequestSchema.parse(body);

    const result = await getRecipeForDetails(recipeId, recipeUrl);
    if ("error" in result) return result.error;
    const { recipe } = result;

    if (recipe.cooking_instructions && recipe.instructions_fetched_at) {
      return NextResponse.json(
        {
          cooking_instructions: recipe.cooking_instructions,
          additional_info: recipe.additional_info || {},
          cached: true,
          fetched_at: recipe.instructions_fetched_at,
        },
        { headers: rateLimitHeaders }
      );
    }

    return fetchAndSaveRecipeDetails(recipe, rateLimitHeaders);
  } catch (error) {
    console.error("Recipe details API error:", error);

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
