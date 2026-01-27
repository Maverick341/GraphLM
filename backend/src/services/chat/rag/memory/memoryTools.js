import { z } from "zod";
import { memoryClient } from "./memoryClient.js";

/**
 * Search memory tool definition for OpenAI Agent
 */
export const searchMemoryTool = {
  name: "search_memory",
  description: "Search through past conversations and user context stored in memory. Use this to recall previous interactions, user preferences, or relevant context.",
  parameters: z.object({
    query: z.string().describe("The search query to find relevant memories"),
  }),
  execute: async ({ query }, context = {}) => {
    try {
      const { chatSession } = context;
      
      if (!chatSession) {
        return "Memory search unavailable - no chat context.";
      }

      // Build filters for scoped memory retrieval
      const filters = {
        AND: [
          { user_id: chatSession.userId.toString() },
          { run_id: chatSession._id.toString() },
          { agent_id: "graphlm_assistant" },
          { app_id: "graphlm" },
        ],
      };

      // Search memories with filters
      const result = await memoryClient.search(query, { 
        filters,
        limit: 5,
      });

      if (!result?.results || result.results.length === 0) {
        return "No relevant memories found.";
      }

      // Format memories for agent
      const memories = result.results
        .map((r, idx) => `${idx + 1}. ${r.memory}`)
        .join("\n");

      return `Found ${result.results.length} relevant memories:\n${memories}`;
    } catch (error) {
      console.error("Memory search tool error:", error);
      return "Memory search failed - continuing without memory context.";
    }
  },
};

/**
 * Save memory tool definition for OpenAI Agent
 */
export const saveMemoryTool = {
  name: "save_memory",
  description: "Save important information to memory for future reference. Use this to store user preferences, context, or key facts that should be remembered.",
  parameters: z.object({
    content: z.string().describe("The content to save to memory"),
  }),
  execute: async ({ content }, context = {}) => {
    try {
      const { chatSession, messages = [] } = context;
      
      if (!chatSession) {
        return "Memory save unavailable - no chat context.";
      }

      // Build metadata for scoped memory storage
      const metadata = {
        user_id: chatSession.userId.toString(),
        run_id: chatSession._id.toString(),
        agent_id: "graphlm_assistant",
        app_id: "graphlm",
      };

      // Save to memory with context
      await memoryClient.add(
        [{ role: "assistant", content }],
        metadata
      );

      return "Information saved to memory successfully.";
    } catch (error) {
      console.error("Memory save tool error:", error);
      return "Memory save failed - information not persisted.";
    }
  },
};
