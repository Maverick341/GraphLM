import { tool } from "@openai/agents";
import { z } from "zod";
import { fetchGraphFacts } from "./fetchGraphFacts.js";

/**
 * CHAT GRAPH SEARCH TOOL
 * Purpose:
 *  - Ground LLM responses using knowledge graph facts
 *  - NOT for visualization
 *  - NOT for raw graph traversal
 */
export const graphSearchTool = tool({
  name: "graph_search",
  description:
    "Search the knowledge graph for factual relationships between entities. " +
    "Use this tool to understand architecture, dependencies, components, or how concepts are connected. " +
    "Returns grounded graph facts suitable for reasoning and explanation.",

  parameters: z.object({
    query: z
      .string()
      .describe("Entity or concept to search for in the knowledge graph"),
    anchorLimit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of anchor entities to consider (default: 10)"),
    hopDepth: z
      .number()
      .optional()
      .default(2)
      .describe(
        "Maximum relationship depth to explore from anchor entities (default: 2)",
      ),
  }),

  execute: async ({ query, anchorLimit, hopDepth }, context = {}) => {
    try {
      const { sources = [] } = context;

      // Extract sourceIds from active chat sources
      const sourceIds = sources.map((s) => s.sourceId || s._id).filter(Boolean);

      if (sourceIds.length === 0) {
        return {
          success: false,
          message:
            "No active sources available. Graph search requires indexed documents.",
          facts: [],
        };
      }

      const facts = await fetchGraphFacts({
        query,
        sourceIds,
        anchorLimit,
        hopDepth,
      });

      if (!facts || facts.length === 0) {
        return {
          success: false,
          message: "No relevant graph facts found for this query.",
          facts: [],
        };
      }

      return {
        success: true,
        message: `Retrieved ${facts.length} grounded graph facts.`,
        facts,
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
