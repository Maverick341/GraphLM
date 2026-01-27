import { tool } from "@openai/agents";
import { z } from "zod";
import { retrieveFromVector } from "./vector/vectorRetriever.js";
import { retrieveFromGraph } from "./graph/graphRetriever.js";

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


/**
 * Graph search tool for OpenAI Agent
 * Enables semantic search over structured knowledge graphs in Neo4j
 */
export const graphSearchTool = tool({
  name: "graph_search",
  description:
    "Search structured knowledge graph for entities and relationships. " +
    "Use this when the query involves relationships, architecture, dependencies, or structure. " +
    "This tool finds entities and their connections in the knowledge graph.",
  parameters: z.object({
    query: z.string().describe("Concept or entity to search for"),
    limit: z.number().optional().default(25).describe("Maximum number of results to return (default: 25)"),
  }),
  execute: async ({ query, limit }, context = {}) => {
    try {
      const { sources = [] } = context;
      
      // Extract sourceIds from the sources context
      const sourceIds = sources.map(source => source.sourceId || source._id);
      
      if (sourceIds.length === 0) {
        return {
          success: false,
          message: "No sources available for graph search in this chat session",
          facts: [],
        };
      }

      const results = await retrieveFromGraph({
        query,
        sourceIds,
        limit,
      });

      if (!results || results.length === 0) {
        return {
          success: false,
          message: "No related entities found in the graph",
          facts: [],
        };
      }

      return {
        success: true,
        message: `Found ${results.length} graph facts`,
        facts: results.map((item, idx) => ({
          index: idx + 1,
          entity: item.entity,
          relationship: item.relationship,
          related: item.relatedEntity,
        })),
      };
    } catch (error) {
      console.error("Graph search tool error:", error);
      return {
        success: false,
        message: `Graph search failed: ${error.message}`,
        facts: [],
      };
    }
  },
});