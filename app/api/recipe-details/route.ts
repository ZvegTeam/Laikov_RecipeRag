import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import { generateStructuredContent } from "@/lib/gemini";
import {
  PromptType,
  getPrompt,
  recipeDetailsSchema,
  recipeDetailsZodSchema,
  validatePromptContext,
} from "@/lib/prompts";
import type { RecipeDetailsResponse } from "@/lib/prompts";
import { rateLimit } from "@/lib/rate-limit";
import type { Recipe } from "@/types/recipe";
import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Request body schema
const recipeDetailsRequestSchema = z
  .object({
    recipeId: z.string().uuid().optional(),
    recipeUrl: z.string().url().optional(),
  })
  .refine((data) => data.recipeId || data.recipeUrl, {
    message: "Either recipeId or recipeUrl must be provided",
  });

/** Map DB row (snake_case) to Recipe type */
function rowToRecipe(row: typeof recipes.$inferSelect): Recipe {
  return {
    id: row.id,
    original_id: row.originalId ?? "",
    name: row.name,
    ingredients: row.ingredients,
    description: row.description ?? undefined,
    url: row.url ?? undefined,
    image: row.image ?? undefined,
    cook_time: row.cookTime ?? undefined,
    prep_time: row.prepTime ?? undefined,
    recipe_yield: row.recipeYield ?? undefined,
    date_published: row.datePublished ?? undefined,
    source: row.source ?? undefined,
    cooking_instructions: row.cookingInstructions ?? undefined,
    additional_info: (row.additionalInfo as Recipe["additional_info"]) ?? undefined,
    instructions_fetched_at: row.instructionsFetchedAt?.toISOString(),
    created_at: row.createdAt?.toISOString(),
    updated_at: row.updatedAt?.toISOString(),
  };
}

/**
 * POST /api/recipe-details
 * Fetch detailed recipe information including cooking instructions
 * Uses Gemini AI with JSON schema validation for structured output
 * Rate limited to 10 requests per minute per IP address
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

    let recipe: Recipe | null = null;
    if (recipeId) {
      const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
      if (!row) {
        return NextResponse.json(
          { error: "Recipe not found", details: "No recipe with this id" },
          { status: 404 }
        );
      }
      recipe = rowToRecipe(row);
    } else if (recipeUrl) {
      const [row] = await db.select().from(recipes).where(eq(recipes.url, recipeUrl)).limit(1);
      if (!row) {
        return NextResponse.json(
          { error: "Recipe not found", details: "No recipe with this url" },
          { status: 404 }
        );
      }
      recipe = rowToRecipe(row);
    } else {
      return NextResponse.json(
        { error: "Either recipeId or recipeUrl must be provided" },
        { status: 400 }
      );
    }

    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

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

    const context = {
      recipeName: recipe.name,
      ingredients: recipe.ingredients,
      url: recipe.url,
    };
    let recipeDetails: RecipeDetailsResponse;

    try {
      if (recipe.url) {
        try {
          validatePromptContext(PromptType.RECIPE_URL_EXTRACTION, context);
          const prompt = getPrompt(PromptType.RECIPE_URL_EXTRACTION, context);
          recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
            prompt,
            recipeDetailsSchema,
            "gemini-2.5-flash-lite"
          );
        } catch {
          validatePromptContext(PromptType.RECIPE_WEB_SEARCH, context);
          const prompt = getPrompt(PromptType.RECIPE_WEB_SEARCH, context);
          recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
            prompt,
            recipeDetailsSchema,
            "gemini-2.5-flash-lite"
          );
        }
      } else {
        validatePromptContext(PromptType.RECIPE_WEB_SEARCH, context);
        const prompt = getPrompt(PromptType.RECIPE_WEB_SEARCH, context);
        recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
          prompt,
          recipeDetailsSchema,
          "gemini-2.5-flash-lite"
        );
      }

      const validatedDetails = recipeDetailsZodSchema.parse(recipeDetails);

      await db
        .update(recipes)
        .set({
          cookingInstructions: validatedDetails.cooking_instructions,
          additionalInfo: validatedDetails.additional_info ?? null,
          instructionsFetchedAt: new Date(),
        })
        .where(eq(recipes.id, recipe.id));

      return NextResponse.json(
        {
          cooking_instructions: validatedDetails.cooking_instructions,
          additional_info: validatedDetails.additional_info || {},
          cached: false,
          fetched_at: new Date().toISOString(),
        },
        { headers: rateLimitHeaders }
      );
    } catch (geminiError) {
      console.error("Error fetching recipe details from Gemini:", geminiError);
      return NextResponse.json(
        {
          error: "Failed to fetch recipe details",
          details: geminiError instanceof Error ? geminiError.message : "Unknown error",
        },
        { status: 500 }
      );
    }
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
