/**
 * Timeline layout algorithm
 * Positions nodes on X-axis by timestamp and groups on Y-axis
 */

import type { GraphNode } from '@/types'

export interface TimelineLayoutOptions {
  /** Attribute to group by for Y-axis swimlanes (optional) */
  swimlaneAttribute?: string
  /** Spacing between nodes on X-axis */
  horizontalSpacing?: number
  /** Spacing between swimlanes on Y-axis */
  verticalSpacing?: number
  /** Canvas width */
  width: number
  /** Canvas height */
  height: number
}

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>
  swimlanes: Map<string, number>
}

/**
 * Calculate timeline layout positions for nodes
 */
export function calculateTimelineLayout(
  nodes: GraphNode[],
  options: TimelineLayoutOptions
): LayoutResult {
  const {
    swimlaneAttribute,
    width,
    height,
  } = options

  const positions = new Map<string, { x: number; y: number }>()
  const swimlanes = new Map<string, number>()

  // Filter nodes with timestamps
  const nodesWithTime = nodes.filter((n) => n.timestamp !== undefined)
  const nodesWithoutTime = nodes.filter((n) => n.timestamp === undefined)

  if (nodesWithTime.length === 0) {
    // No timestamps, fall back to simple layout
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      const radius = Math.min(width, height) / 3
      positions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      })
    })
    return { positions, swimlanes }
  }

  // Sort nodes by timestamp
  const sortedNodes = [...nodesWithTime].sort((a, b) => {
    return (a.timestamp || 0) - (b.timestamp || 0)
  })

  // Get time range
  const minTime = sortedNodes[0].timestamp || 0
  const maxTime = sortedNodes[sortedNodes.length - 1].timestamp || 0
  const timeRange = maxTime - minTime || 1

  // Group nodes by swimlane if attribute specified
  if (swimlaneAttribute) {
    const groupMap = new Map<string, GraphNode[]>()

    sortedNodes.forEach((node) => {
      const attrValue = node.attributes[swimlaneAttribute]
      const groupKey = Array.isArray(attrValue)
        ? attrValue[0]
        : attrValue
        ? String(attrValue)
        : 'unknown'

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, [])
      }
      groupMap.get(groupKey)!.push(node)
    })

    // Assign Y positions to swimlanes
    const groups = Array.from(groupMap.keys())
    const swimlaneCount = groups.length
    const swimlaneHeight = (height - 100) / swimlaneCount

    groups.forEach((group, i) => {
      const yPos = 50 + i * swimlaneHeight + swimlaneHeight / 2
      swimlanes.set(group, yPos)
    })

    // Position nodes
    groupMap.forEach((groupNodes, group) => {
      const yPos = swimlanes.get(group) || height / 2

      groupNodes.forEach((node) => {
        const timeFraction = ((node.timestamp || 0) - minTime) / timeRange
        const xPos = 50 + timeFraction * (width - 100)

        positions.set(node.id, { x: xPos, y: yPos })
      })
    })
  } else {
    // No swimlanes, use Y-axis jitter
    sortedNodes.forEach((node) => {
      const timeFraction = ((node.timestamp || 0) - minTime) / timeRange
      const xPos = 50 + timeFraction * (width - 100)
      const yPos = height / 2 + (Math.random() - 0.5) * (height / 3)

      positions.set(node.id, { x: xPos, y: yPos })
    })
  }

  // Position nodes without timestamps at the end
  nodesWithoutTime.forEach((node, i) => {
    const xPos = width - 50
    const yPos = 50 + i * 40

    positions.set(node.id, { x: xPos, y: yPos })
  })

  return { positions, swimlanes }
}
