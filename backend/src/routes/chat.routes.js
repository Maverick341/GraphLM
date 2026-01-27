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
 * Body: { title?: string }
 * @desc Creates an empty chat session. Sources are attached later via PATCH.
 * @default title="Untitled"
 */
router.route("/").post(createChatSession);

/**
 * GET /api/v1/chat
 * List all chat sessions for authenticated user
 * @desc Returns chat metadata only (excludes messages)
 */
router.route("/").get(listUserChatSessions);

/**
 * GET /api/v1/chat/:chatId
 * Retrieve a specific chat session by ID
 * @desc Returns chat metadata only (messages fetched via separate endpoint)
 */
router.route("/:chatId").get(getChatSessionById);

/**
 * PATCH /api/v1/chat/:chatId
 * Update a chat session (title, sources)
 * Body: { title?: string, sources?: ObjectId[] }
 * @desc Update title anytime. Attach/modify sources only if chat has no messages.
 * @desc Sources must exist and belong to authenticated user.
 */
router.route("/:chatId").patch(updateChatSession);

/**
 * DELETE /api/v1/chat/:chatId
 * Delete a chat session by ID
 * @desc Cascades to delete all related ChatMessage records
 */
router.route("/:chatId").delete(deleteChatSession);

// ============================================
// CHAT MESSAGE ENDPOINTS
// ============================================

/**
 * POST /api/v1/chat/:chatId/messages
 * Send a new message in a chat session
 * Body: { content: string }
 * @desc Processes user message through vector RAG, graph retrieval, and LLM pipeline
 */
router.route("/:chatId/messages").post(sendMessage);

/**
 * GET /api/v1/chat/:chatId/messages
 * List all messages in a chat session
 * @desc Paginated, sorted by createdAt descending
 * Query params: ?skip=0&limit=50
 */
router.route("/:chatId/messages").get(listChatMessages);

export default router;
