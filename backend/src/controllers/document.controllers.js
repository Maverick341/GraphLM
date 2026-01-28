import { asyncHandler } from "#utils/async-handler.js";
import { ApiResponse } from "#utils/api-response.js";
import { ApiError } from "#utils/api-error.js";
import { uploadOnCloudinary } from "#utils/cloudinary.js";
import { Source } from "#models/source.models.js";
import { VectorIndexMetadata } from "#models/vectorIndexMetadata.models.js";
import { GraphMetadata } from "#models/graphMetadata.models.js";
import { indexPDFSource, deleteQdrantCollection } from "#services/indexing/vectorIndex.js";
import { buildPDFGraph, deleteGraphBySourceId } from "#services/indexing/graphIndex.js";
import path from "path";
import fs from "fs";

/**
 * POST /api/v1/documents
 * Upload a new document (PDF)
 */
export const addPDFSource = asyncHandler(async (req, res) => {
  const documentLocalPath = req.file?.path;
  
  if (!documentLocalPath) {
    throw new ApiError(400, "PDF file is required");
  }

  let source;
  let collectionName;
  let splitDocs;

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

    const vectorIndexResult = await indexPDFSource(
      documentLocalPath,
      collectionName,
      source._id,
      "pdf"
    );

    await VectorIndexMetadata.create({
      sourceId: source._id,
      provider: "qdrant",
      collectionName,
      indexedAt: new Date()
    });

    source.status = "indexing";
    await source.save();

    const cloudinaryResponse = await uploadOnCloudinary(documentLocalPath);
    
    if (!cloudinaryResponse) {
      throw new ApiError(500, "Failed to upload PDF to Cloudinary");
    }

    source.file.url = cloudinaryResponse.secure_url;
    await source.save();

    (async () => {
      try {
        const graphResult = await buildPDFGraph({
          sourceId: source._id,
          docs: vectorIndexResult.splitDocs,
        });

        await GraphMetadata.create({
          sourceId: source._id,
          entityCount: graphResult.nodesAdded,
          relationCount: graphResult.relationshipsAdded,
          builtAt: new Date()
        });

        await Source.findByIdAndUpdate(source._id, { status: "indexed" });
        console.log(`Neo4j indexing completed successfully for source ${source._id}`);
      } catch (error) {
        console.error(`Neo4j indexing failed for source ${source._id}:`, error);
        await Source.findByIdAndUpdate(source._id, { status: "failed" }).catch((err) => {
          console.error("Failed to update source status to failed:", err);
        });
      }
    })();

    return res
      .status(202)
      .json(
        new ApiResponse(
          202,
          {
            sourceId: source._id,
            title: source.title,
            sourceType: source.sourceType,
            status: source.status,
            collectionName,
            fileUrl: cloudinaryResponse.secure_url,
            vectorIndexed: vectorIndexResult.vector.chunksIndexed,
            statusUrl: `/sources/${source._id}/status`,
            message: "PDF accepted for processing. Vector indexing complete, graph indexing in progress.",
            createdAt: source.createdAt
          },
          "PDF accepted for processing"
        )
      );
  } catch (error) {
    console.error("Error during PDF upload and indexing:", error);

    if (documentLocalPath && fs.existsSync(documentLocalPath)) {
      try {
        fs.unlinkSync(documentLocalPath);
      } catch (err) {
        console.error("Failed to delete local file during cleanup:", err);
      }
    }

    if (source && source._id) {
      await Source.findByIdAndUpdate(source._id, { status: "failed" }).catch((err) => {
        console.error("Failed to update source status to failed:", err);
      });
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
    const vectorMetadata = await VectorIndexMetadata.findOneAndDelete({
      sourceId: source._id
    });

    if (vectorMetadata && vectorMetadata.collectionName) {
      await deleteQdrantCollection(vectorMetadata.collectionName).catch((err) => {
        console.error(
          `Failed to delete Qdrant collection ${vectorMetadata.collectionName}:`,
          err
        );
      });
    }

    await GraphMetadata.findOneAndDelete({ sourceId: source._id }).catch(
      (err) => {
        console.error("Failed to delete GraphMetadata:", err);
      }
    );

    await deleteGraphBySourceId(source._id).catch((err) => {
      console.error(`Failed to delete Neo4j entities for source ${source._id}:`, err);
    });
  } catch (error) {
    console.error("Error during document deletion cleanup:", error);
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
