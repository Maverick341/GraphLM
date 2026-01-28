import { Agent, Runner } from "@openai/agents";
import { 
  searchMemoryTool, 
  saveMemoryTool, 
  updateMemoryTool, 
  deleteMemoryTool 
} from "../memory/memoryTools.js";
import config from "#config/config.js";
import { vectorSearchTool } from "../vector/vectorSearchTool.js";
import { graphSearchTool } from "../graph/graphSearchTool.js";

/**
 * Build system prompt for the research assistant
 * @param {Object} chatContext - Chat session context
 * @returns {string} System prompt
 */
const buildSystemPrompt = (chatContext = {}) => {
  const { sources = [] } = chatContext;

  let prompt = `You are a helpful research assistant with access to the user's indexed documents and memory.

Your capabilities:
- You can search through uploaded PDFs and GitHub repositories using semantic similarity (vector_search tool)
- You can search structured knowledge graphs for entities and relationships (graph_search tool)
- You can search past conversations and user context using the search_memory tool
- You can save important information for later recall using the save_memory tool
- You can update existing memories when information changes using the update_memory tool
- You can delete memories that are no longer relevant using the delete_memory tool
- You provide accurate, well-sourced answers based on indexed content and memory
- You cite sources when providing information

You have access to search tools:
1. vector_search – for finding relevant text passages and content-based queries
2. graph_search – for understanding entities, relationships, dependencies, and structure

Memory management guidelines:
- Use search_memory to recall past interactions, preferences, or context. Search results include memory IDs in format [ID: xxx]
- Use save_memory to store important facts, preferences, or context for future conversations
- Use update_memory when information changes. First search to find the memory ID, then call update_memory with that ID and new content
- Use delete_memory to remove outdated or incorrect information. First search to get the memory ID
- Be proactive about searching memory when users reference past conversations
- Save key information that should be remembered (preferences, decisions, important facts)

Response guidelines:
- Be concise but comprehensive in your responses
- If information is not found in sources or memory, clearly state that
- Provide specific references when quoting or paraphrasing from sources
- When updating/deleting memories, confirm the action to the user
`;

  if (sources.length > 0) {
    prompt += `\nAvailable sources in this chat:\n`;
    sources.forEach((source, idx) => {
      prompt += `${idx + 1}. ${source.title} (${source.sourceType}) - Collection: ${source.collectionName}\n`;
    });
  } else {
    prompt += `\nNote: No sources are currently attached to this chat session. Inform the user they need to attach sources first.`;
  }

  return prompt;
};

/**
 * Run OpenAI Agent with RAG and memory capabilities
 * @param {Object} params - Agent parameters
 * @param {string} params.userMessage - User's message content
 * @param {Array} params.sources - Array of source objects with collectionName
 * @param {Object} params.chatSession - Chat session for memory scoping
 * @returns {Promise<ReadableStream>} Streaming response from the agent
 * @note Conversation history is managed via memory tools - agent retrieves relevant context on-demand
 */
export const runAgentWithRAG = async ({ 
  userMessage, 
  sources = [], 
  chatSession,
}) => {
  try {
    if (!userMessage || typeof userMessage !== "string" || userMessage.trim() === "") {
      throw new Error("User message is required");
    }

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt({ sources });

    // Initialize OpenAI Agent with RAG and memory tools
    const agent = new Agent({
      name: "research-assistant",
      model: config.OPENAI_LLM_MODEL || "gpt-4o",
      instructions: systemPrompt,
      tools: [
        vectorSearchTool, 
        graphSearchTool, 
        searchMemoryTool, 
        saveMemoryTool, 
        updateMemoryTool, 
        deleteMemoryTool
      ],
    });

    // Create runner for agent execution
    const runner = new Runner();

    // Run agent with streaming enabled
    // Note: Only passing current user message - agent uses memory tools to retrieve relevant history
    const stream = await runner.run(
      agent,
      userMessage,
      {
        stream: true,
        context: { chatSession, sources },
      }
    );

    // Convert agent stream to text stream compatible with Express
    const textStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Extract text content from agent response chunks
            if (chunk.type === "content_part.delta" && chunk.delta?.text) {
              controller.enqueue(chunk.delta.text);
            } else if (chunk.type === "tool_call.delta") {
              // Log tool calls for debugging
              console.log(`Tool called:`, chunk);
            } else if (chunk.type === "error") {
              console.error("Agent error:", chunk.error);
              controller.error(new Error(chunk.error));
              return;
            }
          }
          controller.close();
        } catch (error) {
          console.error("Stream processing error:", error);
          controller.error(error);
        }
      },
    });

    return textStream;
  } catch (error) {
    console.error("Agent runner error:", error);
    throw new Error(`Failed to run agent with RAG: ${error.message}`);
  }
};
