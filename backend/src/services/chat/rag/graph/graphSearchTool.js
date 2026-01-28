import { tool } from "@openai/agents";
import { z } from "zod";
import { retrieveFromGraph } from "./graphRetriever.js";

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