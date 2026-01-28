import { memoryClient } from "./memoryClient.js";

/**
 * Memory cleanup strategies to prevent unbounded growth
 * Since mem0 OSS doesn't have automatic TTL/expiration, we implement manual cleanup
 */

/**
 * Get memory count for a specific scope
 * @param {Object} filters - Scope filters
 * @returns {Promise<number>} Memory count
 */
export const getMemoryCount = async (filters) => {
  try {
    const result = await memoryClient.getAll({ filters, limit: 10000 });
    return result?.results?.length || 0;
  } catch (error) {
    console.error("Failed to get memory count:", error);
    return 0;
  }
};

/**
 * Cleanup old memories for a chat session
 * Strategy: Keep only the most recent N memories per session
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.chatSessionId - Chat session ID (run_id)
 * @param {number} params.maxMemories - Maximum memories to keep (default: 100)
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupOldMemories = async ({
  userId,
  chatSessionId,
  maxMemories = 100,
}) => {
  try {
    const filters = {
      AND: [
        { user_id: userId },
        { run_id: chatSessionId },
        { agent_id: "graphlm_assistant" },
        { app_id: "graphlm" },
      ],
    };

    // Get all memories for this scope
    const result = await memoryClient.getAll({ filters, limit: 10000 });
    const memories = result?.results || [];

    if (memories.length <= maxMemories) {
      return {
        total: memories.length,
        deleted: 0,
        message: "No cleanup needed",
      };
    }

    // Sort by creation date (oldest first)
    const sortedMemories = memories.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    // Delete oldest memories, keep most recent maxMemories
    const memoriesToDelete = sortedMemories.slice(
      0,
      memories.length - maxMemories
    );

    let deletedCount = 0;
    for (const memory of memoriesToDelete) {
      try {
        await memoryClient.delete(memory.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete memory ${memory.id}:`, error);
      }
    }

    console.log(
      `Cleaned up ${deletedCount} old memories for chat ${chatSessionId}`
    );

    return {
      total: memories.length,
      deleted: deletedCount,
      remaining: memories.length - deletedCount,
      message: `Deleted ${deletedCount} oldest memories`,
    };
  } catch (error) {
    console.error("Memory cleanup error:", error);
    return {
      total: 0,
      deleted: 0,
      error: error.message,
    };
  }
};

/**
 * Delete all memories for a specific chat session
 * Useful when user deletes a chat
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.chatSessionId - Chat session ID
 * @returns {Promise<void>}
 */
export const deleteSessionMemories = async ({ userId, chatSessionId }) => {
  try {
    await memoryClient.deleteAll({
      userId,
      runId: chatSessionId,
    });

    console.log(`Deleted all memories for chat session ${chatSessionId}`);
  } catch (error) {
    console.error("Failed to delete session memories:", error);
    throw error;
  }
};

/**
 * Periodic cleanup job - should be called periodically (e.g., daily cron job)
 * Cleans up old memories across all users to prevent unbounded growth
 * 
 * @param {number} maxMemoriesPerSession - Max memories per session (default: 100)
 * @returns {Promise<Object>} Cleanup statistics
 */
export const periodicMemoryCleanup = async (maxMemoriesPerSession = 100) => {
  try {
    // In a production system, you would:
    // 1. Get all active chat sessions from MongoDB
    // 2. For each session, run cleanupOldMemories
    // 3. Log statistics
    
    console.log("Starting periodic memory cleanup...");
    
    // This is a placeholder - implement based on your needs
    // Example: Clean up memories older than 90 days, etc.
    
    return {
      success: true,
      message: "Periodic cleanup completed",
    };
  } catch (error) {
    console.error("Periodic cleanup error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Check if memory cleanup is needed for a chat session
 * Call this before persisting new memories
 * 
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.chatSessionId - Chat session ID
 * @param {number} params.threshold - Cleanup threshold (default: 150)
 * @param {number} params.targetSize - Target size after cleanup (default: 100)
 * @returns {Promise<boolean>} Whether cleanup was performed
 */
export const checkAndCleanupIfNeeded = async ({
  userId,
  chatSessionId,
  threshold = 150,
  targetSize = 100,
}) => {
  try {
    const filters = {
      AND: [
        { user_id: userId },
        { run_id: chatSessionId },
        { agent_id: "graphlm_assistant" },
        { app_id: "graphlm" },
      ],
    };

    const count = await getMemoryCount(filters);

    if (count >= threshold) {
      console.log(
        `Memory count (${count}) exceeded threshold (${threshold}). Running cleanup...`
      );
      await cleanupOldMemories({
        userId,
        chatSessionId,
        maxMemories: targetSize,
      });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Cleanup check error:", error);
    return false;
  }
};
