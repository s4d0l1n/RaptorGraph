/**
 * Random layout algorithm
 * Positions nodes randomly with collision detection to prevent overlaps
 * Uses force-directed simulation for natural spacing
 */

import type { GraphNode } from '@/types'

export interface RandomLayoutOptions {
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Padding from edges */
  padding?: number
  /** Node radius for collision detection */
  nodeRadius?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

interface NodePosition {
  id: string
  x: number
  y: number
  vx: number  // velocity x
  vy: number  // velocity y
}

/**
 * Calculate random layout positions for nodes with collision avoidance
 */
export function calculateRandomLayout(
  nodes: GraphNode[],
  options: RandomLayoutOptions
): LayoutResult {
  const { width, height } = options
  const padding = options.padding || 50
  const nodeRadius = options.nodeRadius || 40
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  // Calculate expanded area based on node count to prevent bunching
  // Use more space as node count increases
  const nodeCount = nodes.length
  const nodesPerRow = Math.ceil(Math.sqrt(nodeCount))
  const minSpacing = nodeRadius * 3 // Minimum space between nodes
  const requiredWidth = nodesPerRow * minSpacing
  const requiredHeight = Math.ceil(nodeCount / nodesPerRow) * minSpacing

  // Expand canvas area if needed to accommodate all nodes comfortably
  const expandedWidth = Math.max(width, requiredWidth + 2 * padding)
  const expandedHeight = Math.max(height, requiredHeight + 2 * padding)

  // Initialize positions with velocities, distributed over expanded area
  const nodePositions: NodePosition[] = nodes.map((node) => ({
    id: node.id,
    x: padding + Math.random() * (expandedWidth - 2 * padding),
    y: padding + Math.random() * (expandedHeight - 2 * padding),
    vx: 0,
    vy: 0,
  }))

  // Run force-directed simulation to separate overlapping nodes
  const iterations = 150 // Balanced iterations for good separation without chaos
  const minDistance = nodeRadius * 2.5  // Minimum distance between nodes
  const damping = 0.85  // Velocity damping factor
  const repulsionStrength = 5  // Moderate strength for stable separation

  for (let iter = 0; iter < iterations; iter++) {
    // Apply repulsion between nodes
    for (let i = 0; i < nodePositions.length; i++) {
      const node1 = nodePositions[i]

      for (let j = i + 1; j < nodePositions.length; j++) {
        const node2 = nodePositions[j]

        const dx = node2.x - node1.x
        const dy = node2.y - node1.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // Apply repulsion if nodes are too close
        if (distance < minDistance && distance > 0) {
          const force = (minDistance - distance) / distance * repulsionStrength
          const fx = (dx / distance) * force
          const fy = (dy / distance) * force

          node1.vx -= fx
          node1.vy -= fy
          node2.vx += fx
          node2.vy += fy
        }
      }
    }

    // Update positions based on velocities
    nodePositions.forEach((node) => {
      node.x += node.vx
      node.y += node.vy

      // Apply damping
      node.vx *= damping
      node.vy *= damping

      // NO BOUNDARY CONSTRAINTS - let nodes expand freely beyond visible area
      // This allows nodes to spread out as much as needed
    })
  }

  // Final check: ensure absolute minimum separation
  // Do a final pass to guarantee no overlaps (but keep it gentle)
  let maxAdjustments = 20 // Reduced from 50 to prevent over-correction
  let hasOverlap = true

  while (hasOverlap && maxAdjustments > 0) {
    hasOverlap = false
    maxAdjustments--

    for (let i = 0; i < nodePositions.length; i++) {
      const node1 = nodePositions[i]

      for (let j = i + 1; j < nodePositions.length; j++) {
        const node2 = nodePositions[j]

        const dx = node2.x - node1.x
        const dy = node2.y - node1.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        // If still overlapping, push apart directly (but gently)
        if (distance < minDistance) {
          hasOverlap = true
          const pushDistance = (minDistance - distance) / 2 + 0.5 // Reduced safety margin for gentler push

          if (distance > 0) {
            const nx = dx / distance
            const ny = dy / distance

            node1.x -= nx * pushDistance
            node1.y -= ny * pushDistance
            node2.x += nx * pushDistance
            node2.y += ny * pushDistance
          } else {
            // Nodes are exactly on top of each other, push in random directions
            const angle = Math.random() * Math.PI * 2
            node1.x -= Math.cos(angle) * pushDistance
            node1.y -= Math.sin(angle) * pushDistance
            node2.x += Math.cos(angle) * pushDistance
            node2.y += Math.sin(angle) * pushDistance
          }
        }
      }
    }
  }

  // Convert to final positions map
  nodePositions.forEach((node) => {
    positions.set(node.id, {
      x: node.x,
      y: node.y,
    })
  })

  return { positions }
}
