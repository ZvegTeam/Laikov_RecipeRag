import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@xenova/transformers";

// Type for the embedding pipeline - @xenova/transformers doesn't export this type
type EmbeddingPipeline = (
  text: string,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: ArrayLike<number> }>;

/** Known model dimensions */
const MODEL_DIMENSIONS: Record<string, number> = {
  "Xenova/all-MiniLM-L6-v2": 384,
  "Xenova/all-mpnet-base-v2": 768,
  "Xenova/all-MiniLM-L12-v2": 384,
  "Xenova/paraphrase-multilingual-MiniLM-L12-v2": 384,
};

/**
 * LangChain Embeddings implementation for local transformer models.
 * Equivalent to HuggingFaceTransformersEmbeddings but uses @xenova/transformers pipeline.
 * Produces 384-dimensional vectors (Xenova/all-MiniLM-L6-v2) for use with binary quantization + pgvector.
 */
export class LocalTransformersEmbeddings extends Embeddings {
  lc_namespace = ["lib", "embeddings", "local-transformers"];

  /** Cache pipelines by model to avoid reloading */
  private static pipelineCache = new Map<string, EmbeddingPipeline>();

  constructor(
    private readonly model = "Xenova/all-MiniLM-L6-v2",
    private readonly batchSize = 32
  ) {
    super({});
  }

  /** Get embedding dimension for a model */
  static getDimension(model = "Xenova/all-MiniLM-L6-v2"): number {
    return MODEL_DIMENSIONS[model] ?? 384;
  }

  /** Prepare recipe text for embedding: name + ingredients + description */
  static prepareText(recipe: {
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

  private async getPipeline(): Promise<EmbeddingPipeline> {
    let pipe = LocalTransformersEmbeddings.pipelineCache.get(this.model);
    if (pipe) return pipe;

    console.log(`Loading embedding model: ${this.model}...`);
    const pipelineInstance = await pipeline("feature-extraction", this.model, {
      quantized: true,
    });
    console.log("✓ Model loaded successfully");
    pipe = pipelineInstance as unknown as EmbeddingPipeline;
    LocalTransformersEmbeddings.pipelineCache.set(this.model, pipe);
    return pipe;
  }

  private async embedOne(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    const output = await pipe(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data) as number[];
  }

  private async embedMany(texts: string[]): Promise<number[][]> {
    const pipe = await this.getPipeline();
    const embeddings: number[][] = [];
    const errors: Array<{ index: number; error: unknown }> = [];

    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);

      try {
        const batchPromises = batch.map(async (text, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            const output = await pipe(text, { pooling: "mean", normalize: true });
            return Array.from(output.data) as number[];
          } catch (error) {
            errors.push({ index: globalIndex, error });
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const validEmbeddings = batchResults.filter((e): e is number[] => e !== null);
        embeddings.push(...validEmbeddings);

        if ((i + this.batchSize) % 100 === 0 || i + this.batchSize >= texts.length) {
          console.log(
            `Generated embeddings: ${Math.min(i + this.batchSize, texts.length)}/${texts.length}`
          );
        }
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
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

  /** Embed a single query string */
  async embedQuery(document: string): Promise<number[]> {
    try {
      return this.embedOne(document);
    } catch (error) {
      console.error(`Error generating embedding for text (length: ${document.length}):`, error);
      throw error;
    }
  }

  /** Embed multiple documents in batch */
  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embedMany(documents);
  }
}

/** Default embeddings instance (384 dims, Xenova/all-MiniLM-L6-v2) for recipe search and vectorization */
export const RecipeEmbeddings = new LocalTransformersEmbeddings();
