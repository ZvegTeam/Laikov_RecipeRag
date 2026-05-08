/**
 * Generic LLM service using LangChain ChatGoogleGenerativeAI.
 * Optional response schema: if provided, uses withStructuredOutput; otherwise invokes base model and returns text.
 */

import { serverEnv } from "@/lib/env.server";
import type { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import type { BaseMessage } from "@langchain/core/messages";
import type { Runnable } from "@langchain/core/runnables";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { z } from "zod";

export interface GeminiLlmOptions<T = string> {
  /** Override API key (default: from serverEnv) */
  apiKey?: string;
  /** Override model name (default: from serverEnv) */
  model?: string;
  /** Optional Zod schema for structured output; if undefined, returns raw text */
  responseSchema?: z.ZodType<T>;
}

function extractTextContent(msg: { content: unknown }): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((block) =>
        typeof block === "object" && block !== null && "text" in block
          ? (block as { text: string }).text
          : String(block)
      )
      .join("");
  }
  return String(c ?? "");
}

/** Generic Gemini LLM: structured output when schema provided, raw text otherwise */
export class GeminiLlmService<T = string> {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly responseSchema?: z.ZodType<T>;
  private llm: Runnable<BaseLanguageModelInput, T | { content: unknown }> | null = null;

  constructor(options: GeminiLlmOptions<T> = {}) {
    this.apiKey = options.apiKey ?? serverEnv.GEMINI_API_KEY;
    this.model = options.model ?? serverEnv.GEMINI_MODEL;
    this.responseSchema = options.responseSchema;
  }

  async generate(messages: BaseMessage[]): Promise<T> {
    const llm = this.getLlm();
    const result = await llm.invoke(messages);
    if (this.responseSchema) {
      return this.responseSchema.parse(result) as T;
    }
    return extractTextContent(result as { content: unknown }) as T;
  }

  private getLlm(): Runnable<BaseLanguageModelInput, T | { content: unknown }> {
    if (!this.llm) {
      const base = new ChatGoogleGenerativeAI({
        model: this.model,
        temperature: 0,
        apiKey: this.apiKey,
      });
      if (this.responseSchema) {
        this.llm = base.withStructuredOutput(this.responseSchema, {
          name: "StructuredOutput",
        }) as Runnable<BaseLanguageModelInput, T>;
      } else {
        this.llm = base as unknown as Runnable<BaseLanguageModelInput, { content: unknown }>;
      }
    }
    return this.llm;
  }
}
