import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { RecursiveCharacterTextSplitter } from "@langchain/text-splitters";
import { ApiError } from "../utils/api-error.js";

const SPLITTER_CONFIG = {
  chunkSize: 1000,
  chunkOverlap: 200,
};

/**
 * Load and split PDF document
 * @param {string} documentLocalPath - Path to the PDF file
 * @returns {Promise<Array>} Array of split document chunks
 */
export const loadAndPreparePDF = async (documentLocalPath) => {
  try {
    if (!documentLocalPath) {
      throw new ApiError(400, "Document local path is required");
    }

    const loader = new PDFLoader(documentLocalPath);
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Failed to load PDF or PDF is empty");
    }

    const splitter = new RecursiveCharacterTextSplitter(SPLITTER_CONFIG);
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
 * Load and split GitHub repository
 * @param {Object} params - GitHub loading parameters
 * @param {string} params.repoUrl - GitHub repository URL (e.g., "https://github.com/owner/repo")
 * @param {string} params.branch - Repository branch (defaults to "main")
 * @param {string} params.accessToken - GitHub access token (from env: GITHUB_ACCESS_TOKEN)
 * @returns {Promise<Array>} Array of split document chunks with GitHub metadata
 */
export const loadAndPrepareGithubRepo = async ({
  repoUrl,
  branch = "main",
  accessToken,
}) => {
  try {
    if (!repoUrl) {
      throw new ApiError(400, "Repository URL is required");
    }

    if (!accessToken) {
      throw new ApiError(400, "GitHub access token is required");
    }

    const loader = new GithubRepoLoader(repoUrl, {
      branch,
      accessToken,
      ignoreFiles: [
        "*.json",
        "*.lock",
        "*.yml",
        "*.yaml",
        ".*ignore",
        "package.json",
      ],
    });

    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Failed to load GitHub repository or repository is empty");
    }

    // Step 2: Enrich metadata with GitHub-specific information
    const enrichedDocs = docs.map((doc) => {
      // Extract file type from path
      const filePath = doc.metadata?.source || "";
      const fileName = filePath.split("/").pop() || "";
      const ext = fileName.split(".").pop() || "";

      // Determine file type and language
      const codeExtensions = {
        js: "javascript",
        ts: "typescript",
        jsx: "javascript",
        tsx: "typescript",
        py: "python",
        java: "java",
        cpp: "cpp",
        c: "c",
        go: "go",
        rs: "rust",
        rb: "ruby",
        php: "php",
        swift: "swift",
        kotlin: "kotlin",
        cs: "csharp",
        html: "html",
        css: "css",
        scss: "scss",
        json: "json",
        xml: "xml",
        sql: "sql",
        sh: "shell",
      };

      const fileType = ["md", "markdown", "txt"].includes(ext) ? "markdown" : "code";
      const language = codeExtensions[ext] || ext || "unknown";

      return {
        ...doc,
        metadata: {
          ...doc.metadata,
          fileType,
          language,
          path: filePath,
        },
      };
    });

    const largeFileSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 0,
    });

    const splitDocs = [];

    for (const doc of enrichedDocs) {
      const contentLength = doc.pageContent.length;

      if (contentLength < 2000) {
        // Small file → keep as-is, no split
        splitDocs.push(doc);
      } else {
        // Large file → split without overlap
        const chunks = await largeFileSplitter.splitDocuments([doc]);
        splitDocs.push(...chunks);
      }
    }

    if (!splitDocs || splitDocs.length === 0) {
      throw new ApiError(400, "Failed to split GitHub repository documents");
    }

    return splitDocs;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to load and split GitHub repository: ${error.message}`
    );
  }
};

export default {
  loadAndPreparePDF,
  loadAndPrepareGithubRepo,
};
