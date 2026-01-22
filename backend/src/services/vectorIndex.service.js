import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/text_splitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { ApiError } from "../utils/api-error.js";
import config from "../config/config.js";

/**
 * Load and split PDF document
 * @param {string} documentLocalPath - Path to the PDF file
 * @returns {Promise<Array>} Array of split document chunks
 */
export const loadAndSplitPDF = async (documentLocalPath) => {
  try {
    if (!documentLocalPath) {
      throw new ApiError(400, "Document local path is required");
    }

    // Step 1: Load PDF
    const loader = new PDFLoader(documentLocalPath);
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Failed to load PDF or PDF is empty");
    }

    // Step 2: Split documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);

    if (!splitDocs || splitDocs.length === 0) {
      throw new ApiError(400, "Failed to split PDF documents");
    }

    return splitDocs;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to load and split PDF: ${error.message}`);
  }
};

/**
 * Index documents to Qdrant vector database
 * @param {Array} docs - Array of documents to index
 * @param {string} collectionName - Name of the Qdrant collection
 * @returns {Promise<Object>} Response with status and collection info
 */
export const indexToQdrant = async (docs, collectionName) => {
  try {
    if (!collectionName) {
      throw new ApiError(400, "Collection name is required to index to Qdrant");
    }

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Documents array is required and cannot be empty");
    }

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

    // Index documents to Qdrant
    const vectorStore = await QdrantVectorStore.fromDocuments(docs, embeddings, {
      client,
      collectionName,
    });

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
 * Complete indexing pipeline: Load, Split, Index to Qdrant
 * @param {string} documentLocalPath - Path to the PDF file
 * @param {string} collectionName - Name of the Qdrant collection
 * @returns {Promise<Object>} Response with indexing status
 */
export const indexPDFToQdrant = async (documentLocalPath, collectionName) => {
  try {
    // Step 1: Load and split PDF
    const splitDocs = await loadAndSplitPDF(documentLocalPath);

    // Step 2: Index to Qdrant
    const result = await indexToQdrant(splitDocs, collectionName);

    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index PDF to Qdrant: ${error.message}`
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
  loadAndSplitPDF,
  indexToQdrant,
  indexPDFToQdrant,
  deleteQdrantCollection,
};
