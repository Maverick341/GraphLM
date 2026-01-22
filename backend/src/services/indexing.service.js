import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/text_splitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatOpenAI } from "@langchain/openai";
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm";
import pLimit from "p-limit";
import { ApiError } from "../utils/api-error.js";
import config from "../config/config.js";

/**
 * Load and split PDF document
 * @param {string} documentLocalPath - Path to the PDF file
 * @returns {Promise<Array>} Array of split document chunks
 */
export const loadAndSplitPDF = async (documentLocalPath) => {
  try {
    if (!documentLocalPath) {
      throw new ApiError(400, "Document local path is required");
    }

    // Step 1: Load PDF
    const loader = new PDFLoader(documentLocalPath);
    const docs = await loader.load();

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Failed to load PDF or PDF is empty");
    }

    // Step 2: Split documents
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const splitDocs = await splitter.splitDocuments(docs);

    if (!splitDocs || splitDocs.length === 0) {
      throw new ApiError(400, "Failed to split PDF documents");
    }

    return splitDocs;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Failed to load and split PDF: ${error.message}`);
  }
};

/**
 * Index documents to Qdrant vector database
 * @param {Array} docs - Array of documents to index
 * @param {string} collectionName - Name of the Qdrant collection
 * @param {string} sourceId - Source ID for filtering
 * @param {string} sourceType - Source type (pdf, github_repo)
 * @returns {Promise<Object>} Response with status and collection info
 */
export const indexToQdrant = async (docs, collectionName, sourceId, sourceType) => {
  try {
    if (!collectionName) {
      throw new ApiError(400, "Collection name is required to index to Qdrant");
    }

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Documents array is required and cannot be empty");
    }

    if (!sourceId) {
      throw new ApiError(400, "sourceId is required for Qdrant indexing");
    }

    if (!sourceType) {
      throw new ApiError(400, "sourceType is required for Qdrant indexing");
    }

    // Attach source-level metadata to each document
    const docsWithMetadata = docs.map((doc) => ({
      ...doc,
      metadata: {
        ...doc.metadata,
        sourceId: sourceId.toString(),
        sourceType: sourceType,
      },
    }));

    // Get Qdrant configuration
    const qdrantUrl = config.QDRANT_URL;
    const qdrantApiKey = config.QDRANT_API_KEY;

    // Initialize embeddings
    const embeddings = new OpenAIEmbeddings({
      model: config.OPENAI_EMBEDDING_MODEL,
      openAIApiKey: config.OPENAI_API_KEY,
    });

    // Setup Qdrant client options
    const clientOptions = { url: qdrantUrl };
    if (qdrantApiKey) {
      clientOptions.apiKey = qdrantApiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Index documents to Qdrant with metadata
    const vectorStore = await QdrantVectorStore.fromDocuments(
      docsWithMetadata,
      embeddings,
      {
        client,
        collectionName,
      }
    );

    return {
      status: "ok",
      collection: collectionName,
      added: docs.length,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index documents to Qdrant: ${error.message}`
    );
  }
};


/**
 * Index documents to Neo4j graph database
 * Extract entities and relationships using LLM and store them in Neo4j
 * @param {Object} params - Indexing parameters
 * @param {string} params.sourceId - Source ID to scope all nodes
 * @param {Array} params.docs - Array of LangChain Documents (split docs)
 * @param {string} params.modelName - Optional LLM model name
 * @param {number} params.concurrency - Optional concurrency limit
 * @returns {Promise<Object>} Response with nodes and relationships count
 */
