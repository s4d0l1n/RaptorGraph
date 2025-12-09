/**
 * Cluster Island Layout Algorithm
 * Groups connected components into separate "islands" and arranges them
 */

import type { GraphNode, GraphEdge } from '@/types'

export interface ClusterIslandLayoutOptions {
  width: number
  height: number
  islandSpacing?: number
  innerLayout?: 'circle' | 'grid' | 'force'
  iterations?: number
  intraClusterAttraction?: number
  intraClusterRepulsion?: number
  leafRadialForce?: number
  interClusterRepulsion?: number
  minClusterDistance?: number
  centerGravity?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Find connected components using Union-Find
 */
function findConnectedComponents(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const parent = new Map<string, string>()
  const rank = new Map<string, number>()

  // Initialize
  nodes.forEach(node => {
    parent.set(node.id, node.id)
    rank.set(node.id, 0)
  })

  // Find with path compression
  const find = (id: string): string => {
    if (parent.get(id) !== id) {
      parent.set(id, find(parent.get(id)!))
    }
    return parent.get(id)!
  }

  // Union by rank
  const union = (id1: string, id2: string) => {
    const root1 = find(id1)
    const root2 = find(id2)

    if (root1 === root2) return

    const rank1 = rank.get(root1) ?? 0
    const rank2 = rank.get(root2) ?? 0

    if (rank1 < rank2) {
      parent.set(root1, root2)
    } else if (rank1 > rank2) {
      parent.set(root2, root1)
    } else {
      parent.set(root2, root1)
      rank.set(root1, rank1 + 1)
    }
  }

  // Process edges
  edges.forEach(edge => {
    union(edge.source, edge.target)
  })

  // Assign component IDs
  const componentMap = new Map<string, number>()
  const rootToComponent = new Map<string, number>()
  let componentId = 0

  nodes.forEach(node => {
    const root = find(node.id)
    if (!rootToComponent.has(root)) {
      rootToComponent.set(root, componentId++)
    }
    componentMap.set(node.id, rootToComponent.get(root)!)
  })

  return componentMap
}

/**
 * Arrange nodes in a circle
 */
function circleLayout(nodes: string[], centerX: number, centerY: number, radius: number): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 1) {
    positions.set(nodes[0], { x: centerX, y: centerY })
  } else {
    nodes.forEach((nodeId, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      positions.set(nodeId, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })
  }

  return positions
}

/**
 * Calculate cluster island layout positions for nodes
 */
export function calculateClusterIslandLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ClusterIslandLayoutOptions
): LayoutResult {
  const { width, height, islandSpacing = 100, innerLayout = 'circle' } = options
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  // Find connected components
  const componentMap = findConnectedComponents(nodes, edges)

  // Group nodes by component
  const components = new Map<number, string[]>()
  nodes.forEach(node => {
    const compId = componentMap.get(node.id)!
    if (!components.has(compId)) {
      components.set(compId, [])
    }
    components.get(compId)!.push(node.id)
  })

  // Arrange components in a grid
  const componentCount = components.size
  const cols = Math.ceil(Math.sqrt(componentCount))
  const rows = Math.ceil(componentCount / cols)

  const islandWidth = (width - (cols + 1) * islandSpacing) / cols
  const islandHeight = (height - (rows + 1) * islandSpacing) / rows

  let componentIndex = 0
  components.forEach((componentNodes, _) => {
    const row = Math.floor(componentIndex / cols)
    const col = componentIndex % cols

    const centerX = islandSpacing + col * (islandWidth + islandSpacing) + islandWidth / 2
    const centerY = islandSpacing + row * (islandHeight + islandSpacing) + islandHeight / 2

    // Layout nodes within this component
    const radius = Math.min(islandWidth, islandHeight) / 2 * 0.8
    const componentPositions = circleLayout(componentNodes, centerX, centerY, radius)

    componentPositions.forEach((pos, nodeId) => {
      positions.set(nodeId, pos)
    })

    componentIndex++
  })

  return { positions }
}
