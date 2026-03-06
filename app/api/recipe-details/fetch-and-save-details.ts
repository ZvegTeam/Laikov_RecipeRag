import { DefaultRecipeDetailsChain } from "@/lib/chains/recipe-details-chain";
import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import type { RecipeDetailsResponse } from "@/lib/prompts";
import type { Recipe } from "@/types/recipe";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Run the recipe-details chain, persist instructions to the DB, and return the API response.
 * Returns 200 with cooking_instructions and additional_info, or 500 on chain/DB failure.
 */
export async function fetchAndSaveRecipeDetails(
  recipe: Recipe,
  rateLimitHeaders?: HeadersInit
): Promise<NextResponse> {
  try {
    const validatedDetails: RecipeDetailsResponse = await DefaultRecipeDetailsChain.runWithFallback(
      {
        recipeName: recipe.name,
        ingredients: recipe.ingredients,
        url: recipe.url,
      }
    );

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
}
