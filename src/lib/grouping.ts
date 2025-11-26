import type { GraphNode, MetaNode, GroupingConfig, CombinationLayer } from '@/types'

/**
 * Grouping utility functions
 * Creates meta-nodes from nodes based on attribute values
 * Supports nested combinations with multiple layers
 */

/**
 * Generate meta-nodes from nodes based on grouping configuration
 * Supports both legacy single-layer and new multi-layer combinations
 */
export function generateMetaNodes(
  nodes: GraphNode[],
  config: GroupingConfig
): MetaNode[] {
  if (!config.enabled) {
    return []
  }

  // Support legacy single-layer configuration
  if (config.groupByAttribute && !config.layers) {
    return generateSingleLayerMetaNodes(nodes, config.groupByAttribute, config.autoCollapse, 0)
  }

  // Multi-layer combinations
  if (config.layers && config.layers.length > 0) {
    return generateNestedMetaNodes(nodes, config.layers)
  }

  return []
}

/**
 * Generate single-layer meta-nodes (legacy support)
 */
function generateSingleLayerMetaNodes(
  nodes: GraphNode[],
  groupByAttr: string,
  autoCollapse: boolean,
  layer: number
): MetaNode[] {
  // Group nodes by attribute value
  const groups = new Map<string, GraphNode[]>()

  nodes.forEach((node) => {
    const attrValue = node.attributes[groupByAttr]

    // Handle multi-value attributes (arrays)
    if (Array.isArray(attrValue)) {
      attrValue.forEach((val) => {
        // Skip empty values
        if (val && val !== '') {
          const key = val
          if (!groups.has(key)) {
            groups.set(key, [])
          }
          groups.get(key)!.push(node)
        }
      })
    } else if (attrValue !== undefined && attrValue !== '') {
      const key = attrValue
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(node)
    }
    // Skip nodes without the attribute - don't create "(ungrouped)" combinations
  })

  // Create meta-nodes from groups
  const metaNodes: MetaNode[] = []

  groups.forEach((groupNodes, groupValue) => {
    // Only create meta-node if there's more than 1 node
    if (groupNodes.length > 1) {
      metaNodes.push({
        id: `meta-L${layer}-${groupByAttr}-${groupValue}`,
        label: `${groupValue} (${groupNodes.length})`,
        groupByAttribute: groupByAttr,
        groupValue,
        childNodeIds: groupNodes.map((n) => n.id),
        collapsed: autoCollapse,
        layer,
      })
    }
  })

  return metaNodes
}

/**
 * Generate nested meta-nodes across multiple layers
 * Each layer combines either base nodes or meta-nodes from the previous layer
 */
function generateNestedMetaNodes(
  nodes: GraphNode[],
  layers: CombinationLayer[]
): MetaNode[] {
  // Sort layers by order
  const sortedLayers = [...layers].sort((a, b) => a.order - b.order)

  const allMetaNodes: MetaNode[] = []

  // Layer 0: Combine base nodes
  const layer0 = sortedLayers[0]
  const layer0MetaNodes = generateSingleLayerMetaNodes(
    nodes,
    layer0.attribute,
    layer0.autoCollapse,
    0
  )
  allMetaNodes.push(...layer0MetaNodes)

  // Subsequent layers: Combine meta-nodes from previous layer
  for (let i = 1; i < sortedLayers.length; i++) {
    const currentLayer = sortedLayers[i]
    const previousLayerMetaNodes = allMetaNodes.filter((mn) => mn.layer === i - 1)

    // Group previous layer meta-nodes by attribute
    const groups = new Map<string, MetaNode[]>()

    previousLayerMetaNodes.forEach((metaNode) => {
      // Get attribute value from any child node
      const firstChildId = metaNode.childNodeIds[0]
      const firstChild = nodes.find((n) => n.id === firstChildId)

      if (!firstChild) return

      const attrValue = firstChild.attributes[currentLayer.attribute]

      // Skip meta-nodes where children don't have the attribute
      if (!attrValue || attrValue === '') return

      const key = Array.isArray(attrValue) ? attrValue[0] : attrValue

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(metaNode)
    })

    // Create meta-nodes from grouped meta-nodes
    groups.forEach((groupMetaNodes, groupValue) => {
      if (groupMetaNodes.length > 1) {
        // Collect all child node IDs from all meta-nodes in this group
        const allChildNodeIds = new Set<string>()
        groupMetaNodes.forEach((mn) => {
          mn.childNodeIds.forEach((id) => allChildNodeIds.add(id))
        })

        allMetaNodes.push({
          id: `meta-L${i}-${currentLayer.attribute}-${groupValue}`,
          label: `${groupValue} (${allChildNodeIds.size} nodes)`,
          groupByAttribute: currentLayer.attribute,
          groupValue,
          childNodeIds: Array.from(allChildNodeIds),
          childMetaNodeIds: groupMetaNodes.map((mn) => mn.id),
          collapsed: currentLayer.autoCollapse,
          layer: i,
        })
      }
    })
  }

  return allMetaNodes
}

