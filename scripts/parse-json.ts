#!/usr/bin/env bun
/**
 * Parse MongoDB-style JSON recipe file
 * Converts MongoDB export format to normalized recipe objects
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { MongoRecipe, ParsedRecipe } from "../types/recipe";

/**
 * Convert MongoDB ObjectId to string
 */
function parseObjectId(mongoId: { $oid: string }): string {
  return mongoId.$oid;
}

/**
 * Parse MongoDB date field
 */
function parseDate(dateValue?: { $date: number } | string): Date | undefined {
  if (!dateValue) return undefined;

  if (typeof dateValue === "string") {
    const parsed = new Date(dateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  if (dateValue.$date) {
    // MongoDB date is in milliseconds
    return new Date(dateValue.$date);
  }

  return undefined;
}

/**
 * Clean and normalize ingredient text
 */
function normalizeIngredients(ingredients: string): string {
  if (!ingredients) return "";

  return (
    ingredients
      // Remove excessive whitespace
      .replace(/\s+/g, " ")
      // Remove leading/trailing whitespace
      .trim()
      // Normalize line breaks to spaces
      .replace(/\n+/g, " ")
      // Remove multiple spaces
      .replace(/\s{2,}/g, " ")
  );
}

/**
 * Parse a single MongoDB recipe object
 */
function parseRecipe(mongoRecipe: MongoRecipe): ParsedRecipe | null {
  try {
    // Extract original_id from MongoDB ObjectId
    const original_id = parseObjectId(mongoRecipe._id);

    // Validate required fields
    if (!mongoRecipe.name || !mongoRecipe.ingredients) {
      console.warn(`Skipping recipe with missing required fields: ${original_id}`);
      return null;
    }

    // Parse date fields
    const date_published = mongoRecipe.datePublished
      ? parseDate(mongoRecipe.datePublished)
      : mongoRecipe.ts
        ? parseDate(mongoRecipe.ts)
        : undefined;

    // Build parsed recipe
    const parsed: ParsedRecipe = {
      original_id,
      name: mongoRecipe.name.trim(),
      ingredients: normalizeIngredients(mongoRecipe.ingredients),
      description: mongoRecipe.description?.trim(),
      url: mongoRecipe.url?.trim(),
      image: mongoRecipe.image?.trim(),
      cook_time: mongoRecipe.cookTime?.trim(),
      prep_time: mongoRecipe.prepTime?.trim(),
      recipe_yield: mongoRecipe.recipeYield?.trim(),
      date_published,
      source: mongoRecipe.source?.trim(),
    };

    // Remove undefined fields
    for (const key of Object.keys(parsed)) {
      if (parsed[key as keyof ParsedRecipe] === undefined) {
        delete parsed[key as keyof ParsedRecipe];
      }
    }

    return parsed;
  } catch (error) {
    console.error("Error parsing recipe:", error);
    return null;
  }
}

/**
 * Parse MongoDB-style JSON file line by line
 */
function parseJsonFile(filePath: string): ParsedRecipe[] {
  console.log(`Reading file: ${filePath}`);
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());

  console.log(`Found ${lines.length} lines to parse`);

  const recipes: ParsedRecipe[] = [];
  let parsedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      // Parse MongoDB JSON format
      const mongoRecipe: MongoRecipe = JSON.parse(line);
      const parsed = parseRecipe(mongoRecipe);

      if (parsed) {
        recipes.push(parsed);
        parsedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      errorCount++;
      if (errorCount <= 10) {
        // Only log first 10 errors to avoid spam
        console.warn(
          `Error parsing line ${i + 1}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    // Progress indicator
    if ((i + 1) % 1000 === 0) {
      console.log(`Processed ${i + 1}/${lines.length} lines...`);
    }
  }

  console.log("\nParsing complete:");
  console.log(`  ✓ Parsed: ${parsedCount}`);
  console.log(`  ✗ Skipped: ${skippedCount}`);
  console.log(`  ✗ Errors: ${errorCount}`);
  console.log(`  Total valid recipes: ${recipes.length}`);

  return recipes;
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  const inputFile = args[0] || join(process.cwd(), "recipeitems-latest.json");
  const outputFile = args[1] || join(process.cwd(), "recipes-parsed.json");

  console.log("=".repeat(60));
  console.log("Recipe JSON Parser");
  console.log("=".repeat(60));
  console.log(`Input:  ${inputFile}`);
  console.log(`Output: ${outputFile}`);
  console.log("=".repeat(60));
  console.log();

  // Parse the JSON file
  const recipes = parseJsonFile(inputFile);

  if (recipes.length === 0) {
    console.error("No recipes were parsed. Exiting.");
    process.exit(1);
  }

  // Write output
  console.log(`\nWriting ${recipes.length} recipes to ${outputFile}...`);
  writeFileSync(outputFile, JSON.stringify(recipes, null, 2), "utf-8");

  console.log(`\n✓ Successfully parsed ${recipes.length} recipes!`);
  console.log(`  Output saved to: ${outputFile}`);
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { parseRecipe, parseJsonFile, normalizeIngredients };
