/**
 * Binary quantization for embeddings: float[] -> bit string (sign quantization).
 * Each dimension: value > 0 -> 1, else 0. Produces a string of length 384 for use as bit(384).
 */

const EMBEDDING_DIM = 384;

/**
 * Convert a float embedding to a binary bit string (384 chars of '0' and '1').
 * Sign quantization: dimension > 0 -> 1, else 0.
 */
export function binaryQuantize(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(`binaryQuantize expects ${EMBEDDING_DIM} dimensions, got ${embedding.length}`);
  }
  return embedding.map((x) => (x > 0 ? "1" : "0")).join("");
}