/**
 * Get visible nodes considering meta-node collapse state
 * Returns nodes that should be visible based on grouping
 * Handles nested meta-nodes - a node is hidden if it's in any collapsed ancestor
 */
export function getVisibleNodesWithGrouping(
  nodes: GraphNode[],
  metaNodes: MetaNode[]
): GraphNode[] {
  if (metaNodes.length === 0) {
    return nodes
  }

  // Build set of hidden node IDs (nodes inside collapsed meta-nodes)
  const hiddenNodeIds = new Set<string>()

  // Check all layers from highest to lowest
  const sortedMetaNodes = [...metaNodes].sort((a, b) => b.layer - a.layer)

  sortedMetaNodes.forEach((metaNode) => {
    if (metaNode.collapsed) {
      metaNode.childNodeIds.forEach((id) => hiddenNodeIds.add(id))
    }
  })

  // Return only visible nodes
  return nodes.filter((node) => !hiddenNodeIds.has(node.id))
}

/**
 * Get visible meta-nodes considering parent collapse state
 * A meta-node is visible if it's not inside a collapsed parent meta-node
 */
export function getVisibleMetaNodes(metaNodes: MetaNode[]): MetaNode[] {
  if (metaNodes.length === 0) {
    return []
  }

  const hiddenMetaNodeIds = new Set<string>()

  // Sort by layer (highest first)
  const sortedMetaNodes = [...metaNodes].sort((a, b) => b.layer - a.layer)

  sortedMetaNodes.forEach((metaNode) => {
    if (metaNode.collapsed && metaNode.childMetaNodeIds) {
      metaNode.childMetaNodeIds.forEach((id) => hiddenMetaNodeIds.add(id))
    }
  })

  return metaNodes.filter((mn) => !hiddenMetaNodeIds.has(mn.id))
}

/**
 * Check if a node is inside a meta-node
 */
export function getNodeMetaNode(
  nodeId: string,
  metaNodes: MetaNode[]
): MetaNode | undefined {
  return metaNodes.find((mn) => mn.childNodeIds.includes(nodeId))
}

/**
 * Get position for meta-node based on child nodes
 * Calculates center position of all child nodes
 */
export function calculateMetaNodePosition(
  metaNode: MetaNode,
  nodePositions: Map<string, { x: number; y: number }>
): { x: number; y: number } | undefined {
  const childPositions = metaNode.childNodeIds
    .map((id) => nodePositions.get(id))
    .filter((pos): pos is { x: number; y: number } => pos !== undefined)

  if (childPositions.length === 0) {
    return undefined
  }

  // Calculate centroid
  const sumX = childPositions.reduce((sum, pos) => sum + pos.x, 0)
  const sumY = childPositions.reduce((sum, pos) => sum + pos.y, 0)

  return {
    x: sumX / childPositions.length,
    y: sumY / childPositions.length,
  }
}
