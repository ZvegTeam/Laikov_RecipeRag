import { sql } from "drizzle-orm";
import {
  customType,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

/** PostgreSQL hstore for embedding_cache payload (embedding JSON text + expires_at) */
const hstore = customType<{ data: string; driverData: string }>({
  dataType() {
    return "hstore";
  },
  toDriver(value: string): string {
    return value;
  },
  fromDriver(value: string): string {
    return value;
  },
});

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    originalId: text("original_id").unique(),
    name: text("name").notNull(),
    ingredients: text("ingredients").notNull(),
    description: text("description"),
    url: text("url"),
    image: text("image"),
    cookTime: text("cook_time"),
    prepTime: text("prep_time"),
    recipeYield: text("recipe_yield"),
    datePublished: date("date_published"),
    source: text("source"),
    embedding: vector("embedding", { dimensions: 384 }),
    cookingInstructions: text("cooking_instructions"),
    additionalInfo: jsonb("additional_info"),
    instructionsFetchedAt: timestamp("instructions_fetched_at"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("recipes_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
    index("recipes_original_id_idx").on(table.originalId),
    index("recipes_name_idx").using("gin", sql`to_tsvector('english', ${table.name})`),
  ]
);

export const embeddingCache = pgTable("embedding_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload: hstore("payload").notNull(),
});
