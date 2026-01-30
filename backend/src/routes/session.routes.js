import { Router } from "express";
import { isLoggedIn } from "#middlewares/auth.middlewares.js";
import {
  createChatSession,
  listUserChatSessions,
  getChatSessionById,
  updateChatSession,
  deleteChatSession,
  sendMessage,
  listChatMessages,
  graphQueryFromSession,
} from "#controllers/session.controllers.js";

const router = Router();

// Apply auth middleware to all routes
router.use(isLoggedIn);



/**
 * POST /api/v1/session
 * Create a new chat session
 * Body: { title?: string }
 * @desc Creates an empty chat session. Sources are attached later via PATCH.
 * @default title="Untitled"
 */
router.route("/").post(createChatSession);

/**
 * GET /api/v1/session
 * List all chat sessions for authenticated user
 * @desc Returns chat metadata only (excludes messages)
 */
router.route("/").get(listUserChatSessions);

/**
 * GET /api/v1/session/:sessionId
 * Retrieve a specific chat session by ID
 * @desc Returns chat metadata only (messages fetched via separate endpoint)
 */
router.route("/:sessionId").get(getChatSessionById);

/**
 * PATCH /api/v1/session/:sessionId
 * Update a chat session (title, sources)
 * Body: { title?: string, sources?: ObjectId[] }
 * @desc Update title anytime. Attach/modify sources only if chat has no messages.
 * @desc Sources must exist and belong to authenticated user.
 */
router.route("/:sessionId").patch(updateChatSession);

/**
 * DELETE /api/v1/session/:sessionId
 * Delete a chat session by ID
 * @desc Cascades to delete all related ChatMessage records
 */
router.route("/:sessionId").delete(deleteChatSession);



/**
 * POST /api/v1/session/:sessionId/messages
 * Send a new message in a chat session
 * Body: { content: string }
 * @desc Processes user message through vector RAG, graph retrieval, and LLM pipeline
 */
router.route("/:sessionId/messages").post(sendMessage);

/**
 * GET /api/v1/session/:sessionId/messages
 * List all messages in a chat session
 * @desc Paginated, sorted by createdAt descending
 * Query params: ?skip=0&limit=50
 */
router.route("/:sessionId/messages").get(listChatMessages);

/**
 * POST /api/v1/session/:sessionId/graphQuery
 * KG visualization query (Studio panel)
 * Body: { query: string }
 * @desc Returns raw subgraph (nodes + edges) for visualization
 */
router.route("/:sessionId/graphQuery").post(graphQueryFromSession);

export default router;
