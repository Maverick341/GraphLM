import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ApiError } from "../../utils/api-error.js";
import config from "../../config/config.js";
import { loadAndPreparePDF, loadAndPrepareGithubRepo } from "./ingestion.js";


/**
 * Index documents to Qdrant vector database
 * @param {Array} docs - Array of documents to index
 * @param {string} collectionName - Name of the Qdrant collection
 * @param {string} sourceId - Source ID for filtering
 * @param {string} sourceType - Source type (pdf, github_repo)
 * @returns {Promise<Object>} Response with status and collection info
 */
export const indexToVectorStore = async (docs, collectionName, sourceId, sourceType) => {
  try {
    if (!collectionName) {
      throw new ApiError(400, "Collection name is required to index to Qdrant");
    }

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Documents array is required and cannot be empty");
    }

    if (!sourceId) {
      throw new ApiError(400, "sourceId is required for Qdrant indexing");
    }

    if (!sourceType) {
      throw new ApiError(400, "sourceType is required for Qdrant indexing");
    }

    // Attach source-level metadata to each document
    const docsWithMetadata = docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        sourceId: sourceId.toString(),
        sourceType: sourceType,
      },
    }));

    // Get Qdrant configuration
    const qdrantUrl = config.QDRANT_URL;
    const qdrantApiKey = config.QDRANT_API_KEY;

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      model: config.OPENAI_EMBEDDING_MODEL,
      openAIApiKey: config.OPENAI_API_KEY,
    });

    // Setup Qdrant client options
    const clientOptions = { url: qdrantUrl };
    if (qdrantApiKey) {
      clientOptions.apiKey = qdrantApiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Index documents to Qdrant with metadata
    const vectorStore = await QdrantVectorStore.fromDocuments(
      docsWithMetadata,
      embeddings,
      {
        client,
        collectionName,
      }
    );

    return {
      status: "ok",
      collection: collectionName,
      added: docs.length,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index documents to Qdrant: ${error.message}`
    );
  }
};

/**
 * Complete PDF indexing pipeline: Load, Split, and Index to Qdrant
 * @param {string} documentLocalPath - Path to the PDF file
 * @param {string} collectionName - Name of the Qdrant collection
 * @param {string} sourceId - Source ID for Neo4j scoping and Qdrant filtering
 * @param {string} sourceType - Source type (pdf, github_repo)
 * @returns {Promise<Object>} Response with indexing status for vector database
 */
export const indexPDFSource = async (documentLocalPath, collectionName, sourceId, sourceType = "pdf") => {
  try {
    // Step 1: Load and split PDF
    const splitDocs = await loadAndPreparePDF(documentLocalPath);

    // Step 2: Index to Qdrant (vector embeddings with metadata)
    const vectorResult = await indexToVectorStore(splitDocs, collectionName, sourceId, sourceType);

    return {
      status: "ok",
      vector: {
        collection: vectorResult.collection,
        chunksIndexed: vectorResult.added,
      },
      splitDocs, // Return splitDocs for later Neo4j indexing
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index PDF: ${error.message}`
    );
  }
};

/**
 * Complete GitHub repo indexing pipeline: Load, Split, and Index to Qdrant
 * @param {Object} params - GitHub indexing parameters
 * @param {string} params.repoUrl - GitHub repository URL
 * @param {string} params.branch - Repository branch (defaults to "main")
 * @param {string} params.collectionName - Name of the Qdrant collection
 * @param {string} params.sourceId - Source ID for Qdrant filtering
 * @returns {Promise<Object>} Response with indexing status for vector database
 */
export const indexGithubSource = async ({
  repoUrl,
  branch = "main",
  collectionName,
  sourceId,
}) => {
  try {
    // Validate inputs
    if (!repoUrl) {
      throw new ApiError(400, "Repository URL is required");
    }

    if (!collectionName) {
      throw new ApiError(400, "Collection name is required");
    }

    if (!sourceId) {
      throw new ApiError(400, "Source ID is required");
    }

    // Get GitHub access token from environment
    const accessToken = config.GITHUB_TOKEN;
    if (!accessToken) {
      throw new ApiError(400, "GitHub access token is not configured");
    }

    // Step 1: Load and split GitHub repository
    const splitDocs = await loadAndPrepareGithubRepo({
      repoUrl,
      branch,
      accessToken,
    });

    // Step 2: Index to Qdrant (vector embeddings with metadata)
    const vectorResult = await indexToVectorStore(
      splitDocs,
      collectionName,
      sourceId,
      "github_repo"
    );

    return {
      status: "ok",
      vector: {
        collection: vectorResult.collection,
        chunksIndexed: vectorResult.added,
      },
      splitDocs, // Return splitDocs for later Neo4j indexing if needed
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index GitHub repository: ${error.message}`
    );
  }
};

/**
 * Delete a collection from Qdrant
 * @param {string} collectionName - Name of the collection to delete
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteQdrantCollection = async (collectionName) => {
  try {
    if (!collectionName) {
      throw new ApiError(400, "Collection name is required to delete from Qdrant");
    }

    // Get Qdrant configuration
    const qdrantUrl = config.QDRANT_URL;
    const qdrantApiKey = config.QDRANT_API_KEY;

    // Setup Qdrant client options
    const clientOptions = { url: qdrantUrl };
    if (qdrantApiKey) {
      clientOptions.apiKey = qdrantApiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Delete the collection
    await client.deleteCollection(collectionName);

    return {
      status: "ok",
      collection: collectionName,
      message: "Collection deleted successfully",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to delete Qdrant collection: ${error.message}`
    );
  }
};

export default {
  indexToVectorStore,
  indexPDFSource,
  indexGithubSource,
  deleteQdrantCollection,
};
