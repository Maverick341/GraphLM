import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import config from "../../../../config/config.js";

/**
 * Retrieve relevant context from Qdrant vector store
 * @param {Object} params - Retrieval parameters
 * @param {string} params.query - User query to search for
 * @param {string} params.collectionName - Qdrant collection name
 * @param {number} params.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of context objects with text, score, and metadata
 */
export const retrieveFromVector = async ({ query, collectionName, limit = 5 }) => {
  try {
    if (!query || typeof query !== "string" || query.trim() === "") {
      throw new Error("Query is required and must be a non-empty string");
    }

    if (!collectionName || typeof collectionName !== "string") {
      throw new Error("Collection name is required");
    }

    // Initialize OpenAI embeddings
    const embeddings = new OpenAIEmbeddings({
      model: config.OPENAI_EMBEDDING_MODEL,
      openAIApiKey: config.OPENAI_API_KEY,
    });

    // Setup Qdrant client
    const clientOptions = { url: config.QDRANT_URL };
    if (config.QDRANT_API_KEY) {
      clientOptions.apiKey = config.QDRANT_API_KEY;
    }

    const client = new QdrantClient(clientOptions);

    // Connect to existing Qdrant collection
    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        client,
        collectionName,
      }
    );

    // Perform similarity search with scores
    const results = await vectorStore.similaritySearchWithScore(query, limit);

    // Transform results to structured context objects
    const contexts = results.map(([doc, score]) => ({
      text: doc.pageContent,
      score,
      metadata: {
        sourceId: doc.metadata?.sourceId,
        sourceType: doc.metadata?.sourceType,
        ...doc.metadata,
      },
    }));

    return contexts;
  } catch (error) {
    console.error("Vector retrieval error:", error);
    throw new Error(`Failed to retrieve from vector store: ${error.message}`);
  }
};
