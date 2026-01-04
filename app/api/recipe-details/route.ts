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
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Recipe } from "@/types/recipe";
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

/**
 * POST /api/recipe-details
 * Fetch detailed recipe information including cooking instructions
 * Uses Gemini AI with JSON schema validation for structured output
 * Rate limited to 10 requests per minute per IP address
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute per IP
    const { result: rateLimitResult, headers: rateLimitHeaders } = rateLimit(request, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
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
        {
          status: 429,
          headers: rateLimitHeaders,
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { recipeId, recipeUrl } = recipeDetailsRequestSchema.parse(body);

    const supabase = createSupabaseServerClient();

    // Fetch recipe from database
    let recipe: Recipe | null = null;
    if (recipeId) {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("id", recipeId)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Recipe not found", details: error?.message },
          { status: 404 }
        );
      }
      recipe = data;
    } else if (recipeUrl) {
      const { data, error } = await supabase
        .from("recipes")
        .select("*")
        .eq("url", recipeUrl)
        .single();

      if (error || !data) {
        return NextResponse.json(
          { error: "Recipe not found", details: error?.message },
          { status: 404 }
        );
      }
      recipe = data;
    } else {
      return NextResponse.json(
        { error: "Either recipeId or recipeUrl must be provided" },
        { status: 400 }
      );
    }

    // TypeScript guard: recipe should never be null at this point
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    // Check if cooking instructions already exist in database
    if (recipe.cooking_instructions && recipe.instructions_fetched_at) {
      // Return cached data
      return NextResponse.json(
        {
          cooking_instructions: recipe.cooking_instructions,
          additional_info: recipe.additional_info || {},
          cached: true,
          fetched_at: recipe.instructions_fetched_at,
        },
        {
          headers: rateLimitHeaders,
        }
      );
    }

    // Generate cooking instructions using Gemini AI
    let recipeDetails: RecipeDetailsResponse;
    const context = {
      recipeName: recipe.name,
      ingredients: recipe.ingredients,
      url: recipe.url,
    };

    try {
      // Primary method: Try URL extraction if URL is available
      if (recipe.url) {
        try {
          validatePromptContext(PromptType.RECIPE_URL_EXTRACTION, context);
          const prompt = getPrompt(PromptType.RECIPE_URL_EXTRACTION, context);
          recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
            prompt,
            recipeDetailsSchema,
            "gemini-1.5-pro"
          );
        } catch (urlError) {
          console.warn("URL extraction failed, trying web search:", urlError);
          // Fallback to web search
          validatePromptContext(PromptType.RECIPE_WEB_SEARCH, context);
          const prompt = getPrompt(PromptType.RECIPE_WEB_SEARCH, context);
          recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
            prompt,
            recipeDetailsSchema,
            "gemini-1.5-pro"
          );
        }
      } else {
        // No URL, use web search directly
        validatePromptContext(PromptType.RECIPE_WEB_SEARCH, context);
        const prompt = getPrompt(PromptType.RECIPE_WEB_SEARCH, context);
        recipeDetails = await generateStructuredContent<RecipeDetailsResponse>(
          prompt,
          recipeDetailsSchema,
          "gemini-1.5-pro"
        );
      }

      // Validate the response with Zod schema
      const validatedDetails = recipeDetailsZodSchema.parse(recipeDetails);

      // Store in database for future use (cache)
      const { error: updateError } = await supabase
        .from("recipes")
        .update({
          cooking_instructions: validatedDetails.cooking_instructions,
          additional_info: validatedDetails.additional_info || null,
          instructions_fetched_at: new Date().toISOString(),
        })
        .eq("id", recipe.id);

      if (updateError) {
        console.error("Error updating recipe details in database:", updateError);
        // Continue even if database update fails
      }

      // Return structured data
      return NextResponse.json(
        {
          cooking_instructions: validatedDetails.cooking_instructions,
          additional_info: validatedDetails.additional_info || {},
          cached: false,
          fetched_at: new Date().toISOString(),
        },
        {
          headers: rateLimitHeaders,
        }
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
