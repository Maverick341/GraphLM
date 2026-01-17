import { Router } from "express";
import { isLoggedIn } from "../middlewares/auth.middlewares.js";
import {
  createChatSession,
  listUserChatSessions,
  getChatSessionById,
  updateChatSession,
  deleteChatSession,
  sendMessage,
  listChatMessages,
} from "../controllers/chat.controllers.js";

const router = Router();

// Apply auth middleware to all routes
router.use(isLoggedIn);

// ============================================
// CHAT SESSION ENDPOINTS
// ============================================

/**
 * POST /api/v1/chat
 * Create a new chat session
 * Body: { title: string, documents: ObjectId[] }
 */
router.route("/").post(createChatSession);

/**
 * GET /api/v1/chat
 * List all chat sessions for authenticated user
 */
router.route("/").get(listUserChatSessions);

/**
 * GET /api/v1/chat/:chatId
 * Retrieve a specific chat session by ID
 */
router.route("/:chatId").get(getChatSessionById);

/**
 * PATCH /api/v1/chat/:chatId
 * Update a chat session (title, documents, etc.)
 * Body: { title?: string, documents?: ObjectId[] }
 */
router.route("/:chatId").patch(updateChatSession);

/**
 * DELETE /api/v1/chat/:chatId
 * Delete a chat session by ID
 */
router.route("/:chatId").delete(deleteChatSession);

// ============================================
// CHAT MESSAGE ENDPOINTS
// ============================================

/**
 * POST /api/v1/chat/:chatId/messages
 * Send a new message in a chat session
 * Body: { content: string, role: "user" }
 */
router.route("/:chatId/messages").post(sendMessage);

/**
 * GET /api/v1/chat/:chatId/messages
 * List all messages in a chat session
 * Query params: ?skip=0&limit=50 (for pagination)
 */
router.route("/:chatId/messages").get(listChatMessages);

export default router;
