import express from "express";
import { isLoggedIn } from "#middlewares/auth.middlewares.js";
import {
  getAllSources,
  getSourceById,
  addGithubSource,
  getSourceStatus,
  deleteSource,
} from "#controllers/source.controllers.js";

const router = express.Router();

router.use(isLoggedIn);

// GET /sources - List all sources for the logged-in user
router.get("/", getAllSources);

// GET /sources/:id - Get a specific source by ID
router.get("/:id", getSourceById);

// GET /sources/:id/status - Get indexing status
router.get("/:id/status", getSourceStatus);

// POST /sources/github - Create a new GitHub repo source
router.post("/github", addGithubSource);

// DELETE /sources/:id - Delete a source
router.delete("/:id", deleteSource);

export default router;
