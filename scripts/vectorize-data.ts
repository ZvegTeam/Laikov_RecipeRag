#!/usr/bin/env bun
/**
 * Vectorize and upload recipe data to Supabase
 * Supports both local and remote Supabase instances
 * Processes in batches: generates embeddings and inserts immediately
 * Skips already processed recipes to allow resuming
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  generateEmbeddingsBatch,
  getEmbeddingDimension,
  prepareTextForEmbedding,
} from "../lib/embeddings";
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
 * Fetch already inserted recipe IDs from Supabase
 */
async function getExistingRecipeIds(): Promise<Set<string>> {
  const supabase = createSupabaseServerClient();
  const existingIds = new Set<string>();

  console.log("Checking for existing recipes in database...");

  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("recipes")
      .select("original_id")
      .range(offset, offset + limit - 1);

    if (error) {
      console.warn(`Warning: Error fetching existing recipes: ${error.message}`);
      break;
    }

    if (data && data.length > 0) {
      for (const row of data) {
        if (row.original_id) {
          existingIds.add(row.original_id);
        }
      }
      offset += limit;
      hasMore = data.length === limit;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${existingIds.size} existing recipes in database\n`);
  return existingIds;
}

/**
 * Insert a batch of recipes with embeddings into Supabase
 */
async function insertRecipeBatch(
  recipes: RecipeWithEmbedding[]
): Promise<{ success: number; failed: number }> {
  const supabase = createSupabaseServerClient();

  // Prepare data for insertion
  const insertData = recipes.map((recipe) => ({
    original_id: recipe.original_id,
    name: recipe.name,
    ingredients: recipe.ingredients,
    description: recipe.description,
    url: recipe.url,
    image: recipe.image,
    cook_time: recipe.cook_time,
    prep_time: recipe.prep_time,
    recipe_yield: recipe.recipe_yield,
    date_published: recipe.date_published?.split("T")[0] ?? null,
    source: recipe.source,
    embedding: recipe.embedding || null,
  }));

  // Insert batch
  const { error } = await supabase.from("recipes").upsert(insertData, {
    onConflict: "original_id",
    ignoreDuplicates: false,
  });

  if (error) {
    return { success: 0, failed: recipes.length };
  }

  return { success: recipes.length, failed: 0 };
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
    args.find((arg) => arg.startsWith("--model="))?.split("=")[1] || "Xenova/all-MiniLM-L6-v2";

  console.log("=".repeat(60));
  console.log("Recipe Vectorization & Upload Script");
  console.log("=".repeat(60));
  console.log(`Input file: ${inputFile}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Embedding batch size: ${embeddingBatchSize}`);
  console.log(`Embedding model: ${embeddingModel}`);
  console.log(`Embedding dimension: ${getEmbeddingDimension(embeddingModel)}`);
  console.log(`Skip embeddings: ${skipEmbeddings}`);
  console.log("=".repeat(60));
  console.log();

  // Load recipes
  console.log("Loading recipes...");
  const recipesData = readFileSync(inputFile, "utf-8");
  const recipes: ParsedRecipe[] = JSON.parse(recipesData);
  console.log(`Loaded ${recipes.length} recipes\n`);

  // Get existing recipe IDs to skip
  const existingIds = await getExistingRecipeIds();

  // Filter out already processed recipes
  const recipesToProcess = recipes.filter((recipe) => !existingIds.has(recipe.original_id));

  if (recipesToProcess.length === 0) {
    console.log("All recipes are already in the database. Nothing to process.");
    return;
  }

  console.log(
    `Processing ${recipesToProcess.length} new recipes (skipping ${existingIds.size} existing)\n`
  );

  // Initialize counters
  let totalSuccess = 0;
  let totalFailed = 0;
  const totalSkipped = existingIds.size;

  // Process in batches: generate embeddings and insert immediately
  const config = getSupabaseConfig();
  console.log(`Processing mode: ${config.isLocal ? "Local" : "Remote"}`);
  console.log(`Batch size: ${batchSize} recipes per batch\n`);

  for (let i = 0; i < recipesToProcess.length; i += batchSize) {
    const batch = recipesToProcess.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(recipesToProcess.length / batchSize);

    console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batch.length} recipes...`);

    try {
      // Generate embeddings for this batch
      let batchWithEmbeddings: RecipeWithEmbedding[] = batch;

      if (!skipEmbeddings) {
        const texts = batch.map((recipe) => prepareTextForEmbedding(recipe));
        const embeddings = await generateEmbeddingsBatch(texts, embeddingModel, embeddingBatchSize);

        batchWithEmbeddings = batch.map((recipe, index) => ({
          ...recipe,
          embedding: embeddings[index] || undefined,
        }));

        console.log(`  ✓ Generated ${embeddings.length} embeddings for batch ${batchNumber}`);
      } else {
        console.log(`  ⏭ Skipping embedding generation for batch ${batchNumber}`);
      }

      // Immediately insert this batch
      const result = await insertRecipeBatch(batchWithEmbeddings);

      if (result.failed > 0) {
        console.error(`  ✗ Failed to insert ${result.failed} recipes from batch ${batchNumber}`);
      } else {
        console.log(`  ✓ Inserted ${result.success} recipes from batch ${batchNumber}`);
      }

      totalSuccess += result.success;
      totalFailed += result.failed;
    } catch (error) {
      console.error(`  ✗ Error processing batch ${batchNumber}:`, error);
      totalFailed += batch.length;
    }

    // Progress summary
    const processed = Math.min(i + batchSize, recipesToProcess.length);
    console.log(
      `  Progress: ${processed}/${recipesToProcess.length} recipes processed (${totalSuccess} inserted, ${totalFailed} failed)`
    );
  }

  const result = {
    success: totalSuccess,
    failed: totalFailed,
    skipped: totalSkipped,
  };

  console.log(`\n${"=".repeat(60)}`);
  console.log("Upload Complete");
  console.log("=".repeat(60));
  console.log(`✓ Successfully inserted: ${result.success}`);
  console.log(`✗ Failed: ${result.failed}`);
  console.log(`⏭ Skipped (already exists): ${result.skipped}`);
  console.log("=".repeat(60));
}

// Run if executed directly
if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { insertRecipeBatch, getSupabaseConfig, getExistingRecipeIds };
