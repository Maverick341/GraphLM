import neo4j from "neo4j-driver";
import config from "#config/config.js";

const driver = neo4j.driver(
  config.NEO4J_URI,
  neo4j.auth.basic(config.NEO4J_USERNAME, config.NEO4J_PASSWORD),
);

/**
 * CHAT-ONLY GRAPH RETRIEVER
 * Purpose:
 *  - Ground LLM responses using graph facts
 *  - Return human-readable, deduplicated relationships
 *  - Optimized for RAG, NOT visualization
 */
export const fetchGraphFacts = async ({
  query,
  sourceIds,
  anchorLimit = 10,
  hopDepth = 2,
}) => {
  // Validate hopDepth to prevent Cypher injection
  // Note: Variable-length patterns like [*1..n] cannot be parameterized in Cypher
  const safeHopDepth = Math.max(1, Math.min(5, Math.floor(Number(hopDepth))));
  
  if (isNaN(safeHopDepth) || safeHopDepth !== Number(hopDepth)) {
    throw new Error(`Invalid hopDepth: must be an integer between 1 and 5`);
  }

  const session = driver.session({ defaultAccessMode: neo4j.session.READ });

  try {
    const cypher = `
      // 1. Anchor entity selection
      MATCH (anchor:Entity)
      WHERE anchor.sourceId IN $sourceIds
        AND (
          toLower(anchor.name) CONTAINS toLower($query)
          OR toLower(anchor.type) CONTAINS toLower($query)
        )
      WITH anchor
      ORDER BY
        CASE
          WHEN toLower(anchor.name) = toLower($query) THEN 0
          WHEN toLower(anchor.name) STARTS WITH toLower($query) THEN 1
          ELSE 2
        END,
        anchor.name ASC
      LIMIT $anchorLimit

      // 2. Controlled neighborhood expansion
      // Note: Variable-length pattern depth is validated above (cannot be parameterized)
      OPTIONAL MATCH path = (anchor)-[rels*1..${safeHopDepth}]-(neighbor:Entity)
      WHERE ALL(n IN nodes(path) WHERE n.sourceId IN $sourceIds)

      // 3. File grounding (optional but useful for citations)
      OPTIONAL MATCH (f:File)-[:MENTIONS]->(anchor)
      WHERE f.sourceId IN $sourceIds

      RETURN
        anchor,
        nodes(path) AS pathNodes,
        relationships(path) AS pathRels,
        f.path AS filePath,
        CASE
          WHEN toLower(anchor.name) = toLower($query) THEN 3
          WHEN toLower(anchor.name) STARTS WITH toLower($query) THEN 2
          ELSE 1
        END AS matchScore
    `;

    const result = await session.run(cypher, {
      query,
      sourceIds: sourceIds.map(String),
      anchorLimit: neo4j.int(anchorLimit),
    });

    const facts = [];
    const seenRelations = new Set();
    const anchors = new Map();

    // Calculate query match for relevance scoring
    const lowerQuery = query.toLowerCase();

    // First pass: Collect unique anchors with their metadata
    for (const record of result.records) {
      const anchor = record.get("anchor");
      const filePath = record.get("filePath") || "unknown";
      const matchScore = record.get("matchScore");
      const anchorId = anchor.identity.toString();

      if (!anchors.has(anchorId)) {
        anchors.set(anchorId, {
          anchor,
          filePath,
          matchScore,
        });
      }
    }

    // Add anchor entity facts with relevance scoring
    for (const [anchorId, { anchor, filePath, matchScore }] of anchors) {
      facts.push({
        kind: "entity",
        entity: {
          name: anchor.properties.name,
          type: anchor.properties.type,
          definedIn: filePath,
        },
        relevance: matchScore,
      });
    }

    // Second pass: Process relationships with hop-based relevance
    for (const record of result.records) {
      const anchor = record.get("anchor");
      const nodes = record.get("pathNodes") || [];
      const rels = record.get("pathRels") || [];
      const matchScore = record.get("matchScore");

      if (nodes.length === 0 || rels.length === 0) continue;

      const nodeMap = new Map(nodes.map((n) => [n.identity.toString(), n]));
      const anchorId = anchor.identity.toString();

      for (let i = 0; i < rels.length; i++) {
        const rel = rels[i];
        const relId = rel.identity.toString();
        if (seenRelations.has(relId)) continue;

        const startNode = nodeMap.get(rel.start.toString());
        const endNode = nodeMap.get(rel.end.toString());

        if (!startNode || !endNode) continue;

        // Calculate relevance: higher for closer hops and better anchor matches
        const hopDistance = i + 1;
        const HOP_DISTANCE_PENALTY = 0.3; // Penalizes distant relationships: each hop reduces relevance by 30%, ensuring closer graph neighbors are prioritized for RAG context
        const relevance = matchScore - (hopDistance * HOP_DISTANCE_PENALTY);

        const MIN_RELEVANCE_SCORE = 0.1; // Floor ensures even distant relationships are retrievable for RAG context, preventing complete filtering of potentially useful graph neighbors

          facts.push({
            kind: "relation",
            subject: {
              name: startNode.properties.name,
              type: startNode.properties.type,
            },
            predicate: rel.type,
            object: {
              name: endNode.properties.name,
              type: endNode.properties.type,
            },
            relevance: Math.max(MIN_RELEVANCE_SCORE, relevance),
          });

        seenRelations.add(relId);
      }
    }

    // Sort facts by relevance (highest first) for LLM context prioritization
    facts.sort((a, b) => b.relevance - a.relevance);

    return facts;
  } finally {
    await session.close();
  }
};
