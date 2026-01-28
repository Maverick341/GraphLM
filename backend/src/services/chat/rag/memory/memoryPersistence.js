import { memoryClient } from "./memoryClient.js";
import { checkAndCleanupIfNeeded } from "./memoryCleanup.js";

/**
 * Automatically persist conversation turn to memory
 * This ensures all user-assistant exchanges are stored for context retrieval
 * Also checks if cleanup is needed to prevent unbounded memory growth
 * 
 * @param {Object} params
 * @param {string} params.userMessage - User's message content
 * @param {string} params.assistantMessage - Assistant's response content
 * @param {Object} params.chatSession - Chat session object with userId and _id
 * @returns {Promise<void>}
 */
export const persistConversationToMemory = async ({
  userMessage,
  assistantMessage,
  chatSession,
}) => {
  try {
    if (!chatSession || !userMessage || !assistantMessage) {
      console.warn("Incomplete conversation data - skipping memory persistence");
      return;
    }

    // Check if cleanup is needed before adding new memories
    // This prevents unbounded memory growth
    await checkAndCleanupIfNeeded({
      userId: chatSession.userId.toString(),
      chatSessionId: chatSession._id.toString(),
      threshold: 150, // Cleanup when memory count exceeds 150
      targetSize: 100, // Keep only most recent 100 memories
    });

    // Build metadata for scoped memory storage
    const metadata = {
      user_id: chatSession.userId.toString(),
      run_id: chatSession._id.toString(),
      agent_id: "graphlm_assistant",
      app_id: "graphlm",
    };

    // Add 30-day expiration for conversation history (temporary session data)
    // Conversation turns are temporary context - preferences/facts extracted by agent are permanent
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 30); // 30 days for chat history
    const addOptions = {
      ...metadata,
      expiration_date: expirationDate.toISOString(),
    };

    // Save conversation exchange to memory with expiration
    // mem0 will extract semantic facts and relationships from the conversation
    await memoryClient.add(
      [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ],
      addOptions
    );

    console.log(`Conversation persisted to memory for chat ${chatSession._id}`);
  } catch (error) {
    // Log error but don't throw - memory persistence failure shouldn't break chat flow
    console.error("Failed to persist conversation to memory:", error);
  }
};
