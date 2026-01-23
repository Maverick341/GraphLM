import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/text-splitters";
import { ApiError } from "../utils/api-error.js";

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

export default {
  loadAndSplitPDF,
};
