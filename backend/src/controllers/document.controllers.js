import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Source } from "../models/source.models.js";
import { VectorIndexMetadata } from "../models/vectorIndexMetadata.models.js";
import { GraphMetadata } from "../models/graphMetadata.models.js";
import { indexPDFToQdrant } from "../services/vectorIndex.service.js";
import { deleteQdrantCollection } from "../services/vectorIndex.service.js";
import path from "path";
import fs from "fs";

/**
 * POST /api/v1/documents
 * Upload a new document (PDF)
 */
export const uploadDocument = asyncHandler(async (req, res) => {
  const documentLocalPath = req.file?.path;
  
  if (!documentLocalPath) {
    throw new ApiError(400, "PDF file is required");
  }

  let source;
  let collectionName;

  try {
    const filename = req.file.filename;
    const title = path.parse(filename).name;

    source = await Source.create({
      title,
      sourceType: "pdf",
      file: {
        localpath: documentLocalPath
      },
      status: "uploaded",
      ownerId: req.user._id
    });

    collectionName = `source_${source._id}`;

    const vectorIndexResult = await indexPDFToQdrant(
      documentLocalPath,
      collectionName
    );

    await VectorIndexMetadata.create({
      sourceId: source._id,
      provider: "qdrant",
      collectionName,
      indexedAt: new Date()
    });

    const cloudinaryResponse = await uploadOnCloudinary(documentLocalPath);
    
    if (!cloudinaryResponse) {
      throw new ApiError(500, "Failed to upload PDF to Cloudinary");
    }

    source.file.url = cloudinaryResponse.secure_url;
    source.status = "indexed";
    await source.save();

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          {
            sourceId: source._id,
            title: source.title,
            sourceType: source.sourceType,
            status: source.status,
            collectionName,
            fileUrl: cloudinaryResponse.secure_url,
            vectorIndexed: vectorIndexResult.added,
            createdAt: source.createdAt
          },
          "PDF uploaded, indexed, and source created successfully"
        )
      );
  } catch (error) {
    console.error("Error during PDF upload and indexing:", error);

    // Try to delete the source that was created
    if (source && source._id) {
      await Source.findByIdAndDelete(source._id).catch((err) => {
        console.error("Failed to delete source during cleanup:", err);
      });
    }

    // Try to delete VectorIndexMetadata if it was created
    if (source && source._id) {
      await VectorIndexMetadata.findOneAndDelete({ sourceId: source._id }).catch(
        (err) => {
          console.error("Failed to delete VectorIndexMetadata during cleanup:", err);
        }
      );
    }

    // Try to clean up Qdrant collection if it was created
    if (collectionName) {
      await deleteQdrantCollection(collectionName).catch((err) => {
        console.error("Failed to delete Qdrant collection during cleanup:", err);
      });
    }

    // Try to clean up local file if it still exists
    if (documentLocalPath && fs.existsSync(documentLocalPath)) {
      try {
        fs.unlinkSync(documentLocalPath);
      } catch (err) {
        console.error("Failed to delete local file during cleanup:", err);
      }
    }

    // Re-throw as ApiError
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to upload and index PDF: ${error.message}`);
  }
});

/**
 * GET /api/v1/documents
 * List all documents for authenticated user
 */
export const listUserDocuments = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const sources = await Source.find({
    ownerId: userId,
    sourceType: "pdf"
  }).select("title sourceType status file createdAt");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        sources,
        "Documents retrieved successfully"
      )
    );
});

/**
 * GET /api/v1/documents/:documentId
 * Retrieve a specific document by ID
 */
export const getDocumentById = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user._id;

  const source = await Source.findOne({
    _id: documentId,
    ownerId: userId,
    sourceType: "pdf"
  });

  if (!source) {
    throw new ApiError(404, "Document not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        source,
        "Document retrieved successfully"
      )
    );
});

/**
 * DELETE /api/v1/documents/:documentId
 * Delete a document by ID
 */
export const deleteDocument = asyncHandler(async (req, res) => {
  const { documentId } = req.params;
  const userId = req.user._id;

  const source = await Source.findOneAndDelete({
    _id: documentId,
    ownerId: userId,
    sourceType: "pdf"
  });

  if (!source) {
    throw new ApiError(404, "Document not found");
  }

  try {
    // Delete VectorIndexMetadata
    const vectorMetadata = await VectorIndexMetadata.findOneAndDelete({
      sourceId: source._id
    });

    // Clean up Qdrant collection
    if (vectorMetadata && vectorMetadata.collectionName) {
      await deleteQdrantCollection(vectorMetadata.collectionName).catch((err) => {
        console.error(
          `Failed to delete Qdrant collection ${vectorMetadata.collectionName}:`,
          err
        );
      });
    }

    // Delete GraphMetadata
    await GraphMetadata.findOneAndDelete({ sourceId: source._id }).catch(
      (err) => {
        console.error("Failed to delete GraphMetadata:", err);
      }
    );

    // TODO: Clean up Neo4j subgraph
  } catch (error) {
    console.error("Error during document deletion cleanup:", error);
    // Don't throw - source is already deleted, just log cleanup errors
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { documentId },
        "Document deleted successfully"
      )
    );
});
