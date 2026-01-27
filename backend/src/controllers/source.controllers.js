import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Source } from "../models/source.models.js";
import { VectorIndexMetadata } from "../models/vectorIndexMetadata.models.js";
import { GraphMetadata } from "../models/graphMetadata.models.js";
import { indexGithubSource, deleteQdrantCollection } from "../services/indexing/vectorIndex.js";
import { buildGithubRepoGraph, deleteGraphBySourceId } from "../services/indexing/graphIndex.js";

/**
 * Get all sources for the logged-in user
 * @route GET /sources
 * @query {number} page - Pagination (optional)
 * @query {number} limit - Items per page (optional)
 */
const getAllSources = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  let { page = 1, limit = 10 } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1) {
    throw new ApiError(400, "Invalid pagination parameters");
  }

  const [total, sources] = await Promise.all([
    Source.countDocuments({ ownerId: userId }),
    Source.find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          items: sources,
          page,
          limit,
          total,
          totalPages,
        },
        "Sources retrieved successfully"
      )
    );
});

/**
 * Get a specific source by ID
 * @route GET /sources/:id
 * @param {string} id - Source ID
 */
const getSourceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const source = await Source.findOne({
    _id: id,
    ownerId: userId,
  });

  if (!source) {
    throw new ApiError(404, "Source not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        source,
        "Source retrieved successfully"
      )
    );
});

/**
 * Create a new GitHub repo source
 * @route POST /sources/github
 * @body {string} title - Source title
 * @body {string} repoUrl - GitHub repository URL
 * @body {string} branch - (optional) GitHub branch name, defaults to "main"
 */
const addGithubSource = asyncHandler(async (req, res) => {
  const { repoUrl, branch = "main" } = req.body;
  const userId = req.user._id;

  if (!repoUrl) {
    throw new ApiError(400, "Repository URL is required");
  }

  if (!repoUrl.includes("github.com")) {
    throw new ApiError(400, "Invalid GitHub repository URL");
  }

  let source;
  let collectionName;
  let vectorIndexResult;

  try {
    // Extract username/reponame from repoUrl (e.g., https://github.com/owner/repo -> owner/repo)
    const urlMatch = repoUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
    const repoTitle = urlMatch ? `${urlMatch[1]}/${urlMatch[2]}` : repoUrl;

    source = await Source.create({
      title: repoTitle,
      sourceType: "github_repo",
      repo: {
        repoUrl,
        branch,
      },
      status: "uploaded",
      ownerId: userId,
    });

    collectionName = `github_${source._id}`;

    vectorIndexResult = await indexGithubSource({
      repoUrl,
      branch,
      collectionName,
      sourceId: source._id,
    });

    await VectorIndexMetadata.create({
      sourceId: source._id,
      provider: "qdrant",
      collectionName,
      indexedAt: new Date(),
    });

    source.status = "indexing";
    await source.save();

    // Start Neo4j indexing asynchronously (don't await)
    (async () => {
      try {
        const graphResult = await buildGithubRepoGraph({
          sourceId: source._id,
          docs: vectorIndexResult.splitDocs,
        });

        await GraphMetadata.create({
          sourceId: source._id,
          entityCount: graphResult.nodesAdded,
          relationCount: graphResult.relationshipsAdded,
          builtAt: new Date(),
        });

        await Source.findByIdAndUpdate(source._id, { status: "indexed" });
        console.log(`Neo4j indexing completed successfully for source ${source._id}`);
      } catch (error) {
        console.error(`Neo4j indexing failed for source ${source._id}:`, error);
        await Source.findByIdAndUpdate(source._id, { status: "failed" }).catch(
          (err) => {
            console.error("Failed to update source status to failed:", err);
          }
        );
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
            vectorIndexed: vectorIndexResult.vector.chunksIndexed,
            statusUrl: `/sources/${source._id}/status`,
            message:
              "GitHub repository accepted for processing. Vector indexing complete, graph indexing in progress.",
            createdAt: source.createdAt,
          },
          "GitHub repository accepted for processing"
        )
      );
  } catch (error) {
    console.error("Error during GitHub source creation and indexing:", error);

    if (source && source._id) {
      await Source.findByIdAndUpdate(source._id, { status: "failed" }).catch(
        (err) => {
          console.error("Failed to update source status to failed:", err);
        }
      );
    }

    // Re-throw as ApiError
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to create and index GitHub source: ${error.message}`
    );
  }
});

/**
 * Get indexing status of a source (PDF or GitHub)
 * @route GET /sources/:id/status
 * @param {string} id - Source ID
 */
const getSourceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const source = await Source.findOne({
    _id: id,
    ownerId: userId
  });

  if (!source) {
    throw new ApiError(404, "Source not found");
  }

  const vectorMetadata = await VectorIndexMetadata.findOne({
    sourceId: id
  });

  const graphMetadata = await GraphMetadata.findOne({
    sourceId: id
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          sourceId: source._id,
          title: source.title,
          sourceType: source.sourceType,
          status: source.status,
          vector: {
            ready: !!vectorMetadata
          },
          graph: {
            ready: !!graphMetadata,
            ...(graphMetadata && {
              entityCount: graphMetadata.entityCount,
              relationCount: graphMetadata.relationCount
            })
          }
        },
        "Source status retrieved successfully"
      )
    );
});

/**
 * Delete a source
 * @route DELETE /sources/:id
 * @param {string} id - Source ID
 */
const deleteSource = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  const source = await Source.findOne({
    _id: id,
    ownerId: userId,
  });

  if (!source) {
    throw new ApiError(404, "Source not found");
  }

  const [vectorMetadata, graphMetadata] = await Promise.all([
    VectorIndexMetadata.findOne({ sourceId: id }),
    GraphMetadata.findOne({ sourceId: id }),
  ]);

  await Source.deleteOne({ _id: id, ownerId: userId });
  await Promise.all([
    VectorIndexMetadata.deleteOne({ sourceId: id }),
    GraphMetadata.deleteOne({ sourceId: id }),
  ]);

  const cleanupTasks = [];

  if (vectorMetadata?.collectionName) {
    cleanupTasks.push(
      deleteQdrantCollection(vectorMetadata.collectionName).catch((err) =>
        console.error("Failed to delete Qdrant collection:", err)
      )
    );
  }

  if (graphMetadata) {
    cleanupTasks.push(
      deleteGraphBySourceId(id).catch((err) =>
        console.error("Failed to delete Neo4j subgraph:", err)
      )
    );
  }

  if (cleanupTasks.length > 0) {
    await Promise.allSettled(cleanupTasks);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { id },
        "Source deleted successfully"
      )
    );
});

export {
  getAllSources,
  getSourceById,
  addGithubSource,
  getSourceStatus,
  deleteSource,
};
