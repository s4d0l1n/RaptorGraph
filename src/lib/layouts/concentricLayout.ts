/**
 * Concentric layout algorithm
 * Positions nodes in concentric circles based on degree
 */

import type { GraphNode, GraphEdge } from '@/types'

export interface ConcentricLayoutOptions {
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Minimum radius for innermost circle */
  minRadius?: number
  /** Spacing between circles */
  levelSpacing?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Calculate concentric layout positions for nodes
 */
export function calculateConcentricLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ConcentricLayoutOptions
): LayoutResult {
  const { width, height } = options
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  const centerX = width / 2
  const centerY = height / 2
  const minRadius = options.minRadius || 80
  const levelSpacing = options.levelSpacing || 120

  // Calculate degree for each node
  const degrees = new Map<string, number>()
  nodes.forEach((node) => {
    degrees.set(node.id, 0)
  })
  edges.forEach((edge) => {
    degrees.set(edge.source, (degrees.get(edge.source) || 0) + 1)
    degrees.set(edge.target, (degrees.get(edge.target) || 0) + 1)
  })

  // Group nodes by degree
  const degreeGroups = new Map<number, GraphNode[]>()
  nodes.forEach((node) => {
    const degree = degrees.get(node.id) || 0
    if (!degreeGroups.has(degree)) {
      degreeGroups.set(degree, [])
    }
    degreeGroups.get(degree)!.push(node)
  })

  // Sort degrees descending (highest degree in center)
  const sortedDegrees = Array.from(degreeGroups.keys()).sort((a, b) => b - a)

  // Position nodes in concentric circles
  sortedDegrees.forEach((degree, levelIndex) => {
    const nodesInLevel = degreeGroups.get(degree)!
    const radius = minRadius + levelIndex * levelSpacing

    nodesInLevel.forEach((node, i) => {
      const angle = (i / nodesInLevel.length) * Math.PI * 2
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      })
    })
  })

  return { positions }
}
