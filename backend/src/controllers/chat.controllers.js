import { ChatSession } from "#models/chatSession.models.js";
import { ChatMessage } from "#models/chatMessage.models.js";
import { Source } from "#models/source.models.js";
import { ApiResponse } from "#utils/api-response.js";
import { ApiError } from "#utils/api-error.js";
import { asyncHandler } from "#utils/async-handler.js";
import { runChatRAG } from "#services/chat/chat.service.js";
import { persistConversationToMemory } from "#services/chat/rag/memory/memoryPersistence.js";
import { memoryClient } from "#services/chat/rag/memory/memoryClient.js";
import { deleteSessionMemories } from "#services/chat/rag/memory/memoryCleanup.js";
import { Readable } from "stream";

/**
 * POST /api/v1/chat
 * Create a new chat session
 * 
 * Responsibilities:
 * - Create an empty chat session (sources attached later via PATCH)
 * - Default title to "Untitled" if not provided
 * - Initialize sources as empty array []
 * - Enforce ownership (userId = req.user._id)
 * 
 * Note: Sources are uploaded/indexed separately via /sources endpoints,
 * then attached to chat sessions using PATCH /api/v1/chat/:chatId
 */
export const createChatSession = asyncHandler(async (req, res) => {
  const { title } = req.body;

  const chatTitle = title && typeof title === "string" && title.trim() !== "" 
    ? title.trim() 
    : "Untitled";

  const chatSession = await ChatSession.create({
    title: chatTitle,
    userId: req.user._id,
    sources: [], // Sources attached later via PATCH
  });

  return res.status(201).json(
    new ApiResponse(201, chatSession, "Chat session created successfully")
  );
});

/**
 * GET /api/v1/chat
 * List all chat sessions for authenticated user
 * 
 * Responsibilities:
 * - Filter chat sessions by req.user._id
 * - Return chat metadata only (title, sources, createdAt, etc.)
 * - Do NOT include messages in response
 * - Support pagination if needed
 */
export const listUserChatSessions = asyncHandler(async (req, res) => {
  const chatSessions = await ChatSession.find({
    userId: req.user._id,
  })
    .populate("sources", "title sourceType status")
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json(
    new ApiResponse(200, chatSessions, "Chat sessions retrieved successfully")
  );
});

/**
 * GET /api/v1/chat/:chatId
 * Retrieve a specific chat session by ID
 * 
 * Responsibilities:
 * - Return chat metadata only (title, sources, createdAt, etc.)
 * - Do NOT include messages (messages fetched via /messages endpoint)
 * - Verify ownership (chat belongs to authenticated user)
 */
export const getChatSessionById = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, "Invalid chat ID format");
  }

  const chatSession = await ChatSession.findById(chatId)
    .populate("sources", "title sourceType status")
    .lean();

  if (!chatSession) {
    throw new ApiError(404, "Chat session not found");
  }

  if (chatSession.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to access this chat session");
  }

  return res.status(200).json(
    new ApiResponse(200, chatSession, "Chat session retrieved successfully")
  );
});

/**
 * PATCH /api/v1/chat/:chatId
 * Update a chat session (title, sources)
 * 
 * Responsibilities:
 * - Allow updating title anytime
 * - Attach or modify sources ONLY if chat has no messages yet
 * - Verify all sources exist and belong to authenticated user
 * - Verify ownership (chat belongs to authenticated user)
 * - Return updated session metadata
 * 
 * Note: This is the primary endpoint for attaching indexed sources to chat sessions.
 */
export const updateChatSession = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { title, sources } = req.body;

  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, "Invalid chat ID format");
  }

  const chatSession = await ChatSession.findById(chatId);

  if (!chatSession) {
    throw new ApiError(404, "Chat session not found");
  }

  if (chatSession.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to update this chat session");
  }

  if (sources && Array.isArray(sources)) {
    const messageCount = await ChatMessage.countDocuments({ chatId });
    if (messageCount > 0) {
      throw new ApiError(400, "Cannot update sources after messages have been added");
    }

    const sourceRecords = await Source.find({
      _id: { $in: sources },
      ownerId: req.user._id,
    });

    if (sourceRecords.length !== sources.length) {
      throw new ApiError(400, "One or more sources do not exist or do not belong to you");
    }

    // Track which sources are new
    const existingSourceIds = chatSession.sources.map(s => s.toString());
    const newSourceIds = sources.filter(id => !existingSourceIds.includes(id.toString()));

    const mergedSources = [...new Set([...chatSession.sources.map(s => s.toString()), ...sources])];
    chatSession.sources = mergedSources;

    // Notify agent via memory about new sources (only if sources were actually added)
    if (newSourceIds.length > 0) {
      try {
        const newSources = sourceRecords.filter(sr => 
          newSourceIds.includes(sr._id.toString())
        );
        
        const sourceNames = newSources.map(s => s.title).join(", ");
        
        // Save to memory as a temporary notification (expires in 3 days)
        // This is just a notification, not a permanent fact
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 3);
        
        await memoryClient.add(
          [{ 
            role: "system", 
            content: `User added new sources to this chat: ${sourceNames}. These sources are now available for search and retrieval.` 
          }],
          {
            user_id: chatSession.userId.toString(),
            run_id: chatSession._id.toString(),
            agent_id: "graphlm_assistant",
            app_id: "graphlm",
            expiration_date: expirationDate.toISOString(), // Expires in 3 days
          }
        );
        
        console.log(`Notified agent about ${newSourceIds.length} new source(s) in chat ${chatId} (expires in 3 days)`);
      } catch (memError) {
        console.error("Failed to save source update to memory:", memError);
        // Don't fail the request if memory save fails
      }
    }
  }

  if (title && typeof title === "string" && title.trim() !== "") {
    chatSession.title = title.trim();
  }

  await chatSession.save();

  const updatedSession = await chatSession.populate("sources");

  return res.status(200).json(
    new ApiResponse(200, updatedSession, "Chat session updated successfully")
  );
});

