/**
 * RAG chain: retrieve recipes → format context → LLM answer.
 * Use for "What can I make with X?" or "Summarize recipes for these ingredients".
 */

import { GeminiLlmService } from "@/lib/llm";
import { PromptType, PromptsService } from "@/lib/prompts";
import { RecipeRetriever } from "@/lib/retrievers";
import { HumanMessage } from "@langchain/core/messages";

export interface RecipeRagChainOptions {
  /** Number of recipes to retrieve (default: 5) */
  k?: number;
}

/**
 * RAG chain that retrieves recipes and generates an answer.
 * Example: "What can I make with chicken and garlic?" → retrieved recipes → summarized answer.
 */
export class RecipeRagChain {
  private readonly retriever: RecipeRetriever;
  private readonly llm: GeminiLlmService<string>;

  constructor(options: RecipeRagChainOptions = {}) {
    this.retriever = new RecipeRetriever({ k: options.k ?? 5 });
    this.llm = new GeminiLlmService(); // no schema = raw text
  }

  /**
   * Run RAG: retrieve recipes for query, then generate answer.
   */
  async run(query: string): Promise<string> {
    const systemPrompt = await PromptsService.getStaticPrompt(PromptType.RECIPE_RAG_SYSTEM);
    const docs = await this.retriever.invoke(query);
    const context = docs.map((d) => d.pageContent).join("\n\n---\n\n");
    const prompt = `${systemPrompt}\n\n## Retrieved recipes\n${context}\n\n## User question\n${query}\n\n## Your answer`;
    const messages = [new HumanMessage(prompt)];
    return this.llm.generate(messages);
  }
}
