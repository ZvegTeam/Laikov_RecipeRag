import { pipeline } from "@xenova/transformers";

// Type for the embedding pipeline - @xenova/transformers doesn't export this type
type EmbeddingPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: ArrayLike<number> }>;

// Cache the pipeline instance to avoid reloading the model
let embeddingPipeline: EmbeddingPipeline | null = null;

/**
 * Initialize the embedding pipeline
 * Uses a local transformer model - no API calls needed
 * @param model - Model name from Hugging Face (default: all-MiniLM-L6-v2)
 * @returns Pipeline instance
 */
async function getEmbeddingPipeline(model = "Xenova/all-MiniLM-L6-v2"): Promise<EmbeddingPipeline> {
  if (embeddingPipeline) {
    return embeddingPipeline;
  }

  console.log(`Loading embedding model: ${model}...`);
  const pipelineInstance = await pipeline("feature-extraction", model, {
    quantized: true, // Use quantized model for faster loading and smaller size
  });
  console.log("✓ Model loaded successfully");

  // Type assert to our EmbeddingPipeline type
  embeddingPipeline = pipelineInstance as unknown as EmbeddingPipeline;
  return embeddingPipeline;
}

/**
 * Generate embedding for text using local transformer model
 * @param text - Text to generate embedding for
 * @param model - Model name (default: Xenova/all-MiniLM-L6-v2, 384 dimensions)
 * @returns Embedding vector as number array
 */
export async function generateEmbedding(
  text: string,
  model = "Xenova/all-MiniLM-L6-v2"
): Promise<number[]> {
  try {
    const pipe = await getEmbeddingPipeline(model);

    // Generate embedding
    const output = await pipe(text, {
      pooling: "mean", // Mean pooling for sentence embeddings
      normalize: true, // Normalize embeddings for cosine similarity
    });

    // Convert tensor to array - output.data is a TypedArray, convert to number[]
    const embedding = Array.from(output.data) as number[];

    return embedding;
  } catch (error) {
    console.error(`Error generating embedding for text (length: ${text.length}):`, error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @param model - Model name (default: Xenova/all-MiniLM-L6-v2)
 * @param batchSize - Number of texts to process in parallel (default: 32)
 * @returns Array of embedding vectors
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  model = "Xenova/all-MiniLM-L6-v2",
  batchSize = 32
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const errors: Array<{ index: number; error: unknown }> = [];

  // Load model once
  const pipe = await getEmbeddingPipeline(model);

  // Process in batches
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    try {
      // Process batch in parallel
      const batchPromises = batch.map(async (text, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const output = await pipe(text, {
            pooling: "mean",
            normalize: true,
          });
          // Convert tensor to array - output.data is a TypedArray, convert to number[]
          return Array.from(output.data) as number[];
        } catch (error) {
          errors.push({ index: globalIndex, error });
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      const validEmbeddings = batchResults.filter((e): e is number[] => e !== null);
      embeddings.push(...validEmbeddings);

      // Log progress
      if ((i + batchSize) % 100 === 0 || i + batchSize >= texts.length) {
        console.log(
          `Generated embeddings: ${Math.min(i + batchSize, texts.length)}/${texts.length}`
        );
      }
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error);
      // Add nulls for failed batch
      for (let j = 0; j < batch.length; j++) {
        errors.push({ index: i + j, error });
      }
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
 * Get embedding dimension for a given model
 * @param model - Model name
 * @returns Dimension size
 */
export function getEmbeddingDimension(model = "Xenova/all-MiniLM-L6-v2"): number {
  // Common model dimensions
  const dimensions: Record<string, number> = {
    "Xenova/all-MiniLM-L6-v2": 384,
    "Xenova/all-mpnet-base-v2": 768,
    "Xenova/all-MiniLM-L12-v2": 384,
    "Xenova/paraphrase-multilingual-MiniLM-L12-v2": 384,
  };

  return dimensions[model] || 384; // Default to 384 if unknown
}
