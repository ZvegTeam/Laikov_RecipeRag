import { db } from "@/lib/db";
import { recipes } from "@/lib/db/schema";
import type { Recipe } from "@/types/recipe";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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
 * Load a recipe by id or url for the recipe-details flow.
 * Returns the recipe or a NextResponse for 400/404.
 */
export async function getRecipeForDetails(
  recipeId: string | undefined,
  recipeUrl: string | undefined
): Promise<{ recipe: Recipe } | { error: NextResponse }> {
  if (recipeId) {
    const [row] = await db.select().from(recipes).where(eq(recipes.id, recipeId)).limit(1);
    if (!row) {
      return {
        error: NextResponse.json(
          { error: "Recipe not found", details: "No recipe with this id" },
          { status: 404 }
        ),
      };
    }
    return { recipe: rowToRecipe(row) };
  }

  if (recipeUrl) {
    const [row] = await db.select().from(recipes).where(eq(recipes.url, recipeUrl)).limit(1);
    if (!row) {
      return {
        error: NextResponse.json(
          { error: "Recipe not found", details: "No recipe with this url" },
          { status: 404 }
        ),
      };
    }
    return { recipe: rowToRecipe(row) };
  }

  return {
    error: NextResponse.json(
      { error: "Either recipeId or recipeUrl must be provided" },
      { status: 400 }
    ),
  };
}
