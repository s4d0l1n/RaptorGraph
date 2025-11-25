/**
 * Grid layout algorithm
 * Positions nodes in a grid pattern
 */

import type { GraphNode } from '@/types'

export interface GridLayoutOptions {
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
  /** Columns (optional, auto-calculated if not provided) */
  cols?: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
}

/**
 * Calculate grid layout positions for nodes
 */
export function calculateGridLayout(
  nodes: GraphNode[],
  options: GridLayoutOptions
): LayoutResult {
  const { width, height } = options
  const positions = new Map<string, { x: number; y: number }>()

  if (nodes.length === 0) {
    return { positions }
  }

  // Calculate grid dimensions
  const cols = options.cols || Math.ceil(Math.sqrt(nodes.length))
  const rows = Math.ceil(nodes.length / cols)

  const cellWidth = (width - 100) / cols
  const cellHeight = (height - 100) / rows

  nodes.forEach((node, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)

    positions.set(node.id, {
      x: 50 + col * cellWidth + cellWidth / 2,
      y: 50 + row * cellHeight + cellHeight / 2,
    })
  })

  return { positions }
}
