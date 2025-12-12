import { useCallback } from 'react'
import { toast } from '@/components/ui/Toast'
import type { GraphNode, GraphEdge, MetaNode } from '@/types'

/**
 * Hook for exporting graph visualization as SVG
 */
export function useGraphExport() {

  /**
   * Export graph as SVG showing all nodes on the canvas
   */
  const exportAsSVG = useCallback((
    nodes: GraphNode[],
    edges: GraphEdge[],
    metaNodes: MetaNode[],
    nodePositions: Map<string, { x: number; y: number }>,
    metaNodePositions: Map<string, { x: number; y: number }>,
    nodeStyles: Map<string, any>,
    edgeStyles: Map<string, any>,
    filename = 'raptorgraph-export'
  ) => {
    try {
      // Calculate bounds of all nodes to fit everything in the export
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

      nodePositions.forEach((pos) => {
        minX = Math.min(minX, pos.x - 100)
        maxX = Math.max(maxX, pos.x + 100)
        minY = Math.min(minY, pos.y - 100)
        maxY = Math.max(maxY, pos.y + 100)
      })

      metaNodePositions.forEach((pos) => {
        minX = Math.min(minX, pos.x - 200)
        maxX = Math.max(maxX, pos.x + 200)
        minY = Math.min(minY, pos.y - 200)
        maxY = Math.max(maxY, pos.y + 200)
      })

      const padding = 50
      const viewWidth = maxX - minX + padding * 2
      const viewHeight = maxY - minY + padding * 2

      // Create SVG with dimensions to fit all nodes
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('width', viewWidth.toString())
      svg.setAttribute('height', viewHeight.toString())
      svg.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${viewWidth} ${viewHeight}`)
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

      // Add dark background matching canvas
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bg.setAttribute('x', (minX - padding).toString())
      bg.setAttribute('y', (minY - padding).toString())
      bg.setAttribute('width', viewWidth.toString())
      bg.setAttribute('height', viewHeight.toString())
      bg.setAttribute('fill', '#0f172a')
      svg.appendChild(bg)

      // Helper function to detect line intersection
      const getLineIntersection = (
        x1: number, y1: number, x2: number, y2: number,
        x3: number, y3: number, x4: number, y4: number
      ): { x: number; y: number } | null => {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
        if (Math.abs(denom) < 0.001) return null

        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
          return {
            x: x1 + t * (x2 - x1),
            y: y1 + t * (y2 - y1)
          }
        }
        return null
      }

      // Detect edge crossings
      const edgeCrossings = new Map<string, Array<{ x: number; y: number }>>()
      const edgeSegments: Array<{ edgeId: string; x1: number; y1: number; x2: number; y2: number }> = []

      // Collect all edge segments
      edges.forEach((edge) => {
        const sourcePos = nodePositions.get(edge.source)
        const targetPos = nodePositions.get(edge.target)
        if (sourcePos && targetPos) {
          edgeSegments.push({
            edgeId: edge.id,
            x1: sourcePos.x,
            y1: sourcePos.y,
            x2: targetPos.x,
            y2: targetPos.y
          })
        }
      })

      // Find intersections
      for (let i = 0; i < edgeSegments.length; i++) {
        for (let j = i + 1; j < edgeSegments.length; j++) {
          const seg1 = edgeSegments[i]
          const seg2 = edgeSegments[j]

          const intersection = getLineIntersection(
            seg1.x1, seg1.y1, seg1.x2, seg1.y2,
            seg2.x1, seg2.y1, seg2.x2, seg2.y2
          )

          if (intersection) {
            // Add crossing to the edge that should "hop"
            const hopEdgeId = seg1.edgeId < seg2.edgeId ? seg1.edgeId : seg2.edgeId

            if (!edgeCrossings.has(hopEdgeId)) {
              edgeCrossings.set(hopEdgeId, [])
            }
            edgeCrossings.get(hopEdgeId)!.push(intersection)
          }
        }
      }

      // Draw edges first (so they appear behind nodes)
      edges.forEach((edge) => {
        const sourcePos = nodePositions.get(edge.source)
        const targetPos = nodePositions.get(edge.target)
        if (!sourcePos || !targetPos) return

        const style = edgeStyles.get(edge.id) || {}
        const crossings = edgeCrossings.get(edge.id) || []

        if (crossings.length === 0) {
          // No crossings - draw simple line
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
          line.setAttribute('x1', sourcePos.x.toString())
          line.setAttribute('y1', sourcePos.y.toString())
          line.setAttribute('x2', targetPos.x.toString())
          line.setAttribute('y2', targetPos.y.toString())
          line.setAttribute('stroke', style.color || '#64748b')
          line.setAttribute('stroke-width', style.thickness?.toString() || '1.5')
          line.setAttribute('stroke-opacity', style.opacity?.toString() || '0.4')
          if (style.style === 'dashed') {
            line.setAttribute('stroke-dasharray', '5,5')
          }
          svg.appendChild(line)
        } else {
          // Has crossings - draw path with hop arcs
          const hopRadius = 8

          // Calculate line direction
          const dx = targetPos.x - sourcePos.x
          const dy = targetPos.y - sourcePos.y
          const lineLength = Math.sqrt(dx * dx + dy * dy)
          const dirX = dx / lineLength
          const dirY = dy / lineLength

          // Sort crossings by distance along the line
          const sortedCrossings = crossings.map(crossing => {
            const distAlongLine = (crossing.x - sourcePos.x) * dirX + (crossing.y - sourcePos.y) * dirY
            return { ...crossing, distAlongLine }
          }).sort((a, b) => a.distAlongLine - b.distAlongLine)

          // Build SVG path with arcs
          let pathD = `M ${sourcePos.x} ${sourcePos.y} `

          sortedCrossings.forEach(crossing => {
            // Calculate perpendicular direction for arc
            const perpX = -dirY
            const perpY = dirX

            // Points before and after the crossing
            const beforeX = crossing.x - dirX * hopRadius
            const beforeY = crossing.y - dirY * hopRadius
            const afterX = crossing.x + dirX * hopRadius
            const afterY = crossing.y + dirY * hopRadius

            // Arc peak point (perpendicular to line)
            const arcX = crossing.x + perpX * hopRadius
            const arcY = crossing.y + perpY * hopRadius

            // Draw to before crossing
            pathD += `L ${beforeX} ${beforeY} `

            // Draw arc over crossing (Q = quadratic bezier)
            pathD += `Q ${arcX} ${arcY} ${afterX} ${afterY} `
          })

          // Draw to target
          pathD += `L ${targetPos.x} ${targetPos.y}`

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          path.setAttribute('d', pathD)
          path.setAttribute('stroke', style.color || '#64748b')
          path.setAttribute('stroke-width', style.thickness?.toString() || '1.5')
          path.setAttribute('stroke-opacity', style.opacity?.toString() || '0.4')
          path.setAttribute('fill', 'none')
          if (style.style === 'dashed') {
            path.setAttribute('stroke-dasharray', '5,5')
          }
          svg.appendChild(path)
        }
      })

      // Draw meta-nodes
      metaNodes.forEach((metaNode) => {
        const pos = metaNodePositions.get(metaNode.id)
        if (!pos) return

        const childCount = metaNode.childNodeIds.length
        const cols = Math.ceil(Math.sqrt(childCount)) * 2
        const gridWidth = cols * 100
        const gridHeight = (gridWidth * 2) / 3

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', (pos.x - gridWidth / 2).toString())
        rect.setAttribute('y', (pos.y - gridHeight / 2).toString())
        rect.setAttribute('width', gridWidth.toString())
        rect.setAttribute('height', gridHeight.toString())
        rect.setAttribute('fill', 'rgba(59, 130, 246, 0.05)')
        rect.setAttribute('stroke', '#3b82f6')
        rect.setAttribute('stroke-width', '2')
        rect.setAttribute('stroke-dasharray', '8,4')
        rect.setAttribute('rx', '8')
        svg.appendChild(rect)

        // Add label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', pos.x.toString())
        text.setAttribute('y', (pos.y - gridHeight / 2 - 10).toString())
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('fill', '#94a3b8')
        text.setAttribute('font-size', '12')
        text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')
        text.textContent = metaNode.label
        svg.appendChild(text)
      })

      // Draw nodes with proper card styling
      nodes.forEach((node) => {
        const pos = nodePositions.get(node.id)
        if (!pos) return

        const style = nodeStyles.get(node.id) || {}

        // Get size from style or use defaults
        const sizeMultiplier = style.sizeMultiplier || 1
        const baseWidth = 120
        const baseHeight = 60
        const width = baseWidth * sizeMultiplier
        const height = baseHeight * sizeMultiplier

        // Get shape from style
        const shape = style.shape || 'rect'

        // Get colors from style
        const bgColor = style.backgroundColor || '#1e293b'
        const borderColor = style.borderColor || '#0891b2'
        const textColor = style.textColor || '#e2e8f0'
        const borderWidth = style.borderWidth || 2

        // Create node group
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

        // Draw shape based on type
        if (shape === 'circle') {
          const radius = Math.min(width, height) / 2
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          circle.setAttribute('cx', pos.x.toString())
          circle.setAttribute('cy', pos.y.toString())
          circle.setAttribute('r', radius.toString())
          circle.setAttribute('fill', bgColor)
          circle.setAttribute('stroke', borderColor)
          circle.setAttribute('stroke-width', borderWidth.toString())
          g.appendChild(circle)
        } else if (shape === 'diamond') {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          const d = `M ${pos.x} ${pos.y - height/2} L ${pos.x + width/2} ${pos.y} L ${pos.x} ${pos.y + height/2} L ${pos.x - width/2} ${pos.y} Z`
          path.setAttribute('d', d)
          path.setAttribute('fill', bgColor)
          path.setAttribute('stroke', borderColor)
          path.setAttribute('stroke-width', borderWidth.toString())
          g.appendChild(path)
        } else if (shape === 'triangle') {
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          const d = `M ${pos.x} ${pos.y - height/2} L ${pos.x + width/2} ${pos.y + height/2} L ${pos.x - width/2} ${pos.y + height/2} Z`
          path.setAttribute('d', d)
          path.setAttribute('fill', bgColor)
          path.setAttribute('stroke', borderColor)
          path.setAttribute('stroke-width', borderWidth.toString())
          g.appendChild(path)
        } else if (shape === 'star') {
          const outerRadius = Math.min(width, height) / 2
          const innerRadius = outerRadius * 0.4
          let pathD = ''
          for (let i = 0; i < 5; i++) {
            const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
            const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2
            const outerX = pos.x + outerRadius * Math.cos(outerAngle)
            const outerY = pos.y + outerRadius * Math.sin(outerAngle)
            const innerX = pos.x + innerRadius * Math.cos(innerAngle)
            const innerY = pos.y + innerRadius * Math.sin(innerAngle)
            if (i === 0) {
              pathD += `M ${outerX} ${outerY} `
            } else {
              pathD += `L ${outerX} ${outerY} `
            }
            pathD += `L ${innerX} ${innerY} `
          }
          pathD += 'Z'
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
          path.setAttribute('d', pathD)
          path.setAttribute('fill', bgColor)
          path.setAttribute('stroke', borderColor)
          path.setAttribute('stroke-width', borderWidth.toString())
          g.appendChild(path)
        } else if (shape === 'ellipse') {
          const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse')
          ellipse.setAttribute('cx', pos.x.toString())
          ellipse.setAttribute('cy', pos.y.toString())
          ellipse.setAttribute('rx', (width / 2).toString())
          ellipse.setAttribute('ry', (height / 2).toString())
          ellipse.setAttribute('fill', bgColor)
          ellipse.setAttribute('stroke', borderColor)
          ellipse.setAttribute('stroke-width', borderWidth.toString())
          g.appendChild(ellipse)
        } else {
          // Default: rounded rectangle
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
          rect.setAttribute('x', (pos.x - width / 2).toString())
          rect.setAttribute('y', (pos.y - height / 2).toString())
          rect.setAttribute('width', width.toString())
          rect.setAttribute('height', height.toString())
          rect.setAttribute('fill', bgColor)
          rect.setAttribute('stroke', borderColor)
          rect.setAttribute('stroke-width', borderWidth.toString())
          rect.setAttribute('rx', '6')
          g.appendChild(rect)
        }

        // Add icon if present
        const iconX = pos.x
        const iconY = pos.y - 15

        if (style.icon) {
          // Custom icon (emoji)
          const iconSize = style.iconSize ? style.iconSize * 16 : 16
          const iconText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          iconText.setAttribute('x', iconX.toString())
          iconText.setAttribute('y', iconY.toString())
          iconText.setAttribute('text-anchor', 'middle')
          iconText.setAttribute('dominant-baseline', 'middle')
          iconText.setAttribute('fill', style.iconColor || '#fff')
          iconText.setAttribute('font-size', iconSize.toString())
          iconText.setAttribute('font-family', 'sans-serif')
          iconText.textContent = style.icon
          g.appendChild(iconText)
        } else {
          // Default icon: circle with first letter
          const iconRadius = 16
          const iconCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
          iconCircle.setAttribute('cx', iconX.toString())
          iconCircle.setAttribute('cy', iconY.toString())
          iconCircle.setAttribute('r', iconRadius.toString())
          iconCircle.setAttribute('fill', style.isStub ? '#64748b' : '#06b6d4')
          g.appendChild(iconCircle)

          // First letter
          const iconLetter = document.createElementNS('http://www.w3.org/2000/svg', 'text')
          iconLetter.setAttribute('x', iconX.toString())
          iconLetter.setAttribute('y', iconY.toString())
          iconLetter.setAttribute('text-anchor', 'middle')
          iconLetter.setAttribute('dominant-baseline', 'middle')
          iconLetter.setAttribute('fill', '#fff')
          iconLetter.setAttribute('font-size', '14')
          iconLetter.setAttribute('font-weight', 'bold')
          iconLetter.setAttribute('font-family', 'sans-serif')
          iconLetter.textContent = style.label?.charAt(0).toUpperCase() || ''
          g.appendChild(iconLetter)
        }

        // Add node label with better text handling
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', pos.x.toString())
        text.setAttribute('y', (pos.y + 8).toString())
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('dominant-baseline', 'top')
        text.setAttribute('fill', textColor)
        text.setAttribute('font-size', '12')
        text.setAttribute('font-weight', '600')
        text.setAttribute('font-family', 'system-ui, -apple-system, sans-serif')

        // Truncate text if too long
        const maxChars = Math.floor(width / 7)
        const displayText = node.label.length > maxChars ? node.label.slice(0, maxChars) + '...' : node.label
        text.textContent = displayText
        g.appendChild(text)

        // Add attributes if present
        if (style.attributeDisplays && style.attributeDisplays.length > 0) {
          const visibleAttrs = style.attributeDisplays
            .filter((attrDisplay: any) => attrDisplay.visible)
            .sort((a: any, b: any) => a.order - b.order)

          let yOffset = pos.y + 24
          const maxAttrsToShow = 3

          visibleAttrs.slice(0, maxAttrsToShow).forEach((attrDisplay: any) => {
            // Get attribute value
            let attrValue = ''
            if (attrDisplay.attributeName === '__id__') {
              attrValue = node.id
            } else if (style.attributes && style.attributes[attrDisplay.attributeName]) {
              const value = style.attributes[attrDisplay.attributeName]
              attrValue = Array.isArray(value) ? value.join(', ') : value
            }

            if (attrValue) {
              const fontSize = attrDisplay.fontSize || 10
              const color = attrDisplay.color || '#94a3b8'
              const displayLabel = attrDisplay.displayLabel || attrDisplay.attributeName
              const prefix = attrDisplay.prefix || ''
              const suffix = attrDisplay.suffix || ''
              const displayText = `${prefix}${displayLabel}: ${attrValue}${suffix}`

              const attrText = document.createElementNS('http://www.w3.org/2000/svg', 'text')
              attrText.setAttribute('x', pos.x.toString())
              attrText.setAttribute('y', yOffset.toString())
              attrText.setAttribute('text-anchor', 'middle')
              attrText.setAttribute('dominant-baseline', 'top')
              attrText.setAttribute('fill', color)
              attrText.setAttribute('font-size', fontSize.toString())
              attrText.setAttribute('font-family', 'sans-serif')
              attrText.textContent = displayText
              g.appendChild(attrText)

              yOffset += fontSize + 4
            }
          })
        }

        svg.appendChild(g)
      })

      // Convert SVG to string
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(svg)
      const blob = new Blob([svgString], { type: 'image/svg+xml' })

      // Download
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported as ${filename}.svg (${Math.round(viewWidth)}x${Math.round(viewHeight)}px, ${nodes.length} nodes)`)
    } catch (error) {
      console.error('SVG export error:', error)
      toast.error('Failed to export as SVG')
    }
  }, [])

  return {
    exportAsSVG,
  }
}
