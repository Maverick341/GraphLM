import { tool } from "@openai/agents";
import { z } from "zod";
import { retrieveFromVector } from "./vector/vectorRetriever.js";

/**
 * RAG tool for vector retrieval using Qdrant
 * Exposed to OpenAI Agent for retrieving relevant context from indexed sources
 */
export const vectorSearchTool = tool({
  name: "vector_search",
  description: 
    "Search through indexed documents using semantic similarity. " +
    "Use this to find relevant information from the user's uploaded sources (PDFs, GitHub repos). " +
    "Always use this tool before answering questions that require knowledge from the sources.",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant information"),
    collection: z.string().describe("The Qdrant collection name to search in"),
    limit: z.number().optional().default(5).describe("Maximum number of results to return (default: 5)"),
  }),
  execute: async ({ query, collection, limit }) => {
    try {
      const contexts = await retrieveFromVector({
        query,
        collectionName: collection,
        limit,
      });

      if (!contexts || contexts.length === 0) {
        return {
          success: false,
          message: "No relevant information found in the indexed sources.",
          contexts: [],
        };
      }

      return {
        success: true,
        message: `Found ${contexts.length} relevant chunks from the sources.`,
        contexts: contexts.map((ctx, idx) => ({
          index: idx + 1,
          text: ctx.text,
          relevance_score: ctx.score.toFixed(4),
          source_id: ctx.metadata.sourceId,
          source_type: ctx.metadata.sourceType,
        })),
      };
    } catch (error) {
      console.error("Vector search tool error:", error);
      return {
        success: false,
        message: `Vector search failed: ${error.message}`,
        contexts: [],
      };
    }
  },
});