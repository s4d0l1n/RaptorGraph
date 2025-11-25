/**
 * Data processor for converting CSV data into graph nodes and edges
 * Handles stub node creation, merging, and link resolution
 */

import { parseMultiValue } from './multiValueParser'
import type { CSVFile, GraphNode, GraphEdge } from '@/types'

/**
 * Process a CSV file and generate nodes and edges
 */
export function processCSVFile(file: CSVFile): {
  nodes: GraphNode[]
  edges: GraphEdge[]
} {
  const edges: GraphEdge[] = []
  const nodeMap = new Map<string, GraphNode>()

  // Find node_id columns
  const nodeIdMappings = file.mapping.filter((m) => m.role === 'node_id')
  if (nodeIdMappings.length === 0) {
    throw new Error('No node_id column found in mapping')
  }

  // Process each row
  for (const row of file.parsed.rows) {
    // Generate node IDs from all node_id columns
    const nodeIds = nodeIdMappings
      .map((m) => {
        const value = row[m.columnName]
        return value ? String(value).trim() : null
      })
      .filter((id): id is string => id !== null && id !== '')

    if (nodeIds.length === 0) continue

    // Use first node_id as primary
    const primaryId = nodeIds[0]

    // Create or get existing node
    let node = nodeMap.get(primaryId)
    if (!node) {
      node = {
        id: primaryId,
        label: primaryId,
        attributes: {},
        tags: [],
        sourceFiles: [file.name],
        isStub: false,
      }
      nodeMap.set(primaryId, node)
    } else {
      // Add source file if not already present
      if (!node.sourceFiles.includes(file.name)) {
        node.sourceFiles.push(file.name)
      }
      // Promote stub node
      if (node.isStub) {
        node.isStub = false
      }
    }

    // Process attribute mappings
    for (const mapping of file.mapping) {
      if (mapping.role === 'attribute' && mapping.attributeName) {
        const value = row[mapping.columnName]
        if (value !== undefined && value !== null && value !== '') {
          // Parse multi-value
          const parsedValues = parseMultiValue(String(value))
          node.attributes[mapping.attributeName] =
            parsedValues.length === 1 ? parsedValues[0] : parsedValues
        }
      }

      if (mapping.role === 'timestamp' && mapping.attributeName) {
        const value = row[mapping.columnName]
        if (value) {
          // Store as attribute
          node.attributes[mapping.attributeName] = String(value)

          // Try to parse as timestamp
          const timestamp = parseTimestamp(String(value))
          if (timestamp) {
            node.timestamp = timestamp
          }
        }
      }
    }
  }

  // Process link mappings (second pass after all nodes are created)
  for (const row of file.parsed.rows) {
    const nodeIdMappings = file.mapping.filter((m) => m.role === 'node_id')
    const nodeIds = nodeIdMappings
      .map((m) => row[m.columnName])
      .filter((id): id is string => id !== null && id !== undefined && id !== '')

    if (nodeIds.length === 0) continue
    const sourceNodeId = nodeIds[0]

    for (const mapping of file.mapping) {
      if (mapping.role === 'link_to' && mapping.linkTargetAttribute) {
        const value = row[mapping.columnName]
        if (!value) continue

        // Parse multi-value for links
        const linkValues = parseMultiValue(String(value))

        for (const linkValue of linkValues) {
          // Find target nodes with matching attribute
          const targetNodes = Array.from(nodeMap.values()).filter((n) => {
            const attrValue = n.attributes[mapping.linkTargetAttribute!]
            if (Array.isArray(attrValue)) {
              return attrValue.some(
                (v) => v.toLowerCase() === linkValue.toLowerCase()
              )
            }
            return (
              attrValue &&
              String(attrValue).toLowerCase() === linkValue.toLowerCase()
            )
          })

          if (targetNodes.length > 0) {
            // Create edges to all matching nodes
            for (const targetNode of targetNodes) {
              const edgeId = `${sourceNodeId}->${targetNode.id}-${mapping.columnName}`
              if (!edges.some((e) => e.id === edgeId)) {
                edges.push({
                  id: edgeId,
                  source: sourceNodeId,
                  target: targetNode.id,
                  sourceAttribute: mapping.columnName,
                  targetAttribute: mapping.linkTargetAttribute,
                })
              }
            }
          } else {
            // Create stub node
            const stubId = `stub:${linkValue}`
            if (!nodeMap.has(stubId)) {
              const stubNode: GraphNode = {
                id: stubId,
                label: linkValue,
                attributes: {
                  [mapping.linkTargetAttribute]: linkValue,
                },
                tags: ['stub'],
                sourceFiles: [],
                isStub: true,
              }
              nodeMap.set(stubId, stubNode)
            }

            // Create edge to stub
            const edgeId = `${sourceNodeId}->${stubId}-${mapping.columnName}`
            if (!edges.some((e) => e.id === edgeId)) {
              edges.push({
                id: edgeId,
                source: sourceNodeId,
                target: stubId,
                sourceAttribute: mapping.columnName,
                targetAttribute: mapping.linkTargetAttribute,
              })
            }
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  }
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(value: string): number | undefined {
  // Try Unix timestamp (seconds or milliseconds)
  const num = Number(value)
  if (!isNaN(num)) {
    // If less than year 3000 in seconds, it's probably seconds
    if (num < 32503680000) {
      return num * 1000 // Convert to milliseconds
    }
    return num // Already milliseconds
  }

  // Try parsing as date string
  const date = new Date(value)
  if (!isNaN(date.getTime())) {
    return date.getTime()
  }

  return undefined
}

/**
 * Merge nodes with the same ID
 * Used when processing multiple CSV files
 */
export function mergeGraphNodes(
  existing: GraphNode[],
  newNodes: GraphNode[]
): GraphNode[] {
  const nodeMap = new Map<string, GraphNode>()

  // Add existing nodes
  for (const node of existing) {
    nodeMap.set(node.id, { ...node })
  }

  // Merge new nodes
  for (const newNode of newNodes) {
    const existing = nodeMap.get(newNode.id)
    if (existing) {
      // Merge attributes
      const mergedAttributes = { ...existing.attributes }
      for (const [key, value] of Object.entries(newNode.attributes)) {
        if (mergedAttributes[key]) {
          // Merge values
          const existingValue = mergedAttributes[key]
          const existingArray = Array.isArray(existingValue)
            ? existingValue
            : [existingValue]
          const newArray = Array.isArray(value) ? value : [value]
          const combined = Array.from(
            new Set([...existingArray.map(String), ...newArray.map(String)])
          )
          mergedAttributes[key] = combined.length === 1 ? combined[0] : combined
        } else {
          mergedAttributes[key] = value
        }
      }

      // Merge tags
      const mergedTags = Array.from(new Set([...existing.tags, ...newNode.tags]))

      // Merge source files
      const mergedSources = Array.from(
        new Set([...existing.sourceFiles, ...newNode.sourceFiles])
      )

      // Promote stub if new node is not stub
      const isStub = existing.isStub && newNode.isStub

      nodeMap.set(newNode.id, {
        ...existing,
        attributes: mergedAttributes,
        tags: mergedTags,
        sourceFiles: mergedSources,
        isStub,
        // Keep timestamp from non-stub or newer
        timestamp: !isStub && newNode.timestamp ? newNode.timestamp : existing.timestamp,
      })
    } else {
      nodeMap.set(newNode.id, { ...newNode })
    }
  }

  return Array.from(nodeMap.values())
}

/**
 * Merge edges, removing duplicates
 */
export function mergeGraphEdges(
  existing: GraphEdge[],
  newEdges: GraphEdge[]
): GraphEdge[] {
  const edgeMap = new Map<string, GraphEdge>()

  // Add existing edges
  for (const edge of existing) {
    edgeMap.set(edge.id, edge)
  }

  // Add new edges (avoid duplicates)
  for (const edge of newEdges) {
    if (!edgeMap.has(edge.id)) {
      edgeMap.set(edge.id, edge)
    }
  }

  return Array.from(edgeMap.values())
}
