#!/usr/bin/env bun
/**
 * Vectorize and upload recipe data to Supabase
 * Supports both local and remote Supabase instances
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateEmbeddingsBatch, prepareTextForEmbedding } from "../lib/gemini";
import { createSupabaseServerClient } from "../lib/supabase";
import type { ParsedRecipe } from "../types/recipe";

interface RecipeWithEmbedding extends ParsedRecipe {
  embedding?: number[];
}

/**
 * Configuration for Supabase connection
 */
interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
  isLocal?: boolean;
}

/**
 * Get Supabase configuration from environment or use defaults
 * Supports both local and remote Supabase instances
 */
function getSupabaseConfig(): SupabaseConfig {
  // Check for explicit local/remote flag
  const useLocal = process.env.USE_LOCAL_SUPABASE === "true";
  const useRemote = process.env.USE_REMOTE_SUPABASE === "true";

  let url: string | undefined;
  let serviceRoleKey: string | undefined;

  if (useLocal) {
    // Use local Supabase (default ports)
    url = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:55321";
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      // Try to get from supabase status if available
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY not set. Run 'bun run supabase:status' to get local credentials."
      );
    }
  } else if (useRemote) {
    // Use remote Supabase
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  } else {
    // Auto-detect from environment variables
    url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables.\n" +
        "For local: Set USE_LOCAL_SUPABASE=true and SUPABASE_SERVICE_ROLE_KEY (run 'bun run supabase:status')\n" +
        "For remote: Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  // Detect if local (default port 55321) or remote
  const isLocal =
    useLocal || url.includes("127.0.0.1") || url.includes("localhost") || url.includes(":55321");

  return { url, serviceRoleKey, isLocal };
}

/**
 * Insert recipes with embeddings into Supabase
 */
async function insertRecipes(
  recipes: RecipeWithEmbedding[],
  batchSize = 100
): Promise<{ success: number; failed: number }> {
  const config = getSupabaseConfig();
  const supabase = createSupabaseServerClient();

  let success = 0;
  let failed = 0;

  console.log(`\nInserting ${recipes.length} recipes into Supabase...`);
  console.log(`  URL: ${config.url}`);
  console.log(`  Mode: ${config.isLocal ? "Local" : "Remote"}`);
  console.log(`  Batch size: ${batchSize}`);

  // Process in batches
  for (let i = 0; i < recipes.length; i += batchSize) {
    const batch = recipes.slice(i, i + batchSize);

    try {
      // Prepare data for insertion
      const insertData = batch.map((recipe) => ({
        original_id: recipe.original_id,
        name: recipe.name,
        ingredients: recipe.ingredients,
        description: recipe.description,
        url: recipe.url,
        image: recipe.image,
        cook_time: recipe.cook_time,
        prep_time: recipe.prep_time,
        recipe_yield: recipe.recipe_yield,
        date_published: recipe.date_published?.toISOString().split("T")[0] || null,
        source: recipe.source,
        embedding: recipe.embedding || null,
      }));

      // Insert batch
      const { error } = await supabase.from("recipes").upsert(insertData, {
        onConflict: "original_id",
        ignoreDuplicates: false,
      });

      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error.message);
        failed += batch.length;
      } else {
        success += batch.length;
        console.log(
          `  ✓ Inserted batch ${i / batchSize + 1}: ${batch.length} recipes (${success} total)`
        );
      }
    } catch (error) {
      console.error(`Error processing batch ${i / batchSize + 1}:`, error);
      failed += batch.length;
    }
  }

  return { success, failed };
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || join(process.cwd(), "recipes-parsed.json");
  const batchSize = Number.parseInt(args[1] || "100", 10);
  const embeddingBatchSize = Number.parseInt(args[2] || "10", 10);
  const skipEmbeddings = args.includes("--skip-embeddings");
  const embeddingModel =
    args.find((arg) => arg.startsWith("--model="))?.split("=")[1] || "text-embedding-004";

  console.log("=".repeat(60));
  console.log("Recipe Vectorization & Upload Script");
  console.log("=".repeat(60));
  console.log(`Input file: ${inputFile}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Embedding batch size: ${embeddingBatchSize}`);
  console.log(`Embedding model: ${embeddingModel}`);
  console.log(`Skip embeddings: ${skipEmbeddings}`);
  console.log("=".repeat(60));
  console.log();

  // Load recipes
  console.log("Loading recipes...");
  const recipesData = readFileSync(inputFile, "utf-8");
  const recipes: ParsedRecipe[] = JSON.parse(recipesData);
  console.log(`Loaded ${recipes.length} recipes\n`);

  // Generate embeddings if not skipped
  let recipesWithEmbeddings: RecipeWithEmbedding[] = recipes;

  if (!skipEmbeddings) {
    console.log("Generating embeddings...");
    const texts = recipes.map((recipe) => prepareTextForEmbedding(recipe));
    const embeddings = await generateEmbeddingsBatch(texts, embeddingModel, embeddingBatchSize);

    if (embeddings.length !== recipes.length) {
      console.warn(
        `Warning: Generated ${embeddings.length} embeddings for ${recipes.length} recipes. Some recipes will be inserted without embeddings.`
      );
    }

    recipesWithEmbeddings = recipes.map((recipe, index) => ({
      ...recipe,
      embedding: embeddings[index] || undefined,
    }));

    console.log(`✓ Generated ${embeddings.length} embeddings\n`);
  } else {
    console.log("Skipping embedding generation\n");
  }

  // Insert into Supabase
  const result = await insertRecipes(recipesWithEmbeddings, batchSize);

  console.log(`\n${"=".repeat(60)}`);
  console.log("Upload Complete");
  console.log("=".repeat(60));
  console.log(`✓ Successfully inserted: ${result.success}`);
  console.log(`✗ Failed: ${result.failed}`);
  console.log("=".repeat(60));
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { insertRecipes, getSupabaseConfig };