/**
 * DELETE /api/v1/chat/:chatId
 * Delete a chat session by ID
 * 
 * Responsibilities:
 * - Delete ChatSession document
 * - Cascade delete all related ChatMessage records
 * - Delete all associated memories from mem0
 * - Verify ownership (chat belongs to authenticated user)
 */
export const deleteChatSession = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, "Invalid chat ID format");
  }

  const chatSession = await ChatSession.findById(chatId);

  if (!chatSession) {
    throw new ApiError(404, "Chat session not found");
  }

  if (chatSession.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to delete this chat session");
  }

  // Delete all messages in the chat
  await ChatMessage.deleteMany({ chatId });

  // Delete all memories associated with this chat session
  try {
    await deleteSessionMemories({
      userId: chatSession.userId.toString(),
      chatSessionId: chatSession._id.toString(),
    });
    console.log(`Deleted memories for chat session ${chatId}`);
  } catch (memError) {
    console.error("Failed to delete session memories:", memError);
    // Don't fail the request if memory deletion fails
  }

  // Delete the chat session itself
  await ChatSession.findByIdAndDelete(chatId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Chat session deleted successfully")
  );
});

/**
 * POST /api/v1/chat/:chatId/messages
 * Send a new message in a chat session
 * 
 * Responsibilities:
 * - Validate user message content
 * - Load chat session and verify ownership
 * - Persist user message to database
 * - Run RAG pipeline (vector retrieval + LLM agent)
 * - Stream assistant response back to client
 * - Persist assistant response after streaming completes
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content } = req.body;

  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, "Invalid chat ID format");
  }

  if (!content || typeof content !== "string" || content.trim() === "") {
    throw new ApiError(400, "Message content is required and must be a non-empty string");
  }

  const chatSession = await ChatSession.findById(chatId).populate("sources", "title sourceType status");

  if (!chatSession) {
    throw new ApiError(404, "Chat session not found");
  }

  if (chatSession.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to send messages in this chat");
  }

  const userMessage = await ChatMessage.create({
    chatId,
    role: "user",
    content: content.trim(),
  });

  try {
    // Run RAG pipeline and get streaming response
    const responseStream = await runChatRAG({
      chatSession,
      userMessage: content.trim(),
      chatId,
    });

    // Set headers for streaming response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Accumulate response text for persistence
    let fullResponse = "";

    // Convert Web ReadableStream to Node.js Readable stream
    const reader = responseStream.getReader();
    const nodeStream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
            return;
          }
          const text = new TextDecoder().decode(value);
          fullResponse += text;
          this.push(text);
        } catch (error) {
          this.destroy(error);
        }
      },
    });

    // Pipe stream to response
    nodeStream.pipe(res);

    // When streaming completes, persist assistant message and save to memory
    nodeStream.on("end", async () => {
      try {
        if (fullResponse.trim()) {
          // Persist assistant message to database
          await ChatMessage.create({
            chatId,
            role: "assistant",
            content: fullResponse.trim(),
          });
          console.log(`Assistant message persisted for chat ${chatId}`);

          // Automatically persist conversation turn to memory
          // This ensures the conversation context is available for future retrieval
          await persistConversationToMemory({
            userMessage: content.trim(),
            assistantMessage: fullResponse.trim(),
            chatSession,
          });
        }
      } catch (error) {
        console.error("Failed to persist assistant message:", error);
      }
    });

    // Handle errors
    nodeStream.on("error", (error) => {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json(
          new ApiResponse(500, {}, `Streaming error: ${error.message}`)
        );
      }
    });

  } catch (error) {
    console.error("RAG pipeline error:", error);
    
    // If streaming hasn't started, return JSON error
    if (!res.headersSent) {
      throw new ApiError(500, `Failed to process message: ${error.message}`);
    }
  }
});

/**
 * GET /api/v1/chat/:chatId/messages
 * List all messages in a chat session
 * 
 * Responsibilities:
 * - Paginate messages (skip, limit)
 * - Sort by createdAt ascending
 * - Return only: { role, content, createdAt }
 * - Verify ownership (chat belongs to authenticated user)
 */
export const listChatMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { skip = 0, limit = 50 } = req.query;

  if (!chatId || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
    throw new ApiError(400, "Invalid chat ID format");
  }

  const skipNum = Math.max(0, parseInt(skip, 10) || 0);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const chatSession = await ChatSession.findById(chatId);

  if (!chatSession) {
    throw new ApiError(404, "Chat session not found");
  }

  if (chatSession.userId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You do not have permission to view messages in this chat");
  }

  // Fetch messages with pagination and sorting
  const messages = await ChatMessage.find({ chatId })
    .select("role content createdAt")
    .sort({ createdAt: 1 })
    .skip(skipNum)
    .limit(limitNum)
    .lean();

  // Get total message count for pagination metadata
  const totalMessages = await ChatMessage.countDocuments({ chatId });

  return res.status(200).json(
    new ApiResponse(200, {
      messages,
      pagination: {
        skip: skipNum,
        limit: limitNum,
        total: totalMessages,
        hasMore: skipNum + limitNum < totalMessages
      }
    }, "Messages retrieved successfully")
  );
});