export const indexToNeo4j = async ({
  sourceId,
  docs,
  modelName = config.OPENAI_LLM_MODEL,
  concurrency = 3,
}) => {
  let neo4jGraph;

  try {
    // Step 1: Validate inputs
    if (!sourceId) {
      throw new ApiError(400, "sourceId is required for Neo4j indexing");
    }

    if (!docs || docs.length === 0) {
      throw new ApiError(400, "Documents array is required and cannot be empty");
    }

    // Step 2: Initialize Neo4j connection
    neo4jGraph = await Neo4jGraph.initialize({
      url: config.NEO4J_URI,
      username: config.NEO4J_USERNAME,
      password: config.NEO4J_PASSWORD,
    });

    // Step 3: Initialize LLM + Graph Transformer
    const llm = new ChatOpenAI({
      modelName,
      temperature: 0,
      openAIApiKey: config.OPENAI_API_KEY,
    });

    const graphTransformer = new LLMGraphTransformer({
      llm,
      allowedNodes: [],
      allowedRelationships: [],
      strictMode: false,
      nodeProperties: false,
      relationshipProperties: false,
    });

    // Step 4: Setup concurrency limiter
    const limit = pLimit(concurrency);

    // Step 5: Initialize counters
    let totalNodes = 0;
    let totalRelationships = 0;

    // Step 6: Process chunks concurrently
    const processingTasks = docs.map((doc) =>
      limit(async () => {
        try {
          // Extract graph documents from text
          const graphDocs = await graphTransformer.convertToGraphDocuments([doc]);

          for (const graphDoc of graphDocs) {
            // Normalize nodes: add sourceId, ensure name and type exist
            const normalizedNodes = graphDoc.nodes
              .filter((node) => node.id && node.type)
              .map((node) => ({
                ...node,
                properties: {
                  ...node.properties,
                  sourceId: sourceId.toString(),
                  name: node.id,
                  type: node.type,
                },
              }));

            // Normalize relationships: ensure type exists
            const normalizedRelationships = graphDoc.relationships.filter(
              (rel) => rel.type && rel.source?.id && rel.target?.id
            );

            if (normalizedNodes.length > 0) {
              // Step 7: Persist to Neo4j using MERGE
              // Create nodes
              for (const node of normalizedNodes) {
                const query = `
                  MERGE (e:Entity {
                    name: $name,
                    sourceId: $sourceId
                  })
                  SET e.type = $type
                `;
                await neo4jGraph.query(query, {
                  name: node.properties.name,
                  sourceId: node.properties.sourceId,
                  type: node.properties.type,
                });
                totalNodes++;
              }

              // Create relationships
              for (const rel of normalizedRelationships) {
                const query = `
                  MATCH (a:Entity {name: $fromName, sourceId: $sourceId})
                  MATCH (b:Entity {name: $toName, sourceId: $sourceId})
                  MERGE (a)-[r:${rel.type.toUpperCase().replace(/\s+/g, "_")}]->(b)
                `;
                await neo4jGraph.query(query, {
                  fromName: rel.source.id,
                  toName: rel.target.id,
                  sourceId: sourceId.toString(),
                });
                totalRelationships++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing document chunk:`, error);
          // Continue processing other chunks
        }
      })
    );

    // Wait for all processing to complete
    await Promise.all(processingTasks);

    // Step 9: Return result
    return {
      status: "ok",
      nodesAdded: totalNodes,
      relationshipsAdded: totalRelationships,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index documents to Neo4j: ${error.message}`
    );
  } finally {
    // Step 8: Close Neo4j connection
    if (neo4jGraph) {
      await neo4jGraph.close();
    }
  }
};


/**
 * Complete indexing pipeline: Load, Split, Index to Qdrant and Neo4j
 * @param {string} documentLocalPath - Path to the PDF file
 * @param {string} collectionName - Name of the Qdrant collection
 * @param {string} sourceId - Source ID for Neo4j scoping and Qdrant filtering
 * @param {string} sourceType - Source type (pdf, github_repo)
 * @returns {Promise<Object>} Response with indexing status for both databases
 */
export const indexPDF = async (documentLocalPath, collectionName, sourceId, sourceType = "pdf") => {
  try {
    // Step 1: Load and split PDF
    const splitDocs = await loadAndSplitPDF(documentLocalPath);

    // Step 2: Index to Qdrant (vector embeddings with metadata)
    const vectorResult = await indexToQdrant(splitDocs, collectionName, sourceId, sourceType);

    return {
      status: "ok",
      vector: {
        collection: vectorResult.collection,
        chunksIndexed: vectorResult.added,
      },
      splitDocs, // Return splitDocs for later Neo4j indexing
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index PDF: ${error.message}`
    );
  }
};

/**
 * Delete a collection from Qdrant
 * @param {string} collectionName - Name of the collection to delete
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteQdrantCollection = async (collectionName) => {
  try {
    if (!collectionName) {
      throw new ApiError(400, "Collection name is required to delete from Qdrant");
    }

    // Get Qdrant configuration
    const qdrantUrl = config.QDRANT_URL;
    const qdrantApiKey = config.QDRANT_API_KEY;

    // Setup Qdrant client options
    const clientOptions = { url: qdrantUrl };
    if (qdrantApiKey) {
      clientOptions.apiKey = qdrantApiKey;
    }

    const client = new QdrantClient(clientOptions);

    // Delete the collection
    await client.deleteCollection(collectionName);

    return {
      status: "ok",
      collection: collectionName,
      message: "Collection deleted successfully",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to delete Qdrant collection: ${error.message}`
    );
  }
};

/**
 * Delete all Neo4j entities and relationships for a specific source
 * @param {string} sourceId - Source ID to delete from Neo4j
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteNeo4jBySourceId = async (sourceId) => {
  let neo4jGraph;

  try {
    if (!sourceId) {
      throw new ApiError(400, "sourceId is required to delete from Neo4j");
    }

    // Initialize Neo4j connection
    neo4jGraph = await Neo4jGraph.initialize({
      url: config.NEO4J_URI,
      username: config.NEO4J_USERNAME,
      password: config.NEO4J_PASSWORD,
    });

    // Delete all entities (and their relationships) for this source
    const query = `
      MATCH (n:Entity { sourceId: $sourceId })
      DETACH DELETE n
    `;

    const result = await neo4jGraph.query(query, {
      sourceId: sourceId.toString(),
    });

    return {
      status: "ok",
      sourceId: sourceId.toString(),
      message: "Neo4j entities deleted successfully",
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to delete Neo4j entities: ${error.message}`
    );
  } finally {
    if (neo4jGraph) {
      await neo4jGraph.close();
    }
  }
};



export default {
  loadAndSplitPDF,
  indexToQdrant,
  indexPDF,
  deleteQdrantCollection,
  indexToNeo4j,
  deleteNeo4jBySourceId,
};
