import { GoogleGenAI } from "@google/genai";

/**
 * Initialize Gemini AI client using @google/genai SDK
 */
export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Missing GEMINI_API_KEY environment variable. Please check your .env.local file."
    );
  }

  return new GoogleGenAI({ apiKey });
}

/** JSON schema shape accepted by @google/genai for structured output */
export type StructuredOutputSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Generate content using Gemini AI with structured JSON output
 * Uses JSON schema to ensure consistent response format
 * @param prompt - Prompt text
 * @param schema - JSON schema for structured output (without additionalProperties etc.)
 * @param model - Model name (default: gemini-1.5-pro)
 * @returns Parsed JSON response
 */
export async function generateStructuredContent<T>(
  prompt: string,
  schema: StructuredOutputSchema,
  model = "gemini-1.5-pro"
): Promise<T> {
  const ai = createGeminiClient();

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    return JSON.parse(text) as T;
  } catch (error) {
    console.error("Error generating structured content:", error);
    throw error;
  }
}
