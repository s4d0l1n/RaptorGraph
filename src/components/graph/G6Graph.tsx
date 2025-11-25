import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'

interface NodePosition {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Enhanced Canvas Graph Visualization with card-style nodes
 */
export function G6Graph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { nodes, edges } = useGraphStore()
  const { setSelectedNodeId, selectedNodeId } = useUIStore()
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const animationRef = useRef<number>()

  // Initialize node positions
  useEffect(() => {
    if (nodes.length === 0) return

    const positions = new Map<string, NodePosition>()
    const canvas = canvasRef.current
    if (!canvas) return

    const centerX = canvas.offsetWidth / 2
    const centerY = canvas.offsetHeight / 2
    const radius = Math.min(canvas.offsetWidth, canvas.offsetHeight) / 3

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      })
    })

    setNodePositions(positions)
  }, [nodes])

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if click is on a node
    let clickedNodeId: string | null = null
    for (const [nodeId, pos] of nodePositions.entries()) {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
      if (distance < 30) {
        clickedNodeId = nodeId
        break
      }
    }

    setSelectedNodeId(clickedNodeId)
  }

  // Render graph
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0 || nodePositions.size === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const render = () => {
      // Set canvas size
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight

      // Clear canvas
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw edges
      edges.forEach((edge) => {
        const sourcePos = nodePositions.get(edge.source)
        const targetPos = nodePositions.get(edge.target)

        if (sourcePos && targetPos) {
          ctx.strokeStyle = '#475569'
          ctx.lineWidth = 2

          ctx.beginPath()
          ctx.moveTo(sourcePos.x, sourcePos.y)
          ctx.lineTo(targetPos.x, targetPos.y)
          ctx.stroke()

          // Draw arrow
          const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x)
          const arrowSize = 8
          ctx.fillStyle = '#475569'
          ctx.beginPath()
          ctx.moveTo(
            targetPos.x - 30 * Math.cos(angle),
            targetPos.y - 30 * Math.sin(angle)
          )
          ctx.lineTo(
            targetPos.x - 30 * Math.cos(angle) - arrowSize * Math.cos(angle - Math.PI / 6),
            targetPos.y - 30 * Math.sin(angle) - arrowSize * Math.sin(angle - Math.PI / 6)
          )
          ctx.lineTo(
            targetPos.x - 30 * Math.cos(angle) - arrowSize * Math.cos(angle + Math.PI / 6),
            targetPos.y - 30 * Math.sin(angle) - arrowSize * Math.sin(angle + Math.PI / 6)
          )
          ctx.closePath()
          ctx.fill()
        }
      })

      // Draw nodes as cards
      nodes.forEach((node) => {
        const pos = nodePositions.get(node.id)
        if (!pos) return

        const isSelected = node.id === selectedNodeId
        const cardWidth = 120
        const cardHeight = 60

        // Draw card background
        ctx.fillStyle = node.isStub ? '#1e293b' : '#0f172a'
        ctx.strokeStyle = isSelected ? '#22d3ee' : node.isStub ? '#475569' : '#0891b2'
        ctx.lineWidth = isSelected ? 3 : 2

        // Rounded rectangle for card
        const x = pos.x - cardWidth / 2
        const y = pos.y - cardHeight / 2
        const radius = 8

        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + cardWidth - radius, y)
        ctx.quadraticCurveTo(x + cardWidth, y, x + cardWidth, y + radius)
        ctx.lineTo(x + cardWidth, y + cardHeight - radius)
        ctx.quadraticCurveTo(x + cardWidth, y + cardHeight, x + cardWidth - radius, y + cardHeight)
        ctx.lineTo(x + radius, y + cardHeight)
        ctx.quadraticCurveTo(x, y + cardHeight, x, y + cardHeight - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Draw icon circle
        const iconRadius = 16
        const iconX = pos.x
        const iconY = pos.y - 15

        ctx.fillStyle = node.isStub ? '#64748b' : '#06b6d4'
        ctx.beginPath()
        ctx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2)
        ctx.fill()

        // Draw icon (simple letter)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.label.charAt(0).toUpperCase(), iconX, iconY)

        // Draw label
        ctx.fillStyle = '#e2e8f0'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const label = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label
        ctx.fillText(label, pos.x, pos.y + 8)

        // Draw attribute count if any
        const attrCount = Object.keys(node.attributes).length
        if (attrCount > 0) {
          ctx.fillStyle = '#64748b'
          ctx.font = '10px sans-serif'
          ctx.fillText(`${attrCount} attrs`, pos.x, pos.y + 22)
        }

        // Draw stub indicator
        if (node.isStub) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px sans-serif'
          ctx.fillText('STUB', pos.x, pos.y + 32)
        }
      })

      animationRef.current = requestAnimationFrame(render)
    }

    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, edges, nodePositions, selectedNodeId])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer"
        style={{ width: '100%', height: '100%' }}
        onClick={handleCanvasClick}
      />

      {/* Node count indicator */}
      {nodes.length > 0 && (
        <div className="absolute top-4 left-4 px-3 py-2 bg-dark-secondary/90 border border-dark rounded-lg text-sm text-slate-300">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-cyber-500" />
              <span>{nodes.length} nodes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-slate-500" />
              <span>{edges.length} edges</span>
            </div>
            {nodes.filter((n) => n.isStub).length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span>{nodes.filter((n) => n.isStub).length} stubs</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Graph Controls */}
      <GraphControls />
    </div>
  )
}

/**
 * Graph control buttons
 */
function GraphControls() {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
      <button
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Zoom in (coming soon)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
      <button
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Zoom out (coming soon)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <button
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Fit to screen (coming soon)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
          />
        </svg>
      </button>
    </div>
  )
}
