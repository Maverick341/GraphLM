import { Router } from "express";
import { isLoggedIn } from "#middlewares/auth.middlewares.js";
import { upload } from "#middlewares/multer.middlewares.js";
import {
  addPDFSource,
  listUserDocuments,
  getDocumentById,
  deleteDocument,
} from "#controllers/document.controllers.js";

const router = Router();

router.use(isLoggedIn);

/**
 * POST /api/v1/documents
 * Add a new PDF document (Source: pdf)
 */
router.post(
  "/",
  upload.single("document"),
  addPDFSource
);

/**
 * GET /api/v1/documents
 */
router.get("/", listUserDocuments);

/**
 * GET /api/v1/documents/:documentId
 */
router.get("/:documentId", getDocumentById);

/**
 * DELETE /api/v1/documents/:documentId
 */
router.delete("/:documentId", deleteDocument);

export default router;
