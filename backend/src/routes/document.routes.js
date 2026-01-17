import { Router } from "express";
import { isLoggedIn } from "../middlewares/auth.middlewares.js";
import { upload } from "../middlewares/multer.middlewares.js";
import {
  uploadDocument,
  listUserDocuments,
  getDocumentById,
  deleteDocument,
} from "../controllers/document.controllers.js";

const router = Router();

// Apply auth middleware to all routes
router.use(isLoggedIn);

/**
 * POST /api/v1/documents
 * Upload a new document (PDF)
 * Requires: file in multipart form-data
 */
router.route("/").post(
  upload.single("document"),
  uploadDocument
);

/**
 * GET /api/v1/documents
 * List all documents for authenticated user
 */
router.route("/").get(listUserDocuments);

/**
 * GET /api/v1/documents/:documentId
 * Retrieve a specific document by ID
 */
router.route("/:documentId").get(getDocumentById);

/**
 * DELETE /api/v1/documents/:documentId
 * Delete a document by ID
 */
router.route("/:documentId").delete(deleteDocument);

export default router;
