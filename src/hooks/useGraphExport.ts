import { useCallback } from 'react'
import { toast } from '@/components/ui/Toast'
import type { GraphNode, GraphEdge, MetaNode } from '@/types'

/**
 * Hook for exporting graph visualization as PNG or SVG
 */
export function useGraphExport() {
  /**
   * Export canvas as high-resolution PNG
   * @param canvas - The canvas element to export
   * @param filename - Output filename (without extension)
   * @param scale - Scale factor for higher resolution (default: 2 for 2x resolution)
   */
  const exportAsPNG = useCallback(async (
    canvas: HTMLCanvasElement | null,
    filename = 'raptorgraph-export',
    scale = 2
  ) => {
    if (!canvas) {
      toast.error('No graph to export')
      return
    }

    try {
      // Create a new canvas with higher resolution
      const exportCanvas = document.createElement('canvas')
      const ctx = exportCanvas.getContext('2d')

      if (!ctx) {
        toast.error('Failed to create export context')
        return
      }

      // Set higher resolution dimensions
      exportCanvas.width = canvas.width * scale
      exportCanvas.height = canvas.height * scale

      // Scale the context
      ctx.scale(scale, scale)

      // Draw the original canvas onto the export canvas
      ctx.drawImage(canvas, 0, 0)

      // Convert to blob
      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, 'image/png', 1.0)
      })

      if (!blob) {
        toast.error('Failed to generate image')
        return
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported as ${filename}.png (${exportCanvas.width}x${exportCanvas.height}px)`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export graph')
    }
  }, [])

  /**
   * Export canvas with custom dimensions
   */
  const exportWithDimensions = useCallback(async (
    canvas: HTMLCanvasElement | null,
    filename: string,
    width: number,
    height: number
  ) => {
    if (!canvas) {
      toast.error('No graph to export')
      return
    }

    try {
      const exportCanvas = document.createElement('canvas')
      const ctx = exportCanvas.getContext('2d')

      if (!ctx) {
        toast.error('Failed to create export context')
        return
      }

      exportCanvas.width = width
      exportCanvas.height = height

      // Scale to fit the specified dimensions
      const scaleX = width / canvas.width
      const scaleY = height / canvas.height
      ctx.scale(scaleX, scaleY)

      ctx.drawImage(canvas, 0, 0)

      const blob = await new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, 'image/png', 1.0)
      })

      if (!blob) {
        toast.error('Failed to generate image')
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${filename}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success(`Exported as ${filename}.png (${width}x${height}px)`)
    } catch (error) {
      console.error('Export error:', error)
      toast.error('Failed to export graph')
    }
  }, [])

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
    canvasWidth: number,
    canvasHeight: number,
    zoom: number,
    panOffset: { x: number; y: number },
    rotation: number,
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

      // Add dark background
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bg.setAttribute('x', (minX - padding).toString())
      bg.setAttribute('y', (minY - padding).toString())
      bg.setAttribute('width', viewWidth.toString())
      bg.setAttribute('height', viewHeight.toString())
      bg.setAttribute('fill', '#0f172a')
      svg.appendChild(bg)

      // Draw edges first (so they appear behind nodes)
      edges.forEach((edge) => {
        const sourcePos = nodePositions.get(edge.source)
        const targetPos = nodePositions.get(edge.target)
        if (!sourcePos || !targetPos) return

        const style = edgeStyles.get(edge.id) || {}
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
        line.setAttribute('x1', sourcePos.x.toString())
        line.setAttribute('y1', sourcePos.y.toString())
        line.setAttribute('x2', targetPos.x.toString())
        line.setAttribute('y2', targetPos.y.toString())
        line.setAttribute('stroke', style.color || '#64748b')
        line.setAttribute('stroke-width', style.thickness?.toString() || '2')
        line.setAttribute('stroke-opacity', style.opacity?.toString() || '0.5')
        if (style.style === 'dashed') {
          line.setAttribute('stroke-dasharray', '5,5')
        }
        svg.appendChild(line)
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
        rect.setAttribute('fill', 'rgba(59, 130, 246, 0.1)')
        rect.setAttribute('stroke', '#3b82f6')
        rect.setAttribute('stroke-width', '2')
        rect.setAttribute('rx', '8')
        svg.appendChild(rect)

        // Add label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', pos.x.toString())
        text.setAttribute('y', (pos.y - gridHeight / 2 - 10).toString())
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('fill', '#94a3b8')
        text.setAttribute('font-size', '14')
        text.textContent = metaNode.label
        svg.appendChild(text)
      })

      // Draw nodes
      nodes.forEach((node) => {
        const pos = nodePositions.get(node.id)
        if (!pos) return

        const style = nodeStyles.get(node.id) || {}
        const width = 120
        const height = 80

        // Node background
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        rect.setAttribute('x', (pos.x - width / 2).toString())
        rect.setAttribute('y', (pos.y - height / 2).toString())
        rect.setAttribute('width', width.toString())
        rect.setAttribute('height', height.toString())
        rect.setAttribute('fill', style.backgroundColor || '#1e293b')
        rect.setAttribute('stroke', style.borderColor || '#0891b2')
        rect.setAttribute('stroke-width', style.borderWidth?.toString() || '2')
        rect.setAttribute('rx', '6')
        svg.appendChild(rect)

        // Node label
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
        text.setAttribute('x', pos.x.toString())
        text.setAttribute('y', pos.y.toString())
        text.setAttribute('text-anchor', 'middle')
        text.setAttribute('dominant-baseline', 'middle')
        text.setAttribute('fill', style.textColor || '#e2e8f0')
        text.setAttribute('font-size', '12')
        text.setAttribute('font-weight', 'bold')
        text.textContent = node.label.length > 15 ? node.label.slice(0, 15) + '...' : node.label
        svg.appendChild(text)
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

      toast.success(`Exported as ${filename}.svg (${Math.round(viewWidth)}x${Math.round(viewHeight)}px, all nodes)`)
    } catch (error) {
      console.error('SVG export error:', error)
      toast.error('Failed to export as SVG')
    }
  }, [])

  return {
    exportAsPNG,
    exportWithDimensions,
    exportAsSVG,
  }
}
