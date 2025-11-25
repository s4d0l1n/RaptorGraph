import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Download } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useGraphExport } from '@/hooks/useGraphExport'
import { calculateTimelineLayout } from '@/lib/layouts/timelineLayout'
import { calculateCircleLayout } from '@/lib/layouts/circleLayout'
import { calculateGridLayout } from '@/lib/layouts/gridLayout'
import { calculateConcentricLayout } from '@/lib/layouts/concentricLayout'
import { calculateRandomLayout } from '@/lib/layouts/randomLayout'
import { getVisibleNodesWithGrouping, calculateMetaNodePosition } from '@/lib/grouping'

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
  const { nodes, edges, metaNodes, toggleMetaNodeCollapse } = useGraphStore()
  const { setSelectedNodeId, selectedNodeId, filteredNodeIds } = useUIStore()
  const { layoutConfig } = useProjectStore()
  const { getEdgeTemplateById, getDefaultEdgeTemplate, getCardTemplateById } = useTemplateStore()
  const { exportAsPNG } = useGraphExport()
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [metaNodePositions, setMetaNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [swimlanes, setSwimlanes] = useState<Map<string, number>>(new Map())
  const animationRef = useRef<number>()

  // Memoize visible nodes considering both filtering and grouping
  const visibleNodes = useMemo(() => {
    // First apply filter
    let filtered = filteredNodeIds
      ? nodes.filter((node) => filteredNodeIds.has(node.id))
      : nodes

    // Then apply grouping (hide nodes inside collapsed meta-nodes)
    if (metaNodes.length > 0) {
      filtered = getVisibleNodesWithGrouping(filtered, metaNodes)
    }

    return filtered
  }, [nodes, filteredNodeIds, metaNodes])

  // Memoize stub count to prevent recalculation on every render
  const stubCount = useMemo(() => {
    return nodes.filter((n) => n.isStub).length
  }, [nodes])

  // Memoize export handler
  const handleExport = useCallback(() => {
    exportAsPNG(canvasRef.current, 'raptorgraph-export', 2)
  }, [exportAsPNG])

  // Memoize click handler (handles both nodes and meta-nodes)
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if click is on a meta-node (check these first, they're larger)
    for (const [metaNodeId, pos] of metaNodePositions.entries()) {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
      if (distance < 50) { // Larger hit radius for meta-nodes
        // Toggle collapse/expand
        toggleMetaNodeCollapse(metaNodeId)
        return
      }
    }

    // Check if click is on a regular node
    let clickedNodeId: string | null = null
    for (const [nodeId, pos] of nodePositions.entries()) {
      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
      if (distance < 30) {
        clickedNodeId = nodeId
        break
      }
    }

    setSelectedNodeId(clickedNodeId)
  }, [nodePositions, metaNodePositions, setSelectedNodeId, toggleMetaNodeCollapse])

  // Initialize node positions with memoized layout calculation
  useEffect(() => {
    if (nodes.length === 0) return

    const positions = new Map<string, NodePosition>()
    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    // Apply layout based on configuration
    switch (layoutConfig.type) {
      case 'timeline': {
        const result = calculateTimelineLayout(nodes, {
          width,
          height,
          swimlaneAttribute: layoutConfig.timelineSwimlaneAttribute,
        })
        result.positions.forEach((pos, nodeId) => {
          positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
        })
        setSwimlanes(result.swimlanes)
        break
      }

      case 'circle': {
        const result = calculateCircleLayout(nodes, { width, height })
        result.positions.forEach((pos, nodeId) => {
          positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
        })
        setSwimlanes(new Map())
        break
      }

      case 'grid': {
        const result = calculateGridLayout(nodes, { width, height })
        result.positions.forEach((pos, nodeId) => {
          positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
        })
        setSwimlanes(new Map())
        break
      }

      case 'concentric': {
        const result = calculateConcentricLayout(nodes, edges, { width, height })
        result.positions.forEach((pos, nodeId) => {
          positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
        })
        setSwimlanes(new Map())
        break
      }

      case 'preset':
      case 'fcose':
      case 'dagre':
        // These would require additional libraries or custom implementation
        // Fall back to random layout for now
        {
          const result = calculateRandomLayout(nodes, { width, height })
          result.positions.forEach((pos, nodeId) => {
            positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
          })
          setSwimlanes(new Map())
        }
        break

      default:
        // Default circular layout
        {
          const result = calculateCircleLayout(nodes, { width, height })
          result.positions.forEach((pos, nodeId) => {
            positions.set(nodeId, { ...pos, vx: 0, vy: 0 })
          })
          setSwimlanes(new Map())
        }
    }

    setNodePositions(positions)
  }, [nodes, edges, layoutConfig])

  // Calculate meta-node positions after node positions are set
  useEffect(() => {
    if (metaNodes.length === 0 || nodePositions.size === 0) {
      setMetaNodePositions(new Map())
      return
    }

    const positions = new Map<string, NodePosition>()
    metaNodes.forEach((metaNode) => {
      const pos = calculateMetaNodePosition(metaNode, nodePositions)
      if (pos) {
        positions.set(metaNode.id, { ...pos, vx: 0, vy: 0 })
      }
    })

    setMetaNodePositions(positions)
  }, [metaNodes, nodePositions])

  // Render graph - optimized to only render when dependencies change
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0 || nodePositions.size === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Cancel any existing animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const render = () => {
      // Set canvas size
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight

      // Clear canvas
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw swimlanes if in timeline mode
      if (swimlanes.size > 0) {
        const sortedSwimlanes = Array.from(swimlanes.entries()).sort((a, b) => a[1] - b[1])

        sortedSwimlanes.forEach(([label, yPos], i) => {
          // Draw swimlane background
          const swimlaneHeight = i < sortedSwimlanes.length - 1
            ? sortedSwimlanes[i + 1][1] - yPos
            : canvas.height - yPos

          ctx.fillStyle = i % 2 === 0 ? '#1e293b' : '#0f172a'
          ctx.fillRect(0, yPos - swimlaneHeight / 2, canvas.width, swimlaneHeight)

          // Draw swimlane label
          ctx.fillStyle = '#64748b'
          ctx.font = '12px sans-serif'
          ctx.textAlign = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(label, 10, yPos)

          // Draw horizontal line
          ctx.strokeStyle = '#334155'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(0, yPos - swimlaneHeight / 2)
          ctx.lineTo(canvas.width, yPos - swimlaneHeight / 2)
          ctx.stroke()
        })
      }

      // Draw edges (only if both source and target are visible)
      edges.forEach((edge) => {
        // Skip if either node is filtered out
        if (filteredNodeIds) {
          if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) {
            return
          }
        }

        const sourcePos = nodePositions.get(edge.source)
        const targetPos = nodePositions.get(edge.target)

        if (sourcePos && targetPos) {
          // Get edge template
          const template = edge.edgeTemplateId
            ? getEdgeTemplateById(edge.edgeTemplateId)
            : getDefaultEdgeTemplate()

          // Apply template or use defaults
          const edgeColor = template?.color || '#475569'
          const edgeWidth = template?.width || 2
          const edgeOpacity = template?.opacity ?? 1
          const edgeStyle = template?.style || 'solid'
          const arrowType = template?.arrowType || 'default'
          const edgeLabel = template?.label || edge.label

          // Set line dash array based on style
          if (edgeStyle === 'dashed') {
            ctx.setLineDash([10, 5])
          } else if (edgeStyle === 'dotted') {
            ctx.setLineDash([2, 4])
          } else {
            ctx.setLineDash([])
          }

          // Draw edge line
          ctx.strokeStyle = edgeColor
          ctx.lineWidth = edgeWidth
          ctx.globalAlpha = edgeOpacity

          ctx.beginPath()
          ctx.moveTo(sourcePos.x, sourcePos.y)
          ctx.lineTo(targetPos.x, targetPos.y)
          ctx.stroke()

          // Reset line dash
          ctx.setLineDash([])

          // Draw arrow if not 'none'
          if (arrowType !== 'none') {
            const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x)
            const nodeRadius = 30

            ctx.fillStyle = edgeColor

            if (arrowType === 'default') {
              const arrowSize = 8
              ctx.beginPath()
              ctx.moveTo(
                targetPos.x - nodeRadius * Math.cos(angle),
                targetPos.y - nodeRadius * Math.sin(angle)
              )
              ctx.lineTo(
                targetPos.x - nodeRadius * Math.cos(angle) - arrowSize * Math.cos(angle - Math.PI / 6),
                targetPos.y - nodeRadius * Math.sin(angle) - arrowSize * Math.sin(angle - Math.PI / 6)
              )
              ctx.lineTo(
                targetPos.x - nodeRadius * Math.cos(angle) - arrowSize * Math.cos(angle + Math.PI / 6),
                targetPos.y - nodeRadius * Math.sin(angle) - arrowSize * Math.sin(angle + Math.PI / 6)
              )
              ctx.closePath()
              ctx.fill()
            } else if (arrowType === 'triangle') {
              const arrowSize = 12
              ctx.beginPath()
              ctx.moveTo(
                targetPos.x - nodeRadius * Math.cos(angle),
                targetPos.y - nodeRadius * Math.sin(angle)
              )
              ctx.lineTo(
                targetPos.x - nodeRadius * Math.cos(angle) - arrowSize * Math.cos(angle - Math.PI / 8),
                targetPos.y - nodeRadius * Math.sin(angle) - arrowSize * Math.sin(angle - Math.PI / 8)
              )
              ctx.lineTo(
                targetPos.x - nodeRadius * Math.cos(angle) - arrowSize * Math.cos(angle + Math.PI / 8),
                targetPos.y - nodeRadius * Math.sin(angle) - arrowSize * Math.sin(angle + Math.PI / 8)
              )
              ctx.closePath()
              ctx.fill()
            } else if (arrowType === 'circle') {
              const circleRadius = 4
              ctx.beginPath()
              ctx.arc(
                targetPos.x - nodeRadius * Math.cos(angle),
                targetPos.y - nodeRadius * Math.sin(angle),
                circleRadius,
                0,
                Math.PI * 2
              )
              ctx.fill()
            }
          }

          // Draw label if present
          if (edgeLabel) {
            const midX = (sourcePos.x + targetPos.x) / 2
            const midY = (sourcePos.y + targetPos.y) / 2

            ctx.fillStyle = '#e2e8f0'
            ctx.font = '11px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(edgeLabel, midX, midY - 10)
          }

          // Reset global alpha
          ctx.globalAlpha = 1
        }
      })

      // Draw meta-nodes (collapsed groups)
      metaNodes.forEach((metaNode) => {
        if (!metaNode.collapsed) return // Only draw collapsed meta-nodes

        const pos = metaNodePositions.get(metaNode.id)
        if (!pos) return

        const width = 100
        const height = 80
        const radius = 12

        // Draw background
        ctx.fillStyle = '#1e40af' // Blue for groups
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 3

        // Rounded rectangle
        const x = pos.x - width / 2
        const y = pos.y - height / 2

        ctx.beginPath()
        ctx.moveTo(x + radius, y)
        ctx.lineTo(x + width - radius, y)
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
        ctx.lineTo(x + width, y + height - radius)
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
        ctx.lineTo(x + radius, y + height)
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
        ctx.lineTo(x, y + radius)
        ctx.quadraticCurveTo(x, y, x + radius, y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Draw label
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(metaNode.label, pos.x, pos.y - 10)

        // Draw expand icon
        ctx.fillStyle = '#e2e8f0'
        ctx.font = '10px sans-serif'
        ctx.fillText('Click to expand', pos.x, pos.y + 15)
      })

      // Draw nodes as cards (only visible nodes)
      visibleNodes.forEach((node) => {
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

        // Get card template and render attributes if configured
        const cardTemplate = node.cardTemplateId
          ? getCardTemplateById(node.cardTemplateId)
          : undefined

        if (cardTemplate?.attributeDisplays && cardTemplate.attributeDisplays.length > 0) {
          // Render attributes based on template configuration
          const visibleAttrs = cardTemplate.attributeDisplays
            .filter((attrDisplay) => attrDisplay.visible)
            .sort((a, b) => a.order - b.order)

          let yOffset = pos.y + 24
          const maxAttrsToShow = 3 // Limit to prevent overflow

          visibleAttrs.slice(0, maxAttrsToShow).forEach((attrDisplay) => {
            // Get attribute value
            let attrValue = ''
            if (attrDisplay.attributeName === '__id__') {
              attrValue = node.id
            } else if (node.attributes[attrDisplay.attributeName]) {
              const value = node.attributes[attrDisplay.attributeName]
              attrValue = Array.isArray(value) ? value.join(', ') : value
            }

            if (attrValue) {
              // Apply styling from attribute display configuration
              const fontSize = attrDisplay.fontSize || 10
              const color = attrDisplay.color || '#94a3b8'
              const displayLabel = attrDisplay.displayLabel || attrDisplay.attributeName
              const prefix = attrDisplay.prefix || ''
              const suffix = attrDisplay.suffix || ''

              // Build display text
              const displayText = `${prefix}${displayLabel}: ${attrValue}${suffix}`
              const truncatedText = displayText.length > 20 ? displayText.substring(0, 20) + '...' : displayText

              ctx.fillStyle = color
              ctx.font = `${fontSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillText(truncatedText, pos.x, yOffset)

              yOffset += fontSize + 4
            }
          })

          // Show indicator if there are more attributes
          if (visibleAttrs.length > maxAttrsToShow) {
            ctx.fillStyle = '#64748b'
            ctx.font = '9px sans-serif'
            ctx.fillText(`+${visibleAttrs.length - maxAttrsToShow} more`, pos.x, yOffset)
          }
        } else {
          // Fallback: Draw attribute count if no template
          const attrCount = Object.keys(node.attributes).length
          if (attrCount > 0) {
            ctx.fillStyle = '#64748b'
            ctx.font = '10px sans-serif'
            ctx.fillText(`${attrCount} attrs`, pos.x, pos.y + 22)
          }
        }

        // Draw stub indicator
        if (node.isStub) {
          ctx.fillStyle = '#94a3b8'
          ctx.font = '9px sans-serif'
          ctx.fillText('STUB', pos.x, pos.y + (cardTemplate ? 60 : 32))
        }
      })
    }

    // Render once when dependencies change
    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, edges, nodePositions, selectedNodeId, filteredNodeIds, visibleNodes, swimlanes, metaNodes, metaNodePositions])

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
            {stubCount > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span>{stubCount} stubs</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export button */}
      {nodes.length > 0 && (
        <button
          onClick={handleExport}
          className="absolute top-4 right-4 px-3 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-cyber-400 transition-colors flex items-center gap-2"
          title="Export graph as PNG (2x resolution)"
        >
          <Download className="w-4 h-4" />
          <span>Export PNG</span>
        </button>
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
