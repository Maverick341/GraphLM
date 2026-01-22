import { asyncHandler } from "../utils/async-handler.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";

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
  const { title, repoUrl, branch = "main" } = req.body;
  const userId = req.user._id;

  // Validation
  if (!title || !repoUrl) {
    throw new ApiError(400, "Title and repoUrl are required");
  }

  // TODO: Validate repoUrl format
  // TODO: Create Source in MongoDB with sourceType="github_repo"
  // TODO: Store repo metadata (repoUrl, branch)
  // TODO: Trigger GitHub ingestion via githubIngestion.service.js (or queue for background job)
  // TODO: Return created source with status="uploaded"

  const newSource = {
    _id: null, // MongoDB will assign
    title,
    sourceType: "github_repo",
    repo: { repoUrl, branch },
    status: "uploaded",
    ownerId: userId,
    createdAt: new Date(),
  };

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        newSource,
        "GitHub source created successfully"
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
