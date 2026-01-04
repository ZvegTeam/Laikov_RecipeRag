import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Initialize Gemini AI client
 */
export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable. Please check your .env.local file."
    );
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate embedding for text using Gemini
 * @param text - Text to generate embedding for
 * @param model - Embedding model to use (default: text-embedding-004)
 * @returns Embedding vector as number array
 */
export async function generateEmbedding(
  text: string,
  model = "text-embedding-004"
): Promise<number[]> {
  const client = createGeminiClient();
  const embeddingModel = client.getGenerativeModel({ model });

  try {
    const result = await embeddingModel.embedContent(text);
    const embedding = result.embedding;

    if (!embedding || !embedding.values) {
      throw new Error("Failed to generate embedding: no values returned");
    }

    return embedding.values;
  } catch (error) {
    console.error(`Error generating embedding for text (length: ${text.length}):`, error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @param model - Embedding model to use
 * @param batchSize - Number of texts to process in parallel (default: 10)
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  model = "text-embedding-004",
  batchSize = 10
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  // Process in batches to avoid rate limits
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchPromises = batch.map(async (text, batchIndex) => {
      const globalIndex = i + batchIndex;
      try {
        return await generateEmbedding(text, model);
      } catch (error) {
        errors.push({ index: globalIndex, error });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    embeddings.push(...batchResults.filter((e): e is number[] => e !== null));

    // Log progress
    if ((i + batchSize) % 100 === 0 || i + batchSize >= texts.length) {
      console.log(`Generated embeddings: ${Math.min(i + batchSize, texts.length)}/${texts.length}`);
    }

    // Small delay between batches to avoid rate limits
    if (i + batchSize < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (errors.length > 0) {
    console.warn(`Failed to generate ${errors.length} embeddings out of ${texts.length}`);
    if (errors.length <= 10) {
      for (const { index, error } of errors) {
        console.warn(`  Error at index ${index}:`, error);
      }
    }
  }

  return embeddings;
}

/**
 * Prepare text for embedding generation
 * Combines recipe name, ingredients, and description
 */
export function prepareTextForEmbedding(recipe: {
  name: string;
  ingredients: string;
  description?: string;
}): string {
  const parts: string[] = [recipe.name];

  if (recipe.ingredients) {
    parts.push(`Ingredients: ${recipe.ingredients}`);
  }

  if (recipe.description) {
    parts.push(recipe.description);
  }

  return parts.join(". ");
}

/**
 * Generate content using Gemini AI with structured JSON output
 * Uses JSON schema to ensure consistent response format
 * @param prompt - Prompt text
 * @param schema - JSON schema for structured output
 * @param model - Model name (default: gemini-1.5-pro)
 * @returns Parsed JSON response
 */
export async function generateStructuredContent<T>(
  prompt: string,
  schema: object,
  model = "gemini-1.5-pro"
): Promise<T> {
  const client = createGeminiClient();
  const genModel = client.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });

  try {
    const result = await genModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      throw new Error("No response text from Gemini");
    }

    // Parse JSON response
    const parsed = JSON.parse(text) as T;
    return parsed;
  } catch (error) {
    console.error("Error generating structured content:", error);
    throw error;
  }
}
