/**
 * Data Processor
 * Converts CSV data + mappings into nodes and edges
 * Handles stub node creation for Link→Attribute mappings
 */

import type {
  NodeData,
  EdgeData,
  ColumnMapping,
  ParsedCSV,
} from '../types'
import { parseAttributeValue, parseMultiValue } from './multiValueParser'

/**
 * Process CSV data with column mappings to generate nodes and edges
 */
export interface ProcessResult {
  nodes: NodeData[]
  edges: EdgeData[]
  stubsCreated: number
}

export function processCSVData(
  parsed: ParsedCSV,
  mappings: ColumnMapping[],
  sourceFileName: string
): ProcessResult {
  const nodes: NodeData[] = []
  const edges: EdgeData[] = []
  const stubNodes = new Map<string, NodeData>() // Track stub nodes by ID

  // Find the Node ID column
  const nodeIdMapping = mappings.find((m) => m.role === 'node_id')
  if (!nodeIdMapping) {
    throw new Error('No Node ID column specified')
  }

  // Find the label column (optional)
  const labelMapping = mappings.find((m) => m.role === 'label')

  // Process each row
  for (const row of parsed.rows) {
    // Get node ID
    const nodeId = row[nodeIdMapping.columnName]
    if (!nodeId || nodeId.trim() === '') {
      continue // Skip rows without ID
    }

    // Create node
    const node: NodeData = {
      id: nodeId.trim(),
      label: labelMapping ? row[labelMapping.columnName] : nodeId.trim(),
      attributes: {},
      tags: [],
      isStub: false,
      _sources: [sourceFileName],
    }

    // Process each mapping
    for (const mapping of mappings) {
      const cellValue = row[mapping.columnName]

      switch (mapping.role) {
        case 'node_id':
        case 'label':
          // Already handled
          break

        case 'attribute':
          if (mapping.attributeName && cellValue) {
            node.attributes[mapping.attributeName] = parseAttributeValue(cellValue)
          }
          break

        case 'tag':
          if (cellValue) {
            const tags = parseMultiValue(cellValue)
            node.tags.push(...tags)
          }
          break

        case 'link_to_attribute':
          // Process link mappings
          if (
            mapping.linkSourceAttr &&
            mapping.linkTargetAttr &&
            cellValue
          ) {
            const sourceValues = parseMultiValue(cellValue)

            // Also store the source attribute on the node
            node.attributes[mapping.linkSourceAttr] = parseAttributeValue(cellValue)

            // Create edges for each value
            for (const value of sourceValues) {
              if (value.trim()) {
                edges.push({
                  source: node.id,
                  target: value.trim(), // Target will be resolved or create stub
                  sourceAttr: mapping.linkSourceAttr,
                  targetAttr: mapping.linkTargetAttr,
                })
              }
            }
          }
          break

        case 'ignore':
          // Skip
          break
      }
    }

    // Deduplicate tags
    node.tags = Array.from(new Set(node.tags))

    nodes.push(node)
  }

  // Now process edges and create stub nodes as needed
  const nodeMap = new Map<string, NodeData>()
  nodes.forEach((node) => nodeMap.set(node.id, node))

  const processedEdges: EdgeData[] = []

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)
    if (!sourceNode) continue

    // Find target node(s) by matching attribute values
    let targetFound = false

    // Check if target is a direct node ID
    if (nodeMap.has(edge.target)) {
      targetFound = true
      processedEdges.push({
        ...edge,
        id: `${edge.source}-${edge.target}-${edge.targetAttr}`,
      })
    } else if (edge.targetAttr) {
      // Search for nodes with matching target attribute value
      const matchingNodes = Array.from(nodeMap.values()).filter((node) => {
        const attrValue = node.attributes[edge.targetAttr!]
        if (!attrValue) return false

        if (Array.isArray(attrValue)) {
          return attrValue.some(
            (v) => v.toLowerCase() === edge.target.toLowerCase()
          )
        }
        return attrValue.toLowerCase() === edge.target.toLowerCase()
      })

      if (matchingNodes.length > 0) {
        targetFound = true
        // Create edge to each matching node
        for (const targetNode of matchingNodes) {
          processedEdges.push({
            ...edge,
            target: targetNode.id,
            id: `${edge.source}-${targetNode.id}-${edge.targetAttr}`,
          })
        }
      }
    }

    // If no target found, create a stub node
    if (!targetFound) {
      const stubId = edge.target

      // Check if stub already exists
      if (!stubNodes.has(stubId) && !nodeMap.has(stubId)) {
        const stubNode: NodeData = {
          id: stubId,
          label: stubId,
          attributes: edge.targetAttr
            ? { [edge.targetAttr]: stubId }
            : {},
          tags: ['_stub'],
          isStub: true,
          _sources: [sourceFileName],
        }
        stubNodes.set(stubId, stubNode)
        nodeMap.set(stubId, stubNode)
      }

      // Create edge to stub
      processedEdges.push({
        ...edge,
        id: `${edge.source}-${stubId}-${edge.targetAttr || 'stub'}`,
      })
    }
  }

  // Add stub nodes to the result
  const allNodes = [...nodes, ...Array.from(stubNodes.values())]

  return {
    nodes: allNodes,
    edges: processedEdges,
    stubsCreated: stubNodes.size,
  }
}

