import { serverEnv } from "@/lib/env.server";
import { GoogleGenAI } from "@google/genai";

/**
 * Initialize Gemini AI client using @google/genai SDK.
 * Uses validated env (serverEnv) so API key is always defined.
 */
export function createGeminiClient() {
  return new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY });
}

/** JSON schema shape accepted by @google/genai for structured output */
export type StructuredOutputSchema = {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

/**
 * Generate content using Gemini AI with structured JSON output.
 * Uses validated env for model (serverEnv) so model is always a string.
 */
export async function generateStructuredContent<T>(
  prompt: string,
  schema: StructuredOutputSchema,
  model?: string
): Promise<T> {
  const resolvedModel: string = model ?? serverEnv.GEMINI_MODEL;

  const ai = createGeminiClient();
  try {
    const response = await ai.models.generateContent({
      model: resolvedModel,
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
