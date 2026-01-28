import { VectorIndexMetadata } from "#models/vectorIndexMetadata.models.js";
import { ChatMessage } from "#models/chatMessage.models.js";
import { runAgentWithRAG } from "./rag/agent/agentRunner.js";

/**
 * Run RAG pipeline for chat message
 * @param {Object} params - Chat RAG parameters
 * @param {Object} params.chatSession - Chat session with populated sources
 * @param {string} params.userMessage - User's message content
 * @param {string} params.chatId - Chat session ID for history
 * @returns {Promise<ReadableStream>} Streaming response from RAG agent
 */
export const runChatRAG = async ({ chatSession, userMessage, chatId }) => {
  try {
    if (!chatSession) {
      throw new Error("Chat session is required");
    }

    if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
      throw new Error("User message is required");
    }

    // Extract source IDs from chat session
    const sourceIds = chatSession.sources.map(source => 
      typeof source === 'object' ? source._id : source
    );

    if (sourceIds.length === 0) {
      throw new Error("No sources attached to this chat session. Please attach sources first.");
    }

    // Resolve vector collection names from VectorIndexMetadata
    const vectorMetadataRecords = await VectorIndexMetadata.find({
      sourceId: { $in: sourceIds },
    }).lean();

    if (vectorMetadataRecords.length === 0) {
      throw new Error("No indexed sources found. Sources may still be indexing.");
    }

    // Prepare sources array with collection names for agent
    const sourcesWithCollections = chatSession.sources
      .map(source => {
        const sourceId = typeof source === 'object' ? source._id.toString() : source.toString();
        const metadata = vectorMetadataRecords.find(
          m => m.sourceId.toString() === sourceId
        );
        
        if (!metadata) return null;

        return {
          _id: sourceId,
          title: source.title || "Untitled Source",
          sourceType: source.sourceType || "unknown",
          collectionName: metadata.collectionName,
        };
      })
      .filter(Boolean);

    if (sourcesWithCollections.length === 0) {
      throw new Error("No indexed collections available for retrieval.");
    }

    // Run agent with RAG and memory tools
    // Note: Conversation history is handled by memory tools - no need to pass it explicitly
    const responseStream = await runAgentWithRAG({
      userMessage,
      sources: sourcesWithCollections,
      chatSession,
    });

    return responseStream;
  } catch (error) {
    console.error("Chat RAG error:", error);
    throw error;
  }
};

/**
 * Helper function to collect stream into full text
 * Used for persisting assistant response after streaming
 * @param {ReadableStream} stream - Text stream from agent
 * @returns {Promise<string>} Complete response text
 */
export const collectStreamText = async (stream) => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullText += decoder.decode(value, { stream: true });
    }
    return fullText;
  } finally {
    reader.releaseLock();
  }
};
