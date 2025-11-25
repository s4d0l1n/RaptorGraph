import type { GraphNode, MetaNode, GroupingConfig } from '@/types'

/**
 * Grouping utility functions
 * Creates meta-nodes from nodes based on attribute values
 */

/**
 * Generate meta-nodes from nodes based on grouping configuration
 */
export function generateMetaNodes(
  nodes: GraphNode[],
  config: GroupingConfig
): MetaNode[] {
  if (!config.enabled || !config.groupByAttribute) {
    return []
  }

  const groupByAttr = config.groupByAttribute

  // Group nodes by attribute value
  const groups = new Map<string, GraphNode[]>()

  nodes.forEach((node) => {
    const attrValue = node.attributes[groupByAttr]

    // Handle multi-value attributes (arrays)
    if (Array.isArray(attrValue)) {
      attrValue.forEach((val) => {
        const key = val || '(empty)'
        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(node)
      })
    } else if (attrValue !== undefined && attrValue !== '') {
      const key = attrValue
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(node)
    } else {
      // Nodes without the attribute go to "(ungrouped)"
      const key = '(ungrouped)'
      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(node)
    }
  })

  // Create meta-nodes from groups
  const metaNodes: MetaNode[] = []

  groups.forEach((groupNodes, groupValue) => {
    // Only create meta-node if there's more than 1 node
    if (groupNodes.length > 1) {
      metaNodes.push({
        id: `meta-${groupByAttr}-${groupValue}`,
        label: `${groupValue} (${groupNodes.length})`,
        groupByAttribute: groupByAttr,
        groupValue,
        childNodeIds: groupNodes.map((n) => n.id),
        collapsed: config.autoCollapse,
      })
    }
  })

  return metaNodes
}

/**
 * Get visible nodes considering meta-node collapse state
 * Returns nodes that should be visible based on grouping
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

  metaNodes.forEach((metaNode) => {
    if (metaNode.collapsed) {
      metaNode.childNodeIds.forEach((id) => hiddenNodeIds.add(id))
    }
  })

  // Return only visible nodes
  return nodes.filter((node) => !hiddenNodeIds.has(node.id))
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
