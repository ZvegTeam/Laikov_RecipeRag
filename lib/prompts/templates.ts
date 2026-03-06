/**
 * LangChain prompt templates for recipe-details chain.
 * Template variables: {recipeName}, {ingredients}, {url} (URL extraction only).
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { PromptType } from "./types";

export const RECIPE_URL_EXTRACTION_TEMPLATE = ChatPromptTemplate.fromTemplate(
  `You are a recipe extraction assistant. Please extract the complete cooking instructions and additional information from this recipe URL: {url}

Recipe Name: {recipeName}
Ingredients: {ingredients}

Please provide:
1. Step-by-step cooking instructions (detailed and clear)
2. Cooking tips and techniques
3. Recipe variations or substitutions (if any)
4. Serving suggestions
5. Any additional helpful information (difficulty level, nutrition tips, storage instructions, etc.)

You MUST return a valid JSON object that matches the provided JSON schema exactly. The response must be valid JSON only, without any markdown formatting or additional text.`
);

export const RECIPE_WEB_SEARCH_TEMPLATE = ChatPromptTemplate.fromTemplate(
  `Search the web for detailed cooking instructions and recipe information for: {recipeName}

Ingredients: {ingredients}

Find and provide:
1. Complete step-by-step cooking instructions
2. Cooking tips and best practices
3. Recipe variations or modifications
4. Serving and presentation suggestions
5. Any additional relevant information

You MUST return a valid JSON object that matches the provided JSON schema exactly. The response must be valid JSON only, without any markdown formatting or additional text.`
);

export const promptTemplates: Record<PromptType, ChatPromptTemplate> = {
  [PromptType.RECIPE_URL_EXTRACTION]: RECIPE_URL_EXTRACTION_TEMPLATE,
  [PromptType.RECIPE_WEB_SEARCH]: RECIPE_WEB_SEARCH_TEMPLATE,
};
