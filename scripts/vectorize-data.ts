#!/usr/bin/env bun
/**
 * Vectorize and upload recipe data to the database (Drizzle ORM)
 * Supports both local and remote Postgres (e.g. Supabase)
 * Processes in batches: generates embeddings and inserts immediately
 * Skips already processed recipes to allow resuming
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import { recipes } from "../lib/db/schema";
import {
  generateEmbeddingsBatch,
  getEmbeddingDimension,
  prepareTextForEmbedding,
} from "../lib/embeddings";
import type { ParsedRecipe } from "../types/recipe";

interface RecipeWithEmbedding extends ParsedRecipe {
  embedding?: number[];
}

/**
 * Get database connection mode from env (for logging)
 */
function getDbConfig(): { isLocal: boolean } {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost") || url.includes(":54322");
  return { isLocal };
}

/**
 * Fetch already inserted recipe IDs from the database
 */
async function getExistingRecipeIds(): Promise<Set<string>> {
  const existingIds = new Set<string>();
  console.log("Checking for existing recipes in database...");

  let offset = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const rows = await db
      .select({ originalId: recipes.originalId })
      .from(recipes)
      .limit(limit)
      .offset(offset);

    if (rows.length > 0) {
      for (const row of rows) {
        if (row.originalId) existingIds.add(row.originalId);
      }
      offset += limit;
      hasMore = rows.length === limit;
    } else {
      hasMore = false;
    }
  }

  console.log(`Found ${existingIds.size} existing recipes in database\n`);
  return existingIds;
}

/**
 * Insert a batch of recipes with embeddings (upsert on original_id)
 */
async function insertRecipeBatch(
  batch: RecipeWithEmbedding[]
): Promise<{ success: number; failed: number }> {
  try {
    const values = batch.map((recipe) => ({
      originalId: recipe.original_id,
      name: recipe.name,
      ingredients: recipe.ingredients,
      description: recipe.description ?? null,
      url: recipe.url ?? null,
      image: recipe.image ?? null,
      cookTime: recipe.cook_time ?? null,
      prepTime: recipe.prep_time ?? null,
      recipeYield: recipe.recipe_yield ?? null,
      datePublished: recipe.date_published?.split("T")[0] ?? null,
      source: recipe.source ?? null,
      embedding: recipe.embedding ?? null,
    }));

    await db
      .insert(recipes)
      .values(values)
      .onConflictDoUpdate({
        target: recipes.originalId,
        set: {
          name: sql`excluded.name`,
          ingredients: sql`excluded.ingredients`,
          description: sql`excluded.description`,
          url: sql`excluded.url`,
          image: sql`excluded.image`,
          cookTime: sql`excluded.cook_time`,
          prepTime: sql`excluded.prep_time`,
          recipeYield: sql`excluded.recipe_yield`,
          datePublished: sql`excluded.date_published`,
          source: sql`excluded.source`,
          embedding: sql`excluded.embedding`,
        },
      });
    return { success: batch.length, failed: 0 };
  } catch {
    return { success: 0, failed: batch.length };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || join(process.cwd(), "recipes-parsed.json");
  const batchSize = Number.parseInt(args[1] || "100", 10);
  const embeddingBatchSize = Number.parseInt(args[2] || "10", 10);
  const skipEmbeddings = args.includes("--skip-embeddings");
  const embeddingModel =
    args.find((arg) => arg.startsWith("--model="))?.split("=")[1] || "Xenova/all-MiniLM-L6-v2";

  if (!process.env.DATABASE_URL) {
    console.error(
      "Missing DATABASE_URL. Set the direct Postgres connection string (e.g. from Supabase: Project Settings → Database, or local: postgresql://postgres:postgres@127.0.0.1:54322/postgres)"
    );
    process.exit(1);
  }

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

  console.log("Loading recipes...");
  const recipesData = readFileSync(inputFile, "utf-8");
  const allRecipes: ParsedRecipe[] = JSON.parse(recipesData);
  console.log(`Loaded ${allRecipes.length} recipes\n`);

  const existingIds = await getExistingRecipeIds();
  const recipesToProcess = allRecipes.filter((r) => !existingIds.has(r.original_id));

  if (recipesToProcess.length === 0) {
    console.log("All recipes are already in the database. Nothing to process.");
    return;
  }

  console.log(
    `Processing ${recipesToProcess.length} new recipes (skipping ${existingIds.size} existing)\n`
  );

  const config = getDbConfig();
  console.log(`Processing mode: ${config.isLocal ? "Local" : "Remote"}`);
  console.log(`Batch size: ${batchSize} recipes per batch\n`);

  let totalSuccess = 0;
  let totalFailed = 0;

  for (let i = 0; i < recipesToProcess.length; i += batchSize) {
    const batch = recipesToProcess.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(recipesToProcess.length / batchSize);

    console.log(`\n[Batch ${batchNumber}/${totalBatches}] Processing ${batch.length} recipes...`);

    try {
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

      const result = await insertRecipeBatch(batchWithEmbeddings);

      if (result.failed > 0) {
        console.error(`  ✗ Failed to insert ${result.failed} recipes from batch ${batchNumber}`);
      } else {
        console.log(`  ✓ Inserted ${result.success} recipes from batch ${batchNumber}`);
      }

      totalSuccess += result.success;
      totalFailed += result.failed;

      const processed = Math.min(i + batchSize, recipesToProcess.length);
      console.log(
        `  Progress: ${processed}/${recipesToProcess.length} recipes processed (${totalSuccess} inserted, ${totalFailed} failed)`
      );
    } catch (error) {
      console.error(`  ✗ Error processing batch ${batchNumber}:`, error);
      totalFailed += batch.length;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("Upload Complete");
  console.log("=".repeat(60));
  console.log(`✓ Successfully inserted: ${totalSuccess}`);
  console.log(`✗ Failed: ${totalFailed}`);
  console.log(`⏭ Skipped (already exists): ${existingIds.size}`);
  console.log("=".repeat(60));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { insertRecipeBatch, getDbConfig, getExistingRecipeIds };
