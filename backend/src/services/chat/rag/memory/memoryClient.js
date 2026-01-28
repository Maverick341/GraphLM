import { Memory } from "mem0ai/oss";
import config from "#config/config.js";

/**
 * Mem0 Memory client for semantic memory storage and retrieval
 * Scoped by user_id, run_id (chatSession), agent_id, and app_id
 * 
 * Uses:
 * - OpenAI embeddings for semantic search
 * - Qdrant vector store (same as documents)
 * - Collection name: "memories"
 */
export const memoryClient = new Memory({
  version: "v1.1",
  embedder: {
    provider: "openai",
    config: {
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
    },
  },
  vectorStore: {
    provider: "qdrant",
    config: {
      url: config.QDRANT_URL,
      apiKey: config.QDRANT_API_KEY,
      collection: "memories",
    },
  },
});
