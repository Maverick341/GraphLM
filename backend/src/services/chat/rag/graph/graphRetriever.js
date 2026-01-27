import neo4j from "neo4j-driver";
import config from "../../../../config/config.js";

/**
 * Retrieve entities and relationships from Neo4j for RAG
 * @param {Object} params - Retrieval parameters
 * @param {string} params.query - Search query for entity names or types
 * @param {Array<string>} params.sourceIds - Array of source IDs to scope the search
 * @param {number} params.limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of entity-relationship objects
 */
export const retrieveFromGraph = async ({
  query,
  sourceIds,
  limit = 25,
}) => {
  if (!query || typeof query !== "string" || query.trim() === "") {
    throw new Error("Query is required and must be a non-empty string");
  }

  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    throw new Error("SourceIds array is required for graph retrieval");
  }

  const driver = neo4j.driver(
    config.NEO4J_URI,
    neo4j.auth.basic(
      config.NEO4J_USERNAME,
      config.NEO4J_PASSWORD
    )
  );

  const session = driver.session();

  try {
    const cypher = `
      MATCH (e:Entity)
      WHERE e.sourceId IN $sourceIds
        AND (
          toLower(e.name) CONTAINS toLower($query)
          OR toLower(e.type) CONTAINS toLower($query)
        )
      OPTIONAL MATCH (e)-[r]->(related:Entity)
      WHERE related.sourceId IN $sourceIds
      RETURN e, r, related
      LIMIT $limit
    `;

    const result = await session.run(cypher, {
      query,
      sourceIds: sourceIds.map(String),
      limit: neo4j.int(limit),
    });

    return result.records.map((record) => {
      const e = record.get("e");
      const r = record.get("r");
      const related = record.get("related");

      return {
        entity: {
          name: e.properties.name,
          type: e.properties.type,
        },
        relationship: r
          ? { type: r.type }
          : null,
        relatedEntity: related
          ? {
              name: related.properties.name,
              type: related.properties.type,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("Graph retrieval error:", error);
    throw new Error(`Failed to retrieve from Neo4j graph: ${error.message}`);
  } finally {
    await session.close();
    await driver.close();
  }
};