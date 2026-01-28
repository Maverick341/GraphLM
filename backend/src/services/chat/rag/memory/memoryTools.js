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

      // Format memories for agent with IDs for update/delete operations
      const memories = result.results
        .map((r, idx) => `${idx + 1}. [ID: ${r.id}] ${r.memory}`)
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
  description: `Save important facts, insights, or preferences to memory. Choose the appropriate memory type:

PERMANENT MEMORIES (no expiration):
- User preferences and settings (e.g., "User prefers dark mode", "User likes sci-fi movies")
- Account/profile information
- Important facts and milestones
- Historical data that matters long-term

TEMPORARY MEMORIES (7-day expiration):
- Session context (current browsing, temporary interests)
- Temporary reminders or notes
- Recent observations that may change
- Cached or ephemeral data

Default: Use permanent memory unless the information is clearly temporary/session-based.`,
  parameters: z.object({
    content: z.string().describe("The specific fact, preference, or insight to save. Be concise and specific."),
    is_temporary: z.boolean().optional().describe("Set to true for temporary/session data that should expire in 7 days. Default: false (permanent)"),
  }),
  execute: async ({ content, is_temporary = false }, context = {}) => {
    try {
      const { chatSession } = context;
      
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

      // Add expiration date for temporary memories
      const addOptions = { ...metadata };
      if (is_temporary) {
        // Set expiration to 7 days from now
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        addOptions.expiration_date = expirationDate.toISOString();
      }

      // Save insight/fact to memory
      // mem0 will extract and store the semantic meaning
      await memoryClient.add(
        [{ role: "assistant", content }],
        addOptions
      );

      const memoryType = is_temporary ? "temporary (expires in 7 days)" : "permanent";
      return `Fact saved as ${memoryType} memory. This will be available for future recall.`;
    } catch (error) {
      console.error("Memory save tool error:", error);
      return "Memory save failed - information not persisted.";
    }
  },
};

/**
 * Update memory tool definition for OpenAI Agent
 */
export const updateMemoryTool = {
  name: "update_memory",
  description: "Update an existing memory when information changes. First search for the memory to get its ID, then call this tool with the ID and new content. Use this when information becomes outdated or needs correction rather than adding duplicate facts.",
  parameters: z.object({
    memory_id: z.string().describe("The ID of the memory to update (obtained from search_memory results)"),
    new_content: z.string().describe("The updated content to replace the existing memory"),
  }),
  execute: async ({ memory_id, new_content }, context = {}) => {
    try {
      const { chatSession } = context;
      
      if (!chatSession) {
        return "Memory update unavailable - no chat context.";
      }

      // Update memory with new content
      await memoryClient.update(memory_id, { text: new_content });

      return `Memory ${memory_id} updated successfully with new information.`;
    } catch (error) {
      console.error("Memory update tool error:", error);
      return `Memory update failed: ${error.message}`;
    }
  },
};

/**
 * Delete memory tool definition for OpenAI Agent
 */
export const deleteMemoryTool = {
  name: "delete_memory",
  description: "Delete a specific memory by ID when it's no longer relevant, incorrect, or the user requests it. First search for the memory to get its ID, then call this tool. Use this for complete removal rather than updates.",
  parameters: z.object({
    memory_id: z.string().describe("The ID of the memory to delete (obtained from search_memory results)"),
  }),
  execute: async ({ memory_id }, context = {}) => {
    try {
      const { chatSession } = context;
      
      if (!chatSession) {
        return "Memory deletion unavailable - no chat context.";
      }

      // Delete the memory
      await memoryClient.delete(memory_id);

      return `Memory ${memory_id} deleted successfully.`;
    } catch (error) {
      console.error("Memory delete tool error:", error);
      return `Memory deletion failed: ${error.message}`;
    }
  },
};
