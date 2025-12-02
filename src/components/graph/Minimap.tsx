import { useEffect, useRef, useState } from 'react'
import { Map } from 'lucide-react'

interface NodePosition {
  x: number
  y: number
}

interface MinimapProps {
  nodePositions: Map<string, NodePosition>
  metaNodePositions: Map<string, NodePosition>
  panOffset: { x: number; y: number }
  zoom: number
  canvasWidth: number
  canvasHeight: number
  onPanChange: (offset: { x: number; y: number }) => void
}

/**
 * Minimap for navigation in large graphs
 * Shows overview of entire graph with draggable viewport indicator
 */
export function Minimap({
  nodePositions,
  metaNodePositions,
  panOffset,
  zoom,
  canvasWidth,
  canvasHeight,
  onPanChange,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const minimapWidth = 200
  const minimapHeight = 150

  // Calculate bounds of all nodes
  const bounds = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 })

  useEffect(() => {
    if (!nodePositions || !metaNodePositions) return
    if (nodePositions.size === 0 && metaNodePositions.size === 0) return

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    nodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x)
      maxX = Math.max(maxX, pos.x)
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y)
    })

    metaNodePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x)
      maxX = Math.max(maxX, pos.x)
      minY = Math.min(minY, pos.y)
      maxY = Math.max(maxY, pos.y)
    })

    // Add padding
    const padding = 100
    bounds.current = {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    }
  }, [nodePositions, metaNodePositions])

  // Render minimap
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#0f172a'
    ctx.fillRect(0, 0, minimapWidth, minimapHeight)

    const { minX, maxX, minY, maxY } = bounds.current
    const graphWidth = maxX - minX
    const graphHeight = maxY - minY

    if (graphWidth === 0 || graphHeight === 0) return

    // Calculate scale to fit entire graph in minimap
    const scaleX = minimapWidth / graphWidth
    const scaleY = minimapHeight / graphHeight
    const scale = Math.min(scaleX, scaleY) * 0.9 // 0.9 for small margin

    const offsetX = (minimapWidth - graphWidth * scale) / 2
    const offsetY = (minimapHeight - graphHeight * scale) / 2

    // Transform position from graph space to minimap space
    const toMinimapX = (x: number) => (x - minX) * scale + offsetX
    const toMinimapY = (y: number) => (y - minY) * scale + offsetY

    // Draw all nodes as small dots
    if (nodePositions) {
      ctx.fillStyle = '#0891b2'
      nodePositions.forEach((pos) => {
        const x = toMinimapX(pos.x)
        const y = toMinimapY(pos.y)
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Draw meta-nodes as slightly larger dots
    if (metaNodePositions) {
      ctx.fillStyle = '#3b82f6'
      metaNodePositions.forEach((pos) => {
        const x = toMinimapX(pos.x)
        const y = toMinimapY(pos.y)
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      })
    }

    // Draw viewport rectangle
    const viewportX = -panOffset.x / zoom
    const viewportY = -panOffset.y / zoom
    const viewportWidth = canvasWidth / zoom
    const viewportHeight = canvasHeight / zoom

    const rectX = toMinimapX(viewportX)
    const rectY = toMinimapY(viewportY)
    const rectW = viewportWidth * scale
    const rectH = viewportHeight * scale

    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    ctx.strokeRect(rectX, rectY, rectW, rectH)

    // Fill viewport with semi-transparent overlay
    ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'
    ctx.fillRect(rectX, rectY, rectW, rectH)
  }, [nodePositions, metaNodePositions, panOffset, zoom, canvasWidth, canvasHeight])

  // Handle click/drag on minimap to change viewport
  const handleMinimapInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const { minX, maxX, minY, maxY } = bounds.current
    const graphWidth = maxX - minX
    const graphHeight = maxY - minY

    const scaleX = minimapWidth / graphWidth
    const scaleY = minimapHeight / graphHeight
    const scale = Math.min(scaleX, scaleY) * 0.9

    const offsetX = (minimapWidth - graphWidth * scale) / 2
    const offsetY = (minimapHeight - graphHeight * scale) / 2

    // Transform from minimap space to graph space
    const graphX = (clickX - offsetX) / scale + minX
    const graphY = (clickY - offsetY) / scale + minY

    // Center viewport on clicked position
    const newPanX = -graphX * zoom + canvasWidth / 2
    const newPanY = -graphY * zoom + canvasHeight / 2

    onPanChange({ x: newPanX, y: newPanY })
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true)
    handleMinimapInteraction(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return
    handleMinimapInteraction(e)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  if (!nodePositions || !metaNodePositions) return null
  if (nodePositions.size === 0 && metaNodePositions.size === 0) return null

  return (
    <canvas
      ref={canvasRef}
      width={minimapWidth}
      height={minimapHeight}
      className="cursor-pointer"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  )
}
