import { Agent, Runner } from "@openai/agents";
import { vectorSearchTool } from "../rag.service.js";
import { graphSearchTool } from "../graph/graphSearchTool.js";
import { searchMemoryTool, saveMemoryTool } from "../memory/memoryTools.js";
import config from "../../../../config/config.js";

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
- You provide accurate, well-sourced answers based on indexed content and memory
- You cite sources when providing information

You have access to two search tools:
1. vector_search – for finding relevant text passages and content-based queries
2. graph_search – for understanding entities, relationships, dependencies, and structure

Guidelines:
- Use vector_search for factual or content-based queries
- Use graph_search when the question involves relationships, architecture, dependencies, or structure
- You may use both tools before answering to get comprehensive information
- Use search_memory to recall past interactions, preferences, or context
- Use save_memory to store important facts, preferences, or context for future conversations
- Be proactive about searching memory when users reference past conversations
- Save key information that should be remembered (preferences, decisions, important facts)
- Be concise but comprehensive in your responses
- If information is not found in sources or memory, clearly state that
- Provide specific references when quoting or paraphrasing from sources
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
 * @param {Array} params.conversationHistory - Previous messages in the conversation
 * @param {Object} params.chatSession - Chat session for memory scoping
 * @returns {Promise<ReadableStream>} Streaming response from the agent
 */
export const runAgentWithRAG = async ({ 
  userMessage, 
  sources = [], 
  conversationHistory = [],
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
      tools: [vectorSearchTool, graphSearchTool, searchMemoryTool, saveMemoryTool],
      toolContext: { chatSession, sources },
    });

    // Prepare messages array with conversation history
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: "user",
        content: userMessage,
      },
    ];

    // Create runner for agent execution
    const runner = new Runner({
      agent,
      apiKey: config.OPENAI_API_KEY,
    });

    // Run agent with streaming enabled
    const stream = await runner.run({
      messages,
      stream: true,
    });

    // Convert agent stream to text stream compatible with Express
    const textStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            // Extract text content from agent response chunks
            if (chunk.type === "text") {
              controller.enqueue(chunk.text);
            } else if (chunk.type === "tool_call") {
              // Log tool calls for debugging
              console.log(`Tool called: ${chunk.name}`, chunk.arguments);
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
