/**
 * Force-directed layout algorithm
 * Uses physics simulation to create organic, non-cluttered layouts
 * Nodes repel each other while connected nodes attract
 */

import type { GraphNode, GraphEdge } from '@/types'

export interface ForceLayoutOptions {
  width: number
  height: number
  iterations?: number
  repulsionStrength?: number
  attractionStrength?: number
  centerGravity?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Calculate force-directed layout using a simplified physics simulation
 */
export function calculateForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ForceLayoutOptions
): LayoutResult {
  const {
    width,
    height,
    iterations = 100,
    repulsionStrength = 5000,
    attractionStrength = 0.01,
    centerGravity = 0.05,
  } = options

  // Initialize positions randomly with some spread
  const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>()
  nodes.forEach((node) => {
    positions.set(node.id, {
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
      vx: 0,
      vy: 0,
    })
  })

  // Build adjacency map for quick lookup
  const adjacency = new Map<string, Set<string>>()
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set())
    }
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set())
    }
    adjacency.get(edge.source)!.add(edge.target)
    adjacency.get(edge.target)!.add(edge.source)
  })

  // Run simulation
  for (let iteration = 0; iteration < iterations; iteration++) {
    // Temperature decreases over time for stability
    const temperature = 1 - iteration / iterations

    // Calculate forces on each node
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!
      let fx = 0
      let fy = 0

      // Repulsion from all other nodes (prevent overlap)
      nodes.forEach((other) => {
        if (node.id === other.id) return

        const otherPos = positions.get(other.id)!
        const dx = pos.x - otherPos.x
        const dy = pos.y - otherPos.y
        const distSq = dx * dx + dy * dy + 1 // +1 to prevent division by zero
        const dist = Math.sqrt(distSq)

        // Stronger repulsion at close distances
        const repulsion = repulsionStrength / distSq
        fx += (dx / dist) * repulsion
        fy += (dy / dist) * repulsion
      })

      // Attraction to connected nodes
      const neighbors = adjacency.get(node.id) || new Set()
      neighbors.forEach((neighborId) => {
        const neighborPos = positions.get(neighborId)
        if (!neighborPos) return

        const dx = neighborPos.x - pos.x
        const dy = neighborPos.y - pos.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist > 0) {
          const attraction = dist * attractionStrength
          fx += (dx / dist) * attraction
          fy += (dy / dist) * attraction
        }
      })

      // NO center gravity - allow nodes to spread naturally
      // NO boundary constraints - nodes can position anywhere to avoid overlaps

      // Apply forces with damping
      const damping = 0.8
      pos.vx = (pos.vx + fx) * damping
      pos.vy = (pos.vy + fy) * damping

      // Update position
      pos.x += pos.vx * temperature
      pos.y += pos.vy * temperature

      // NO boundary constraints - let nodes expand freely beyond visible area
      // This allows nodes to spread out as much as needed to prevent overlaps
    })
  }

  // Convert to final format (remove velocity)
  const finalPositions = new Map<string, { x: number; y: number }>()
  positions.forEach((pos, id) => {
    finalPositions.set(id, { x: pos.x, y: pos.y })
  })

  return { positions: finalPositions }
}
