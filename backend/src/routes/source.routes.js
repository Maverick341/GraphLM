import express from "express";
import { isLoggedIn } from "../middlewares/auth.middlewares.js";
import {
  getAllSources,
  getSourceById,
  createGithubSource,
  deleteSource,
} from "../controllers/source.controllers.js";

const router = express.Router();

// Middleware: Require authentication for all source routes
router.use(isLoggedIn);

// GET /sources - List all sources for the logged-in user
router.get("/", getAllSources);

// GET /sources/:id - Get a specific source by ID
router.get("/:id", getSourceById);

// POST /sources/github - Create a new GitHub repo source
router.post("/github", createGithubSource);

// DELETE /sources/:id - Delete a source
router.delete("/:id", deleteSource);

export default router;
