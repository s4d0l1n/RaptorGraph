/**
 * Circle layout algorithm
 * Positions nodes in a circle
 */

import type { GraphNode } from '@/types'

export interface CircleLayoutOptions {
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Radius (optional, auto-calculated if not provided) */
  radius?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Calculate circle layout positions for nodes
 */
export function calculateCircleLayout(
  nodes: GraphNode[],
  options: CircleLayoutOptions
): LayoutResult {
  const { width, height } = options
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  const centerX = width / 2
  const centerY = height / 2
  const radius = options.radius || Math.min(width, height) / 3

  nodes.forEach((node, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    })
  })

  return { positions }
}
