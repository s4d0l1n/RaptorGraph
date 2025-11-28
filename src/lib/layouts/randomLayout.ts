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

  // Initialize positions with velocities
  const nodePositions: NodePosition[] = nodes.map((node) => ({
    id: node.id,
    x: padding + Math.random() * (width - 2 * padding),
    y: padding + Math.random() * (height - 2 * padding),
    vx: 0,
    vy: 0,
  }))

  // Run force-directed simulation to separate overlapping nodes
  const iterations = 100
  const minDistance = nodeRadius * 2.5  // Minimum distance between nodes
  const damping = 0.85  // Velocity damping factor
  const repulsionStrength = 5  // Strength of node repulsion

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

      // Keep nodes within bounds
      node.x = Math.max(padding, Math.min(width - padding, node.x))
      node.y = Math.max(padding, Math.min(height - padding, node.y))
    })
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
