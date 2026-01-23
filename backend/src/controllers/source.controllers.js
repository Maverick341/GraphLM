import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { Source } from "../models/source.models.js";
import { VectorIndexMetadata } from "../models/vectorIndexMetadata.models.js";
import { GraphMetadata } from "../models/graphMetadata.models.js";
import { indexGithubRepo } from "../services/vectorIndex.js";
import { indexToNeo4j } from "../services/graphIndex.js";

/**
 * Get all sources for the logged-in user
 * @route GET /sources
 * @query {number} page - Pagination (optional)
 * @query {number} limit - Items per page (optional)
 */
const getAllSources = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10 } = req.query;

  // TODO: Query MongoDB for sources where ownerId === userId
  // TODO: Apply pagination
  // TODO: Return paginated results

  const sources = [];

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        sources,
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

  // TODO: Query MongoDB for source where _id === id AND ownerId === userId
  // TODO: Check if source exists
  // TODO: Return source details

  const source = null; // Placeholder

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
const createGithubSource = asyncHandler(async (req, res) => {
  const { repoUrl, branch = "main" } = req.body;
  const userId = req.user._id;

  // Validation
  if (!repoUrl) {
    throw new ApiError(400, "Repository URL is required");
  }

  // Validate repoUrl format (basic check for GitHub URL)
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

    // Step 1: Create Source in MongoDB (status = "uploaded")
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

    // Step 2: Qdrant indexing (vector embeddings)
    vectorIndexResult = await indexGithubRepo({
      repoUrl,
      branch,
      collectionName,
      sourceId: source._id,
    });

    // Store VectorIndexMetadata
    await VectorIndexMetadata.create({
      sourceId: source._id,
      provider: "qdrant",
      collectionName,
      indexedAt: new Date(),
    });

    // Step 3: Set status = "indexing"
    source.status = "indexing";
    await source.save();

    // Step 4: Start Neo4j indexing asynchronously (don't await)
    // TODO: Implement Neo4j indexing for GitHub repositories
    // This should extract entities and relationships from code/docs
    (async () => {
      try {
        // TODO: Uncomment when Neo4j indexing is ready for GitHub sources
        /*
        const graphResult = await indexToNeo4j({
          sourceId: source._id,
          docs: vectorIndexResult.splitDocs,
        });

        // Store GraphMetadata
        await GraphMetadata.create({
          sourceId: source._id,
          entityCount: graphResult.nodesAdded,
          relationCount: graphResult.relationshipsAdded,
          builtAt: new Date(),
        });

        // Step 5: On success → status = "indexed"
        await Source.findByIdAndUpdate(source._id, { status: "indexed" });
        console.log(`Neo4j indexing completed successfully for source ${source._id}`);
        */

        // Temporary: Mark as indexed after vector indexing
        await Source.findByIdAndUpdate(source._id, { status: "indexed" });
      } catch (error) {
        // Step 6: On failure → status = "failed" (NO deletion)
        console.error(`Neo4j indexing failed for source ${source._id}:`, error);
        await Source.findByIdAndUpdate(source._id, { status: "failed" }).catch(
          (err) => {
            console.error("Failed to update source status to failed:", err);
          }
        );
      }
    })();

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
            vectorIndexed: vectorIndexResult.vector.chunksIndexed,
            message:
              "GitHub repository indexed successfully. Graph indexing pending.",
            createdAt: source.createdAt,
          },
          "GitHub repository indexed successfully. Vector indexing complete."
        )
      );
  } catch (error) {
    console.error("Error during GitHub source creation and indexing:", error);

    // If source was created, set status to failed (NO deletion)
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
 * Delete a source
 * @route DELETE /sources/:id
 * @param {string} id - Source ID
 */
const deleteSource = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  // TODO: Query MongoDB for source where _id === id AND ownerId === userId
  // TODO: Check if source exists
  // TODO: Delete source from MongoDB
  // TODO: Delete VectorIndexMetadata record
  // TODO: Delete GraphMetadata record
  // TODO: Clean up Qdrant collection (optional, depends on cleanup strategy)
  // TODO: Clean up Neo4j subgraph (optional, depends on cleanup strategy)

  const source = null; // Placeholder

  if (!source) {
    throw new ApiError(404, "Source not found");
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
  createGithubSource,
  deleteSource,
};