/**
 * Merge new nodes with existing nodes
 * Handles attribute merging and stub promotion
 */
export function mergeNodes(
  existing: NodeData[],
  newNodes: NodeData[]
): NodeData[] {
  const nodeMap = new Map<string, NodeData>()

  // Add existing nodes to map
  existing.forEach((node) => nodeMap.set(node.id, { ...node }))

  // Merge new nodes
  for (const newNode of newNodes) {
    const existingNode = nodeMap.get(newNode.id)

    if (existingNode) {
      // Merge attributes
      const mergedAttributes = { ...existingNode.attributes }

      for (const [key, value] of Object.entries(newNode.attributes)) {
        const existingValue = mergedAttributes[key]

        if (!existingValue) {
          mergedAttributes[key] = value
        } else {
          // Merge arrays
          const existingArray = Array.isArray(existingValue)
            ? existingValue
            : [existingValue]
          const newArray = Array.isArray(value) ? value : [value]

          mergedAttributes[key] = Array.from(
            new Set([...existingArray, ...newArray])
          )
        }
      }

      // Merge tags
      const mergedTags = Array.from(
        new Set([...existingNode.tags, ...newNode.tags])
      )

      // Merge sources
      const mergedSources = Array.from(
        new Set([
          ...(existingNode._sources || []),
          ...(newNode._sources || []),
        ])
      )

      // If existing was a stub and new is not, promote it
      const isStub = existingNode.isStub && newNode.isStub

      nodeMap.set(newNode.id, {
        ...existingNode,
        ...newNode,
        attributes: mergedAttributes,
        tags: mergedTags,
        isStub,
        _sources: mergedSources,
      })
    } else {
      nodeMap.set(newNode.id, newNode)
    }
  }

  return Array.from(nodeMap.values())
}

/**
 * Merge edges, avoiding duplicates
 */
export function mergeEdges(
  existing: EdgeData[],
  newEdges: EdgeData[]
): EdgeData[] {
  const edgeMap = new Map<string, EdgeData>()

  // Add existing edges
  existing.forEach((edge) => {
    const key = `${edge.source}-${edge.target}-${edge.sourceAttr || ''}-${edge.targetAttr || ''}`
    edgeMap.set(key, edge)
  })

  // Add new edges
  newEdges.forEach((edge) => {
    const key = `${edge.source}-${edge.target}-${edge.sourceAttr || ''}-${edge.targetAttr || ''}`
    if (!edgeMap.has(key)) {
      edgeMap.set(key, edge)
    }
  })

  return Array.from(edgeMap.values())
}
