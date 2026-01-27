import { ChatOpenAI } from "@langchain/openai";
import { LLMGraphTransformer } from "@langchain/community/experimental/graph_transformers/llm";
import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import pLimit from "p-limit";
import { ApiError } from "../../utils/api-error.js";
import config from "../../config/config.js";

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
export const buildPDFGraph = async ({
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

    // Step 4: Create Source node once
    const sourceQuery = `
      MERGE (s:Source {id: $sourceId})
      SET s.sourceType = "pdf"
    `;
    await neo4jGraph.query(sourceQuery, { sourceId: sourceId.toString() });

    // Step 5: Setup concurrency limiter
    const limit = pLimit(concurrency);

    // Step 6: Initialize counters
    let totalNodes = 0;
    let totalRelationships = 0;

    // Step 7: Process chunks concurrently
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
              // Step 8: Persist to Neo4j using MERGE
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

    // Step 10: Return result
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
    // Step 9: Close Neo4j connection
    if (neo4jGraph) {
      await neo4jGraph.close();
    }
  }
};

/**
 * Index GitHub repository to Neo4j graph database
 * Create Source and File nodes, extract entities and relationships using LLM
 * @param {Object} params - Indexing parameters
 * @param {string} params.sourceId - Source ID to scope all nodes
 * @param {Array} params.docs - Array of LangChain Documents (split chunks from GitHub files)
 * @param {string} params.modelName - Optional LLM model name
 * @param {number} params.concurrency - Optional concurrency limit
 * @returns {Promise<Object>} Response with source, files, nodes and relationships count
 */
export const buildGithubRepoGraph = async ({
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

    // Step 3: Initialize LLM + Graph Transformer with GitHub-specific configuration
    const llm = new ChatOpenAI({
      modelName,
      temperature: 0,
      openAIApiKey: config.OPENAI_API_KEY,
    });

    const graphTransformer = new LLMGraphTransformer({
      llm,
      allowedNodes: ["Class", "Function", "Module", "Component", "Service", "Concept"],
      allowedRelationships: ["USES", "DEPENDS_ON", "IMPLEMENTS", "PART_OF", "RELATED_TO"],
      strictMode: false,
      nodeProperties: false,
      relationshipProperties: false,
    });

    // Step 4: Create Source node once
    const sourceQuery = `
      MERGE (s:Source {id: $sourceId})
      SET s.sourceType = "github_repo"
    `;
    await neo4jGraph.query(sourceQuery, { sourceId: sourceId.toString() });

    // Step 5: Setup concurrency limiter
    const limit = pLimit(concurrency);

    // Step 6: Initialize counters and tracking
    let totalNodes = 0;
    let totalRelationships = 0;
    const filesProcessed = new Set();

    // Step 7: Process chunks concurrently
    const processingTasks = docs.map((doc) =>
      limit(async () => {
        try {
          // Extract file path and language from document metadata
          const filePath = doc.metadata?.path || "unknown";
          const language = doc.metadata?.language || "unknown";
          const fileType = doc.metadata?.fileType || "unknown";

          // Create or MERGE File node
          if (!filesProcessed.has(filePath)) {
            const fileQuery = `
              MERGE (f:File {path: $path, sourceId: $sourceId})
              SET f.language = $language, f.fileType = $fileType
              RETURN f
            `;
            await neo4jGraph.query(fileQuery, {
              path: filePath,
              sourceId: sourceId.toString(),
              language,
              fileType,
            });

            // Create relationship (Source)-[:HAS_FILE]->(File)
            const sourceFileRelQuery = `
              MATCH (s:Source {id: $sourceId})
              MATCH (f:File {path: $path, sourceId: $sourceId})
              MERGE (s)-[:HAS_FILE]->(f)
            `;
            await neo4jGraph.query(sourceFileRelQuery, {
              sourceId: sourceId.toString(),
              path: filePath,
            });

            filesProcessed.add(filePath);
          }

          // Extract graph documents from chunk text
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

            // Normalize relationships: ensure type exists and nodes are valid
            const normalizedRelationships = graphDoc.relationships.filter(
              (rel) => rel.type && rel.source?.id && rel.target?.id
            );

            if (normalizedNodes.length > 0) {
              // Step 8: Persist entities to Neo4j
              for (const node of normalizedNodes) {
                const entityQuery = `
                  MERGE (e:Entity {name: $name, sourceId: $sourceId})
                  SET e.type = $type
                `;
                await neo4jGraph.query(entityQuery, {
                  name: node.properties.name,
                  sourceId: node.properties.sourceId,
                  type: node.properties.type,
                });

                // Create relationship (File)-[:MENTIONS]->(Entity)
                const mentionQuery = `
                  MATCH (f:File {path: $path, sourceId: $sourceId})
                  MATCH (e:Entity {name: $entityName, sourceId: $sourceId})
                  MERGE (f)-[:MENTIONS]->(e)
                `;
                await neo4jGraph.query(mentionQuery, {
                  path: filePath,
                  sourceId: sourceId.toString(),
                  entityName: node.properties.name,
                });

                totalNodes++;
              }

              // Create semantic relationships between entities
              for (const rel of normalizedRelationships) {
                const relQuery = `
                  MATCH (a:Entity {name: $fromName, sourceId: $sourceId})
                  MATCH (b:Entity {name: $toName, sourceId: $sourceId})
                  MERGE (a)-[r:${rel.type.toUpperCase().replace(/\s+/g, "_")}]->(b)
                `;
                await neo4jGraph.query(relQuery, {
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
      filesCount: filesProcessed.size,
      nodesAdded: totalNodes,
      relationshipsAdded: totalRelationships,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      500,
      `Failed to index GitHub repository to Neo4j: ${error.message}`
    );
  } finally {
    // Step 10: Close Neo4j connection
    if (neo4jGraph) {
      await neo4jGraph.close();
    }
  }
};

/**
 * Delete all Neo4j entities and relationships for a specific source
 * @param {string} sourceId - Source ID to delete from Neo4j
 * @returns {Promise<Object>} Response with deletion status
 */
export const deleteGraphBySourceId = async (sourceId) => {
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
  buildPDFGraph,
  buildGithubRepoGraph,
  deleteGraphBySourceId,
};