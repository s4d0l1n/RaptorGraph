/**
 * Random layout algorithm
 * Positions nodes randomly with optional bounds
 */

import type { GraphNode } from '@/types'

export interface RandomLayoutOptions {
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Padding from edges */
  padding?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Calculate random layout positions for nodes
 */
export function calculateRandomLayout(
  nodes: GraphNode[],
  options: RandomLayoutOptions
): LayoutResult {
  const { width, height } = options
  const padding = options.padding || 50
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  nodes.forEach((node) => {
    positions.set(node.id, {
      x: padding + Math.random() * (width - 2 * padding),
      y: padding + Math.random() * (height - 2 * padding),
    })
  })

  return { positions }
}
