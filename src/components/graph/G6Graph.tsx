import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Download, Settings, RotateCcw, RotateCw, Lock, LockOpen, ChevronDown, ChevronUp, Map as MapIcon, Shapes, Info } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useGraphExport } from '@/hooks/useGraphExport'
import { toast } from '@/components/ui/Toast'
import { calculateTimelineLayout } from '@/lib/layouts/timelineLayout'
import { calculateCircleLayout } from '@/lib/layouts/circleLayout'
import { calculateGridLayout } from '@/lib/layouts/gridLayout'
import { calculateConcentricLayout } from '@/lib/layouts/concentricLayout'
import { calculateForceLayout } from '@/lib/layouts/forceLayout'
import { calculateRadialLayout } from '@/lib/layouts/radialLayout'
import { calculateHierarchicalLayout } from '@/lib/layouts/hierarchicalLayout'
import { calculateFruchtermanLayout } from '@/lib/layouts/fruchtermanLayout'
import { calculateKamadaKawaiLayout } from '@/lib/layouts/kamadaKawaiLayout'
import { calculateSpectralLayout } from '@/lib/layouts/spectralLayout'
import { calculateSugiyamaLayout } from '@/lib/layouts/sugiyamaLayout'
import { calculateClusterIslandLayout } from '@/lib/layouts/clusterIslandLayout'
import { getVisibleNodesWithGrouping, calculateMetaNodePosition, transformEdgesForGrouping, applyGridLayoutToGroups } from '@/lib/grouping'
import { evaluateNodeRules, evaluateEdgeRules } from '@/lib/styleEvaluator'
import { useRulesStore } from '@/stores/rulesStore'
import { computeConvexHull, expandHull } from '@/lib/convexHull'
import { Minimap } from './Minimap'

interface NodePosition {
  x: number
  y: number
  vx: number
  vy: number
}

/**
 * Generate RGB color based on time for cycling effect
 */
function getRGBColor(time: number, speed: number): string {
  const hue = (time * speed * 50) % 360
  return `hsl(${hue}, 100%, 50%)`
}

/**
 * Enhanced Canvas Graph Visualization with card-style nodes
 */
export function G6Graph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { nodes, edges, metaNodes } = useGraphStore()
  const { setSelectedNodeId, setSelectedMetaNodeId, selectedNodeId, filteredNodeIds } = useUIStore()
  const { layoutConfig } = useProjectStore()
  const { getEdgeTemplateById, getDefaultEdgeTemplate, getCardTemplateById } = useTemplateStore()
  const { exportAsSVG } = useGraphExport()
  const { getEnabledRules } = useRulesStore()
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [metaNodePositions, setMetaNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [targetNodePositions, setTargetNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [targetMetaNodePositions, setTargetMetaNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [swimlanes, setSwimlanes] = useState<Map<string, number>>(new Map())
  const animationRef = useRef<number>()
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [manuallyPositionedMetaNodes, setManuallyPositionedMetaNodes] = useState<Set<string>>(new Set())
  const [animationTime, setAnimationTime] = useState(0)

  // Default physics parameters
  const defaultPhysicsParams = {
    repulsionStrength: 8000,          // How strongly nodes push apart
    attractionStrength: 0.2,          // How strongly edges pull together
    leafSpringStrength: 0.8,          // How tightly leaves stick to parents
    damping: 0.85,                    // Energy loss per frame (0-1)
    centerGravity: 0.001,             // Weak pull toward canvas center
    nodeChaosFactor: 0,               // Random variation per node (0-100)
  }

  // Physics parameters - adjustable by user
  const [physicsParams, setPhysicsParams] = useState(defaultPhysicsParams)
  const [showPhysicsControls, setShowPhysicsControls] = useState(false)

  // Node deviation factors - each node gets a random multiplier based on chaos factor
  const [nodeDeviationFactors, setNodeDeviationFactors] = useState<Map<string, number>>(new Map())

  // Visualization features
  const [showMinimap, setShowMinimap] = useState(false)
  const [showHulls, setShowHulls] = useState(false)
  const [showGraphInfo, setShowGraphInfo] = useState(false)
  const [clusterHulls, setClusterHulls] = useState<Map<number, { x: number; y: number }[]>>(new Map())

  // View controls
  const [isLocked, setIsLocked] = useState(false)
  const [rotation, setRotation] = useState(0) // in degrees
  const [targetZoom, setTargetZoom] = useState(1)
  const [targetPanOffset, setTargetPanOffset] = useState({ x: 0, y: 0 })
  const [targetRotation, setTargetRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Function to calculate hulls from current node positions (parent-leaf clustering)
  const calculateHullsFromPositions = useCallback((
    currentPositions: Map<string, NodePosition>
  ) => {
    const hulls = new Map<number, { x: number; y: number }[]>()

    // Build adjacency map
    const adjacency = new Map<string, Set<string>>()
    nodes.forEach(node => adjacency.set(node.id, new Set()))
    edges.forEach(edge => {
      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    })

    // Find parent nodes with leaf children
    const processedNodes = new Set<string>()
    let hullId = 0

    nodes.forEach(parentNode => {
      if (processedNodes.has(parentNode.id)) return

      const neighbors = adjacency.get(parentNode.id) || new Set()

      // Find leaf children (degree 1 neighbors)
      const leafChildren: string[] = []
      neighbors.forEach(neighborId => {
        const neighborDegree = adjacency.get(neighborId)?.size || 0
        if (neighborDegree === 1) {
          leafChildren.push(neighborId)
        }
      })

      // Create hull around parent + leaves
      if (leafChildren.length > 0) {
        const groupNodeIds = [parentNode.id, ...leafChildren]
        const groupPoints = groupNodeIds.map(nodeId => {
          const pos = currentPositions.get(nodeId)
          return pos ? { x: pos.x, y: pos.y } : null
        }).filter((p): p is { x: number; y: number } => p !== null)

        if (groupPoints.length >= 3) {
          const hull = computeConvexHull(groupPoints)
          const expandedHull = expandHull(hull, 60)
          hulls.set(hullId++, expandedHull)
        }

        processedNodes.add(parentNode.id)
        leafChildren.forEach(leafId => processedNodes.add(leafId))
      }
    })

    return hulls
  }, [nodes, edges])

  // Memoize visible nodes considering both filtering and grouping
  const visibleNodes = useMemo(() => {
    let filtered = nodes

    // Check if there's an actual filter (not just all nodes)
    const hasRealFilter = filteredNodeIds && filteredNodeIds.size > 0 && filteredNodeIds.size < nodes.length

    // Apply grouping (hide nodes in collapsed groups, unless they match search)
    if (metaNodes.length > 0) {
      const activeFilter = hasRealFilter ? filteredNodeIds : undefined
      filtered = getVisibleNodesWithGrouping(filtered, metaNodes, activeFilter)
    }

    // If search is active, filter to only matching nodes
    if (hasRealFilter) {
      filtered = filtered.filter((node) => filteredNodeIds!.has(node.id))
    }

    return filtered
  }, [nodes, filteredNodeIds, metaNodes])

  // Memoize visible edges (for minimap)
  const visibleEdges = useMemo(() => {
    if (!filteredNodeIds || filteredNodeIds.size === 0) {
      return edges
    }
    // Only show edges where both source and target are visible
    return edges.filter(edge =>
      filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    )
  }, [edges, filteredNodeIds])

  // Memoize visible meta-nodes (only show meta-nodes that have at least one filtered child)
  const visibleMetaNodes = useMemo(() => {
    if (!filteredNodeIds || filteredNodeIds.size === 0) {
      // No filter active, show all meta-nodes
      return metaNodes
    }

    // Filter meta-nodes to only show those with at least one visible child
    return metaNodes.filter((metaNode) => {
      return metaNode.childNodeIds.some((childId) => filteredNodeIds.has(childId))
    })
  }, [metaNodes, filteredNodeIds])

  // Calculate node deviation factors when nodes or chaos factor changes
  useEffect(() => {
    const newDeviations = new Map<string, number>()

    nodes.forEach((node) => {
      // Store a random factor between -1 and 1 for each node
      // This will be multiplied by chaos% and max value when applied
      const randomFactor = (Math.random() * 2 - 1) // random between -1 and 1
      newDeviations.set(node.id, randomFactor)
    })

    setNodeDeviationFactors(newDeviations)
  }, [nodes, physicsParams.nodeChaosFactor])

  // Smooth animation for view changes (zoom, pan, rotation)
  useEffect(() => {
    if (!isAnimating) return

    const animationDuration = 300 // ms
    const startTime = Date.now()
    const startZoom = zoom
    const startPan = { ...panOffset }
    const startRotation = rotation

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / animationDuration, 1)

      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3)

      // Interpolate values
      setZoom(startZoom + (targetZoom - startZoom) * eased)
      setPanOffset({
        x: startPan.x + (targetPanOffset.x - startPan.x) * eased,
        y: startPan.y + (targetPanOffset.y - startPan.y) * eased,
      })
      setRotation(startRotation + (targetRotation - startRotation) * eased)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setIsAnimating(false)
      }
    }

    requestAnimationFrame(animate)
  }, [isAnimating, targetZoom, targetPanOffset, targetRotation])

  // Memoize transformed edges for rendering with grouping
  const transformedEdges = useMemo(() => {
    if (visibleMetaNodes.length === 0) {
      // No grouping, return edges as-is
      return edges.map((edge) => ({
        originalSource: edge.source,
        originalTarget: edge.target,
        renderSource: edge.source,
        renderTarget: edge.target,
        shouldRender: true,
        sourceIsMetaNode: false,
        targetIsMetaNode: false,
        edge,
      }))
    }

    return transformEdgesForGrouping(edges, visibleMetaNodes)
  }, [edges, visibleMetaNodes])

  // Memoize stub count to prevent recalculation on every render
  const stubCount = useMemo(() => {
    return nodes.filter((n) => n.isStub).length
  }, [nodes])

  // Memoize export handler - exports full graph as SVG
  const handleExport = useCallback(() => {
    if (nodes.length === 0 || nodePositions.size === 0) return

    // Compute styles for all nodes
    const nodeStyles = new Map<string, any>()
    const rules = getEnabledRules()

    nodes.forEach((node) => {
      const ruleResult = evaluateNodeRules(node, rules)
      const templateId = ruleResult.cardTemplateId || node.cardTemplateId
      const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined

      nodeStyles.set(node.id, {
        backgroundColor: cardTemplate?.backgroundColor || (node.isStub ? '#1e293b' : '#0f172a'),
        borderColor: cardTemplate?.borderColor || (node.isStub ? '#475569' : '#0891b2'),
        borderWidth: cardTemplate?.borderWidth || 2,
        textColor: '#e2e8f0',
      })
    })

    // Compute styles for all edges
    const edgeStyles = new Map<string, any>()

    edges.forEach((edge) => {
      const ruleResult = evaluateEdgeRules(edge, rules)
      const templateId = ruleResult.edgeTemplateId || edge.edgeTemplateId
      const template = templateId ? getEdgeTemplateById(templateId) : getDefaultEdgeTemplate()

      edgeStyles.set(edge.id, {
        color: template?.color || '#475569',
        thickness: template?.width || 2,
        opacity: template?.opacity ?? 0.5,
        style: template?.style || 'solid',
      })
    })

    const canvas = canvasRef.current
    if (!canvas) return

    // Export as SVG with current view state
    exportAsSVG(
      nodes,
      edges,
      metaNodes,
      nodePositions,
      metaNodePositions,
      nodeStyles,
      edgeStyles,
      canvas.width,
      canvas.height,
      zoom,
      panOffset,
      rotation,
      'raptorgraph-export'
    )
  }, [nodes, edges, metaNodes, nodePositions, metaNodePositions, getEnabledRules, getCardTemplateById, getEdgeTemplateById, getDefaultEdgeTemplate, exportAsSVG, zoom, panOffset, rotation])

  // Handler to rerun physics layout - reset everything like a refresh
  const handleRerunLayout = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || nodes.length === 0) return

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    // Recalculate layout from scratch with current physics parameters
    const layoutResult = calculateClusterIslandLayout(nodes, edges, {
      width,
      height,
      iterations: 300,
      intraClusterAttraction: 0.05,
      intraClusterRepulsion: 3000,
      leafRadialForce: 0.3,
      interClusterRepulsion: 150000,
      minClusterDistance: 600,
      centerGravity: 0.001,
    })

    // Reset positions to new layout
    setNodePositions((prev) => {
      const newPositions = new Map<string, NodePosition>()
      layoutResult.positions.forEach((pos, nodeId) => {
        newPositions.set(nodeId, {
          x: pos.x,
          y: pos.y,
          vx: 0,
          vy: 0,
        })
      })
      return newPositions
    })

    // Reset iteration counter and max iterations to restart physics simulation
    setIterationCount(0)
    setMaxIterations(500)
  }, [nodes, edges])

  const handleContinuePhysics = useCallback(() => {
    // Add 100 more iterations to continue physics from current state
    setMaxIterations(prev => prev + 100)
  }, [])

  // Mouse event handlers for dragging and panning
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top - panOffset.y) / zoom

    // If space key is pressed or middle mouse button, start panning
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
      e.preventDefault()
      return
    }

    // If locked, don't allow node dragging
    if (isLocked) {
      return
    }

    // Check if mouse is over a meta-node first (they're larger)
    for (const [metaNodeId, pos] of metaNodePositions.entries()) {
      const metaNode = visibleMetaNodes.find((mn) => mn.id === metaNodeId)
      if (!metaNode) continue

      if (metaNode.collapsed) {
        // Collapsed meta-node - check full bounding box
        const nodeCount = metaNode.childNodeIds.length
        const cols = Math.min(6, Math.ceil(Math.sqrt(nodeCount * 1.5))) // Wider rectangles
        const rows = Math.ceil(nodeCount / cols)
        const cardWidth = 120
        const cardHeight = 60
        const spacing = 15
        const padding = 25
        const headerHeight = 0 // No header
        const containerWidth = Math.max(200, cols * (cardWidth + spacing) - spacing + padding * 2)
        const containerHeight = rows * (cardHeight + spacing) - spacing + padding * 2 + headerHeight

        const containerX = pos.x - containerWidth / 2
        const containerY = pos.y - containerHeight / 2

        // Check if mouse is within bounding box
        if (
          x >= containerX &&
          x <= containerX + containerWidth &&
          y >= containerY &&
          y <= containerY + containerHeight
        ) {
          setDraggedNodeId(metaNodeId)
          setDragOffset({ x: x - pos.x, y: y - pos.y })
          return
        }
      } else {
        // Expanded meta-node - check badge area
        const badgeWidth = 140
        const badgeHeight = 30
        const badgeX = pos.x - badgeWidth / 2
        const badgeY = pos.y - badgeHeight / 2

        if (
          x >= badgeX &&
          x <= badgeX + badgeWidth &&
          y >= badgeY &&
          y <= badgeY + badgeHeight
        ) {
          setDraggedNodeId(metaNodeId)
          setDragOffset({ x: x - pos.x, y: y - pos.y })
          return
        }
      }
    }

    // Check if mouse is over a regular node (skip nodes inside collapsed meta-nodes)
    for (const [nodeId, pos] of nodePositions.entries()) {
      // Skip if this node is inside a collapsed meta-node
      const isInsideCollapsedMetaNode = metaNodes.some(
        (mn) => mn.collapsed && mn.childNodeIds.includes(nodeId)
      )
      if (isInsideCollapsedMetaNode) continue

      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2)
      if (distance < 60) { // Hit radius for card nodes
        setDraggedNodeId(nodeId)
        setDragOffset({ x: x - pos.x, y: y - pos.y })
        return
      }
    }

    // If not over a node, start panning
    setIsPanning(true)
    setPanStart({ x: e.clientX, y: e.clientY })
  }, [nodePositions, metaNodePositions, panOffset, zoom, isLocked, visibleMetaNodes, metaNodes])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()

    // Handle panning
    if (isPanning) {
      const dx = e.clientX - panStart.x
      const dy = e.clientY - panStart.y
      setPanOffset((prev) => ({
        x: prev.x + dx,
        y: prev.y + dy,
      }))
      setPanStart({ x: e.clientX, y: e.clientY })
      return
    }

    // Handle node/meta-node dragging
    if (draggedNodeId) {
      const x = (e.clientX - rect.left - panOffset.x) / zoom
      const y = (e.clientY - rect.top - panOffset.y) / zoom

      // Check if dragging a meta-node
      const isMetaNode = metaNodePositions.has(draggedNodeId)

      if (isMetaNode) {
        // Update meta-node position and mark as manually positioned
        const newX = x - dragOffset.x
        const newY = y - dragOffset.y

        setMetaNodePositions((prev) => {
          const newPositions = new Map(prev)
          const currentPos = newPositions.get(draggedNodeId)
          if (currentPos) {
            newPositions.set(draggedNodeId, {
              ...currentPos,
              x: newX,
              y: newY,
            })
          }
          return newPositions
        })

        // Update target position so it doesn't snap back
        setTargetMetaNodePositions((prev) => {
          const newTargets = new Map(prev)
          newTargets.set(draggedNodeId, { x: newX, y: newY })
          return newTargets
        })

        // Mark this meta-node as manually positioned
        setManuallyPositionedMetaNodes((prev) => {
          const newSet = new Set(prev)
          newSet.add(draggedNodeId)
          return newSet
        })
      } else {
        // Update regular node position
        const newX = x - dragOffset.x
        const newY = y - dragOffset.y

        // Find if this node belongs to a group (meta-node)
        const belongsToGroup = metaNodes.find(mn => mn.childNodeIds.includes(draggedNodeId))

        setNodePositions((prev) => {
          const newPositions = new Map(prev)
          const currentPos = newPositions.get(draggedNodeId)

          if (currentPos) {
            // Calculate the offset from the old position
            const dx = newX - currentPos.x
            const dy = newY - currentPos.y

            // If part of a group, move all nodes in the group together (marching band)
            if (belongsToGroup) {
              belongsToGroup.childNodeIds.forEach(nodeId => {
                const nodePos = newPositions.get(nodeId)
                if (nodePos) {
                  newPositions.set(nodeId, {
                    ...nodePos,
                    x: nodePos.x + dx,
                    y: nodePos.y + dy,
                  })
                }
              })
            } else {
              // Just move this single node
              newPositions.set(draggedNodeId, {
                ...currentPos,
                x: newX,
                y: newY,
              })
            }
          }
          return newPositions
        })

        // Update target positions so they don't snap back
        setTargetNodePositions((prev) => {
          const newTargets = new Map(prev)

          if (belongsToGroup) {
            const currentPos = nodePositions.get(draggedNodeId)
            if (currentPos) {
              const dx = newX - currentPos.x
              const dy = newY - currentPos.y

              belongsToGroup.childNodeIds.forEach(nodeId => {
                const nodePos = nodePositions.get(nodeId)
                if (nodePos) {
                  newTargets.set(nodeId, {
                    x: nodePos.x + dx,
                    y: nodePos.y + dy,
                  })
                }
              })
            }
          } else {
            newTargets.set(draggedNodeId, { x: newX, y: newY })
          }

          return newTargets
        })
      }

      // Request animation frame for smooth rendering during drag
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draggedNodeId, dragOffset, isPanning, panStart, panOffset, zoom, metaNodePositions, metaNodes, nodePositions])

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (!draggedNodeId) return

    // If no significant drag occurred, treat it as a click
    const canvas = canvasRef.current
    if (!canvas) {
      setDraggedNodeId(null)
      return
    }

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left - panOffset.x) / zoom
    const y = (e.clientY - rect.top - panOffset.y) / zoom

    // Check if draggedNodeId is a meta-node or regular node
    const pos = nodePositions.get(draggedNodeId) || metaNodePositions.get(draggedNodeId)
    if (pos) {
      const dragDistance = Math.sqrt((x - pos.x - dragOffset.x) ** 2 + (y - pos.y - dragOffset.y) ** 2)

      // If drag distance is small (less than 3 pixels), treat as click
      if (dragDistance < 3) {
        // Only open detail panel on true clicks, not drags
        // Check if this is a meta-node click
        const isMetaNodeId = metaNodePositions.has(draggedNodeId)

        if (isMetaNodeId) {
          // Clicked a meta-node - select it
          setSelectedMetaNodeId(draggedNodeId)
        } else {
          // Clicked a regular node - select it
          setSelectedNodeId(draggedNodeId)
        }
      }
    }

    setDraggedNodeId(null)
  }, [draggedNodeId, nodePositions, dragOffset, metaNodePositions, metaNodes, setSelectedNodeId, setSelectedMetaNodeId, isPanning, panOffset, zoom])

  // Handle mouse wheel for zooming - zoom towards cursor
  // Note: Using useEffect to attach with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      // More granular zoom: smaller steps for smoother zooming
      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05 // 5% per scroll

      // Calculate mouse position in canvas coordinates
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      setZoom((prevZoom) => {
        const newZoom = Math.max(0.1, Math.min(5, prevZoom * zoomFactor))

        // Use setPanOffset callback to get current panOffset value
        setPanOffset((currentPanOffset) => {
          // Calculate the point in graph space that the mouse is over (before zoom)
          const graphX = (mouseX - currentPanOffset.x) / prevZoom
          const graphY = (mouseY - currentPanOffset.y) / prevZoom

          // Calculate new pan offset to keep that point under the mouse (after zoom)
          const newPanX = mouseX - graphX * newZoom
          const newPanY = mouseY - graphY * newZoom

          return { x: newPanX, y: newPanY }
        })

        return newZoom
      })
    }

    // Add event listener with passive: false to allow preventDefault
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, []) // Empty deps - event listener only registered once

  // Initialize node positions with memoized layout calculation
  useEffect(() => {
    if (nodes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    // CLUSTER ISLAND LAYOUT: Use two-tier physics to create distinct cluster islands
    // This replaces random initialization with intelligent cluster-based positioning

    setNodePositions((prev) => {
      const newPositions = new Map<string, NodePosition>()

      // Check if we have existing positions (e.g., from previous layout)
      const hasExistingPositions = prev.size > 0

      if (hasExistingPositions) {
        // Keep existing positions for nodes that haven't changed
        nodes.forEach((node) => {
          const existing = prev.get(node.id)
          if (existing) {
            newPositions.set(node.id, existing)
          }
        })

        // Only calculate layout for new nodes
        const newNodes = nodes.filter(node => !prev.has(node.id))
        if (newNodes.length > 0) {
          // Add new nodes near cluster centroids
          newNodes.forEach((node) => {
            newPositions.set(node.id, {
              x: width / 2 + (Math.random() - 0.5) * 200,
              y: height / 2 + (Math.random() - 0.5) * 200,
              vx: 0,
              vy: 0,
            })
          })
        }
      } else {
        // First time initialization
        let layoutPositions: Map<string, { x: number; y: number }>

        // If we have meta-nodes (groups), use Fruchterman layout for each group
        if (metaNodes.length > 0) {
          layoutPositions = applyGridLayoutToGroups(nodes, edges, metaNodes, width, height)
        } else {
          // Otherwise use cluster island layout
          const layoutResult = calculateClusterIslandLayout(nodes, edges, {
            width,
            height,
            iterations: 300,
            intraClusterAttraction: physicsParams.intraClusterAttraction,
            intraClusterRepulsion: 3000,
            leafRadialForce: physicsParams.leafRadialForce,
            interClusterRepulsion: physicsParams.interClusterRepulsion,
            minClusterDistance: physicsParams.minClusterDistance,
            centerGravity: 0.001,
          })
          layoutPositions = layoutResult.positions
        }

        layoutPositions.forEach((pos, nodeId) => {
          newPositions.set(nodeId, {
            x: pos.x,
            y: pos.y,
            vx: 0,
            vy: 0,
          })
        })

        // Calculate convex hulls for parent-leaf clustering (for hulls button)
        const hulls = new Map<number, { x: number; y: number }[]>()

        const adjacency = new Map<string, Set<string>>()
        nodes.forEach(node => adjacency.set(node.id, new Set()))
        edges.forEach(edge => {
          adjacency.get(edge.source)?.add(edge.target)
          adjacency.get(edge.target)?.add(edge.source)
        })

        const processedNodes = new Set<string>()
        let hullId = 0

        nodes.forEach(parentNode => {
          if (processedNodes.has(parentNode.id)) return

          const neighbors = adjacency.get(parentNode.id) || new Set()

          const leafChildren: string[] = []
          neighbors.forEach(neighborId => {
            const neighborDegree = adjacency.get(neighborId)?.size || 0
            if (neighborDegree === 1) {
              leafChildren.push(neighborId)
            }
          })

          if (leafChildren.length > 0) {
            const groupNodeIds = [parentNode.id, ...leafChildren]
            const groupPoints = groupNodeIds.map(nodeId => {
              const pos = layoutPositions.get(nodeId)
              return pos ? { x: pos.x, y: pos.y } : null
            }).filter((p): p is { x: number; y: number } => p !== null)

            if (groupPoints.length >= 3) {
              const hull = computeConvexHull(groupPoints)
              const expandedHull = expandHull(hull, 60)
              hulls.set(hullId++, expandedHull)
            }

            processedNodes.add(parentNode.id)
            leafChildren.forEach(leafId => processedNodes.add(leafId))
          }
        })

        setClusterHulls(hulls)
      }

      return newPositions
    })

    setSwimlanes(new Map())
  }, [nodes, edges, layoutConfig, physicsParams, metaNodes])

  // Calculate meta-node positions after node positions are set
  useEffect(() => {
    if (metaNodes.length === 0 || nodePositions.size === 0) {
      setMetaNodePositions(new Map())
      setTargetMetaNodePositions(new Map())
      setManuallyPositionedMetaNodes(new Set()) // Clear manual positioning when no meta-nodes
      return
    }

    // Clean up manually positioned set - remove IDs that no longer exist
    const currentMetaNodeIds = new Set(metaNodes.map((mn) => mn.id))
    setManuallyPositionedMetaNodes((prev) => {
      const cleaned = new Set<string>()
      prev.forEach((id) => {
        if (currentMetaNodeIds.has(id)) {
          cleaned.add(id)
        }
      })
      return cleaned
    })

    // Calculate target positions for meta-nodes
    const targets = new Map<string, { x: number; y: number }>()

    visibleMetaNodes.forEach((metaNode) => {
      // Don't calculate target for manually positioned meta-nodes
      if (manuallyPositionedMetaNodes.has(metaNode.id)) {
        return
      }

      // Calculate position from child nodes
      const pos = calculateMetaNodePosition(metaNode, nodePositions)
      if (pos) {
        targets.set(metaNode.id, pos)
      }
    })

    setTargetMetaNodePositions(targets)

    // Initialize or update meta-node positions
    setMetaNodePositions((prevPositions) => {
      const positions = new Map<string, NodePosition>()

      visibleMetaNodes.forEach((metaNode) => {
        // Check if this meta-node has been manually positioned
        if (manuallyPositionedMetaNodes.has(metaNode.id)) {
          // Preserve the manually set position
          const existingPos = prevPositions.get(metaNode.id)
          if (existingPos) {
            positions.set(metaNode.id, existingPos)
            return
          }
        }

        const target = targets.get(metaNode.id)
        if (target) {
          const existing = prevPositions.get(metaNode.id)
          if (existing) {
            // Keep existing position for smooth animation
            positions.set(metaNode.id, existing)
          } else {
            // New meta-node - start at target position
            positions.set(metaNode.id, { x: target.x, y: target.y, vx: 0, vy: 0 })
          }
        }
      })

      return positions
    })
  }, [metaNodes, visibleMetaNodes, nodePositions, manuallyPositionedMetaNodes])

  // Track simulation state - FOUR PHASES
  const [iterationCount, setIterationCount] = useState(0)
  const [maxIterations, setMaxIterations] = useState(500)
  const phase1Iterations = 250  // Explosion phase - push clusters apart
  const phase2Iterations = 100  // Leaf retraction - pull leaves closer
  const phase3Iterations = 100  // Non-overlap enforcement phase
  const phase4Iterations = 50   // Final leaf snap - ultra-tight leaf positioning

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
      // Update animation time for effects
      setAnimationTime((prev) => prev + 0.016) // Assuming ~60fps
      setIterationCount((prev) => Math.min(prev + 1, maxIterations))

      // FORCE-DIRECTED LAYOUT: Fruchterman-Reingold with family-based spacing
      setNodePositions((prev) => {
        const updated = new Map<string, NodePosition>()
        const canvas = canvasRef.current
        if (!canvas) return prev

        // Build adjacency map (needed for drag physics)
        const adjacency = new Map<string, Set<string>>()
        const nodeMap = new Map(nodes.map(n => [n.id, n]))
        nodes.forEach(n => adjacency.set(n.id, new Set()))
        edges.forEach(edge => {
          adjacency.get(edge.source)?.add(edge.target)
          adjacency.get(edge.target)?.add(edge.source)
        })

        // Node sizing constants (used by drag physics and main physics)
        const nodeRadius = 60
        const minDistance = nodeRadius * 2.5

        // FOUR-PHASE LAYOUT APPROACH:
        // Phase 1 (0-250): Explosion - push clusters apart, leaves spread with parents
        // Phase 2 (250-350): Leaf retraction - pull leaves closer to parents
        // Phase 3 (350-450): Non-overlap enforcement - create clean spacing
        // Phase 4 (450-500): Final leaf snap - ultra-tight leaf positioning, creating hallways

        if (iterationCount >= maxIterations) {
          // After all phases complete, only handle dragging
          if (draggedNodeId) {
            const updated = new Map<string, NodePosition>()
            prev.forEach((pos, id) => updated.set(id, { ...pos }))
            const draggedPos = prev.get(draggedNodeId)
            if (draggedPos) {
              const connectedNodes = adjacency.get(draggedNodeId) || new Set()

              // Apply spring force to all directly connected nodes
              connectedNodes.forEach(connectedId => {
                const connectedPos = prev.get(connectedId)
                if (!connectedPos) return

                // Calculate spring force toward dragged node
                const dx = draggedPos.x - connectedPos.x
                const dy = draggedPos.y - connectedPos.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist > 0) {
                  const idealLength = 150
                  const stretch = dist - idealLength
                  const springForce = stretch * 0.12 // Spring strength

                  const forceX = (dx / dist) * springForce
                  const forceY = (dy / dist) * springForce

                  // Apply with damping
                  const damping = 0.4
                  const newX = connectedPos.x + forceX * damping
                  const newY = connectedPos.y + forceY * damping

                  updated.set(connectedId, {
                    x: newX,
                    y: newY,
                    vx: forceX * damping,
                    vy: forceY * damping
                  })
                }
              })

              // OVERLAP PREVENTION during drag - check ALL nodes (dragged + connected) against ALL other nodes
              const movingNodeIds = new Set([draggedNodeId, ...Array.from(connectedNodes)])
              const maxPasses = 5

              for (let pass = 0; pass < maxPasses; pass++) {
                let hadOverlap = false

                // Check all moving nodes against all other nodes
                movingNodeIds.forEach(nodeId1 => {
                  const pos1 = updated.get(nodeId1)
                  if (!pos1) return

                  updated.forEach((pos2, nodeId2) => {
                    // Skip self comparisons
                    if (nodeId1 === nodeId2) return

                    const dx = pos2.x - pos1.x
                    const dy = pos2.y - pos1.y
                    const dist = Math.sqrt(dx * dx + dy * dy)

                    if (dist < minDistance && dist > 0) {
                      hadOverlap = true
                      const overlap = minDistance - dist
                      const pushDist = overlap / 2
                      const nx = dx / dist
                      const ny = dy / dist

                      // If node1 is moving (dragged or connected), push it
                      if (movingNodeIds.has(nodeId1) && nodeId1 !== draggedNodeId) {
                        pos1.x -= nx * pushDist
                        pos1.y -= ny * pushDist
                      }

                      // If node2 is also moving, push it too
                      if (movingNodeIds.has(nodeId2) && nodeId2 !== draggedNodeId) {
                        pos2.x += nx * pushDist
                        pos2.y += ny * pushDist
                      }

                      // If node2 is NOT moving, push node1 more
                      if (!movingNodeIds.has(nodeId2) && nodeId1 !== draggedNodeId) {
                        pos1.x -= nx * pushDist
                        pos1.y -= ny * pushDist
                      }
                    }
                  })
                })

                // Early exit if no overlaps found
                if (!hadOverlap) break
              }

              // Check if any positions actually changed (prevent infinite loop)
              let hasChanges = false
              updated.forEach((pos, id) => {
                const oldPos = prev.get(id)
                if (!oldPos || Math.abs(pos.x - oldPos.x) > 0.01 || Math.abs(pos.y - oldPos.y) > 0.01) {
                  hasChanges = true
                }
              })

              if (hasChanges) {
                return updated
              }
            }

            return updated
          }
          return prev
        }

        // ================================================================
        // PROFESSIONAL FORCE-DIRECTED LAYOUT
        // Four forces: attraction (edges), repulsion (all), collision, centering
        // ================================================================

        const area = canvas.width * canvas.height
        const nodeCount = nodes.length
        const k = Math.sqrt(area / nodeCount) // Optimal spacing

        // Temperature for simulated annealing
        const progress = iterationCount / maxIterations
        const temperature = k * Math.pow(1 - progress, 2)

        // Initialize displacements map
        const displacements = new Map<string, { x: number; y: number }>()

        // Determine current phase
        const currentPhase = iterationCount < phase1Iterations ? 1
          : iterationCount < phase1Iterations + phase2Iterations ? 2
          : iterationCount < phase1Iterations + phase2Iterations + phase3Iterations ? 3
          : 4

        // Calculate forces for all nodes uniformly
        nodes.forEach(node => {
          const pos = prev.get(node.id)
          if (!pos) return

          // If this is the dragged node, keep it at its current position
          if (draggedNodeId === node.id) {
            updated.set(node.id, { ...pos, vx: 0, vy: 0 })
            return
          }

          let fx = 0
          let fy = 0

          const neighbors = adjacency.get(node.id) || new Set()
          const nodeDegree = neighbors.size
          const isLeaf = nodeDegree === 1

          // PHASE-SPECIFIC FORCE ADJUSTMENTS
          // Phase 1: Explosion - weak leaf attraction, let everything spread
          // Phase 2: Leaf retraction - medium-strong attraction, pull leaves closer
          // Phase 3: Non-overlap - maintain spacing, continue leaf attraction
          // Phase 4: Final snap - EXTREMELY strong leaf attraction to create hallways

          // FORCE 1: Attractive Springs (Edge Connections Only)
          neighbors.forEach(neighborId => {
            const neighborPos = prev.get(neighborId)
            if (!neighborPos) return

            const neighborDegree = (adjacency.get(neighborId) || new Set()).size
            const neighborIsLeaf = neighborDegree === 1

            // If either node is a leaf, use special spring
            const isLeafConnection = isLeaf || neighborIsLeaf

            let idealLength: number
            let springStrength: number

            if (isLeafConnection) {
              // PHASE-DEPENDENT leaf spring parameters (scaled by user parameter)
              const leafMultiplier = physicsParams.leafSpringStrength
              if (currentPhase === 1) {
                // Phase 1: Medium springs, let leaves spread with parents during explosion
                idealLength = 60   // Closer than normal connections (vs 120px)
                springStrength = 0.5 * leafMultiplier
              } else if (currentPhase === 2) {
                // Phase 2: Strong retraction, pull leaves significantly closer
                idealLength = 40   // Pull closer to parent
                springStrength = 2.0 * leafMultiplier
              } else if (currentPhase === 3) {
                // Phase 3: Continue pulling leaves closer while maintaining spacing
                idealLength = 20   // Very close - collision will prevent overlap
                springStrength = 8.0 * leafMultiplier
              } else {
                // Phase 4: EXTREMELY strong final snap - as close as collision allows
                idealLength = 5   // Extremely small - leaves try to get as close as possible
                springStrength = 20.0 * leafMultiplier
              }
            } else {
              // Normal connections: standard spring parameters (scaled by user parameter)
              idealLength = 120  // Structural connections only

              // Apply node chaos: add a percentage of MAX attraction based on each node's random factor
              const nodeRandomFactor = nodeDeviationFactors.get(node.id) || 0
              const neighborRandomFactor = nodeDeviationFactors.get(neighborId) || 0
              const averageRandomFactor = (nodeRandomFactor + neighborRandomFactor) / 2

              // Start with base spring strength
              springStrength = 0.2 * physicsParams.attractionStrength

              // Add chaos: ±(chaos% of MAX_ATTRACTION) based on random factor
              const MAX_ATTRACTION = 2.0
              const MIN_ATTRACTION = 0.01
              const chaosAmount = averageRandomFactor * (physicsParams.nodeChaosFactor / 100) * MAX_ATTRACTION
              springStrength = Math.max(MIN_ATTRACTION, springStrength + chaosAmount)
            }

            const dx = neighborPos.x - pos.x
            const dy = neighborPos.y - pos.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 0) {
              // Hooke's law: F = k * (distance - idealLength)
              const stretch = distance - idealLength
              const force = stretch * springStrength

              fx += (dx / distance) * force
              fy += (dy / distance) * force
            }
          })

          // FORCE 1b: Additional Attractive Force for Leaf Nodes to Parent
          // Progressively stronger in phases 2-4
          if (currentPhase >= 2 && isLeaf && neighbors.size === 1) {
            const parentId = Array.from(neighbors)[0]
            const parentPos = prev.get(parentId)

            if (parentPos) {
              const dx = parentPos.x - pos.x
              const dy = parentPos.y - pos.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance > 0) {
                // Progressive magnetic attraction: starts in phase 2, increases each phase
                // Goal: push leaves as close as collision allows
                let attractionStrength: number
                if (currentPhase === 2) {
                  attractionStrength = 1.5  // Start pulling in phase 2
                } else if (currentPhase === 3) {
                  attractionStrength = 5.0  // Strong in phase 3 - push toward collision boundary
                } else {
                  attractionStrength = 10.0  // EXTREMELY strong in phase 4 - press against collision
                }

                const force = attractionStrength * distance

                fx += (dx / distance) * force
                fy += (dy / distance) * force
              }
            }
          }

          // FORCE 2: Strong Electrostatic Repulsion (Non-Leaf Nodes Only)
          // Dramatically increased repulsion for hubs/core nodes
          // Leaves get almost no repulsion so they don't push their parent away
          // IMPORTANT: Siblings (nodes sharing a parent) don't repel each other
          nodes.forEach(otherNode => {
            if (otherNode.id === node.id) return

            const otherPos = prev.get(otherNode.id)
            if (!otherPos) return

            const otherNeighbors = adjacency.get(otherNode.id) || new Set()
            const otherDegree = otherNeighbors.size
            const otherIsLeaf = otherDegree === 1

            // Check if they're siblings (share at least one common parent)
            const sharedParents = [...neighbors].filter(n => otherNeighbors.has(n))
            if (sharedParents.length > 0) {
              // Siblings don't repel - they cluster around their shared parent(s)
              return
            }

            const dx = pos.x - otherPos.x
            const dy = pos.y - otherPos.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance > 0) {
              // MASSIVELY increased base repulsion to blast clusters apart
              // Add LARGE variation based on node IDs for organic, non-uniform spacing
              const nodeHash = (node.id.charCodeAt(0) + otherNode.id.charCodeAt(0)) % 100
              const repulsionVariation = 0.5 + (nodeHash / 100) * 1.0  // 0.5 to 1.5 range (50%-150%)

              // Apply node chaos: add a percentage of MAX repulsion based on each node's random factor
              const nodeRandomFactor = nodeDeviationFactors.get(node.id) || 0
              const otherRandomFactor = nodeDeviationFactors.get(otherNode.id) || 0
              const averageRandomFactor = (nodeRandomFactor + otherRandomFactor) / 2

              // Start with base repulsion * variation
              let repulsionStrength = physicsParams.repulsionStrength * repulsionVariation

              // Add chaos: ±(chaos% of MAX_REPULSION) based on random factor
              const MAX_REPULSION = 30000
              const MIN_REPULSION = 1000
              const chaosAmount = averageRandomFactor * (physicsParams.nodeChaosFactor / 100) * MAX_REPULSION
              repulsionStrength = Math.max(MIN_REPULSION, repulsionStrength + chaosAmount)

              // Leaves get almost no repulsion charge (don't push parent away)
              if (isLeaf) {
                repulsionStrength *= 0.02  // 2% strength for leaves
              }
              if (otherIsLeaf) {
                repulsionStrength *= 0.02  // 2% strength if other is leaf
              }

              // FORCE 2b: Leaf-Parent Magnetic Repulsion
              // Nodes with many leaves repel other nodes with leaves
              // Like two north-end magnets pushing each other apart
              // ENHANCED: Stronger to prevent hull group overlaps
              if (!isLeaf && !otherIsLeaf) {
                // Count leaf children for both nodes
                let myLeafCount = 0
                neighbors.forEach(neighborId => {
                  const neighborDegree = (adjacency.get(neighborId) || new Set()).size
                  if (neighborDegree === 1) myLeafCount++
                })

                let otherLeafCount = 0
                otherNeighbors.forEach(neighborId => {
                  const neighborDegree = (adjacency.get(neighborId) || new Set()).size
                  if (neighborDegree === 1) otherLeafCount++
                })

                // If both nodes have leaves, add VERY STRONG extra repulsion proportional to leaf counts
                // This ensures hull groups maintain clear separation
                if (myLeafCount > 0 && otherLeafCount > 0) {
                  // Magnetic repulsion: more leaves = stronger push
                  // Increased multiplier from 0.3 to 1.0 for much stronger separation
                  const leafRepulsionMultiplier = Math.sqrt(myLeafCount * otherLeafCount) * 1.0
                  repulsionStrength *= (1 + leafRepulsionMultiplier)

                  // Add distance-based boost: push harder when groups are close
                  const criticalDistance = 300 // Distance threshold
                  if (distance < criticalDistance) {
                    const proximityBoost = (criticalDistance - distance) / criticalDistance
                    repulsionStrength *= (1 + proximityBoost * 2.0) // Up to 3x stronger when very close
                  }
                }
              }

              // Coulomb's law: F = k / distance
              const force = repulsionStrength / distance

              fx += (dx / distance) * force
              fy += (dy / distance) * force
            }
          })

          // FORCE 3: Hub Attraction (Cluster Gravity)
          // Pull weakly toward the highest-degree neighbor (local hub)
          // Makes each network segment collapse into compact core + halo
          if (neighbors.size > 0) {
            let highestDegreeNeighbor: string | null = null
            let highestDegree = 0

            neighbors.forEach(neighborId => {
              const neighborDegree = (adjacency.get(neighborId) || new Set()).size
              if (neighborDegree > highestDegree) {
                highestDegree = neighborDegree
                highestDegreeNeighbor = neighborId
              }
            })

            if (highestDegreeNeighbor) {
              const hubPos = prev.get(highestDegreeNeighbor)
              if (hubPos) {
                const dx = hubPos.x - pos.x
                const dy = hubPos.y - pos.y
                const distance = Math.sqrt(dx * dx + dy * dy)

                if (distance > 0) {
                  // Gentle attraction toward local hub (collapses cluster into tight core)
                  const hubGravity = 0.05
                  fx += (dx / distance) * distance * hubGravity
                  fy += (dy / distance) * distance * hubGravity
                }
              }
            }
          }

          // FORCE 4: Center Gravity (Optional Global Centering)
          // Weak pull toward canvas center to prevent nodes from drifting off-screen
          if (physicsParams.centerGravity > 0) {
            const canvas = canvasRef.current
            if (canvas) {
              const centerX = canvas.offsetWidth / 2
              const centerY = canvas.offsetHeight / 2
              const dx = centerX - pos.x
              const dy = centerY - pos.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance > 0) {
                // Very weak pull toward center
                fx += (dx / distance) * distance * physicsParams.centerGravity
                fy += (dy / distance) * distance * physicsParams.centerGravity
              }
            }
          }

          displacements.set(node.id, { x: fx, y: fy })
        })

        // Apply forces with temperature-based damping
        displacements.forEach((force, nodeId) => {
          const pos = prev.get(nodeId)
          if (!pos) return

          if (draggedNodeId === nodeId) {
            updated.set(nodeId, { ...pos, vx: 0, vy: 0 })
            return
          }

          const forceLength = Math.sqrt(force.x * force.x + force.y * force.y)

          if (forceLength > 0) {
            // Apply temperature-based limiting
            const limitedLength = Math.min(forceLength, temperature)
            const damping = physicsParams.damping  // Use user-controlled damping

            const vx = (force.x / forceLength) * limitedLength * damping
            const vy = (force.y / forceLength) * limitedLength * damping

            const newX = pos.x + vx
            const newY = pos.y + vy

            updated.set(nodeId, { x: newX, y: newY, vx, vy })
          } else {
            updated.set(nodeId, pos)
          }
        })

        // FORCE 4: Phase-Aware Collision Detection
        // Phase 1: Allow leaf pass-through for untangling during explosion
        // Phase 2: Allow leaf pass-through while retracting (helps leaves find path to parent)
        // Phase 3: STRICT collision enforcement to create clean spacing
        // Phase 4: Continue strict collision (leaves snapping tight, maintain hallways)
        const nodeIds = Array.from(updated.keys())
        const collisionMinDistance = nodeRadius * 4.0  // ~240px, extremely generous spacing

        // Phase-based collision enforcement
        // Phase 1-2: Leaves can pass through (helps untangle and retract)
        // Phase 3-4: Strict enforcement for ALL nodes (creates clean hallways)
        const enforceLeafCollision = currentPhase >= 3

        for (let i = 0; i < nodeIds.length; i++) {
          const id1 = nodeIds[i]
          const pos1 = updated.get(id1)!
          const node1Degree = (adjacency.get(id1) || new Set()).size
          const node1IsLeaf = node1Degree === 1

          for (let j = i + 1; j < nodeIds.length; j++) {
            const id2 = nodeIds[j]
            const pos2 = updated.get(id2)!
            const node2Degree = (adjacency.get(id2) || new Set()).size
            const node2IsLeaf = node2Degree === 1

            // Skip collision for leaf nodes in Phase 1 (let them pass through)
            if (!enforceLeafCollision && (node1IsLeaf || node2IsLeaf)) {
              continue
            }

            const dx = pos2.x - pos1.x
            const dy = pos2.y - pos1.y
            const distance = Math.sqrt(dx * dx + dy * dy)

            // Hard collision: push apart if too close
            if (distance < collisionMinDistance && distance > 0) {
              const overlap = collisionMinDistance - distance

              // Full strength in Phase 2-3 to maintain clean spacing
              const collisionStrength = 1.0

              const pushDistance = (overlap / 2) * collisionStrength

              const nx = dx / distance
              const ny = dy / distance

              if (draggedNodeId !== id1) {
                pos1.x -= nx * pushDistance
                pos1.y -= ny * pushDistance
              }

              if (draggedNodeId !== id2) {
                pos2.x += nx * pushDistance
                pos2.y += ny * pushDistance
              }
            }
          }
        }

        return updated
      })

      // Physics-based animation for meta-nodes
      setMetaNodePositions((prev) => {
        const updated = new Map<string, NodePosition>()

        prev.forEach((pos, metaNodeId) => {
          // Skip if being dragged or manually positioned
          if (draggedNodeId === metaNodeId || manuallyPositionedMetaNodes.has(metaNodeId)) {
            updated.set(metaNodeId, pos)
            return
          }

          const target = targetMetaNodePositions.get(metaNodeId)
          if (!target) {
            updated.set(metaNodeId, pos)
            return
          }

          // Calculate distance to target
          const dx = target.x - pos.x
          const dy = target.y - pos.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          // If close enough, snap to target
          if (distance < 0.5) {
            updated.set(metaNodeId, { x: target.x, y: target.y, vx: 0, vy: 0 })
            return
          }

          // Apply spring force toward target
          const springStrength = 0.15
          const damping = 0.7

          const ax = dx * springStrength
          const ay = dy * springStrength

          let vx = (pos.vx + ax) * damping
          let vy = (pos.vy + ay) * damping

          // Limit maximum velocity
          const maxVelocity = 20
          const speed = Math.sqrt(vx * vx + vy * vy)
          if (speed > maxVelocity) {
            vx = (vx / speed) * maxVelocity
            vy = (vy / speed) * maxVelocity
          }

          const newX = pos.x + vx
          const newY = pos.y + vy

          updated.set(metaNodeId, { x: newX, y: newY, vx, vy })
        })

        return updated
      })

      // Set canvas size
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight

      // Clear canvas
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Save context and apply pan/zoom/rotation transformations
      ctx.save()
      ctx.translate(panOffset.x + canvas.width / 2, panOffset.y + canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      ctx.scale(zoom, zoom)
      ctx.translate(-canvas.width / 2, -canvas.height / 2)

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

      // ===================================================================
      // CLUSTER HULL RENDERING
      // Draw convex hulls around clusters (if enabled)
      // ===================================================================

      // Calculate hulls dynamically from current node positions
      const currentHulls = showHulls ? calculateHullsFromPositions(nodePositions) : new Map()

      if (showHulls && currentHulls.size > 0) {
        // Generate colors for each cluster
        const clusterColors = [
          'rgba(6, 182, 212, 0.1)',   // cyan
          'rgba(168, 85, 247, 0.1)',  // purple
          'rgba(236, 72, 153, 0.1)',  // pink
          'rgba(34, 197, 94, 0.1)',   // green
          'rgba(251, 146, 60, 0.1)',  // orange
          'rgba(59, 130, 246, 0.1)',  // blue
        ]

        const clusterBorderColors = [
          'rgba(6, 182, 212, 0.4)',   // cyan
          'rgba(168, 85, 247, 0.4)',  // purple
          'rgba(236, 72, 153, 0.4)',  // pink
          'rgba(34, 197, 94, 0.4)',   // green
          'rgba(251, 146, 60, 0.4)',  // orange
          'rgba(59, 130, 246, 0.4)',  // blue
        ]

        currentHulls.forEach((hullPoints, clusterId) => {
          if (hullPoints.length < 3) return

          const colorIndex = clusterId % clusterColors.length

          // Draw filled hull
          ctx.fillStyle = clusterColors[colorIndex]
          ctx.strokeStyle = clusterBorderColors[colorIndex]
          ctx.lineWidth = 2
          ctx.setLineDash([5, 5])

          ctx.beginPath()
          ctx.moveTo(hullPoints[0].x, hullPoints[0].y)
          for (let i = 1; i < hullPoints.length; i++) {
            ctx.lineTo(hullPoints[i].x, hullPoints[i].y)
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          ctx.setLineDash([])
        })
      }

      // ===================================================================
      // EDGE CROSSING DETECTION
      // Only calculate crossings when physics is settled (performance optimization)
      // ===================================================================

      const edgeCrossings = new Map<string, Array<{ x: number; y: number }>>()

      // Only detect crossings when physics has finished (iteration >= 500)
      if (iterationCount >= maxIterations) {
        // Helper: Check if two line segments intersect
        const getLineIntersection = (
          x1: number, y1: number, x2: number, y2: number,
          x3: number, y3: number, x4: number, y4: number
        ): { x: number; y: number } | null => {
          const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
          if (Math.abs(denom) < 0.001) return null // Parallel or coincident

          const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
          const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

          // Check if intersection is within both line segments
          if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
              x: x1 + t * (x2 - x1),
              y: y1 + t * (y2 - y1)
            }
          }
          return null
        }

        // Collect edge segments for intersection detection (only for straight lines)
        interface EdgeSegment {
          edgeId: string
          x1: number
          y1: number
          x2: number
          y2: number
        }

        const edgeSegments: EdgeSegment[] = []

        transformedEdges.forEach((transformedEdge) => {
          if (!transformedEdge.shouldRender) return

          const { edge, renderSource, renderTarget, sourceIsMetaNode, targetIsMetaNode } = transformedEdge

          if (filteredNodeIds) {
            if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) {
              return
            }
          }

          const sourcePos = sourceIsMetaNode
            ? metaNodePositions.get(renderSource)
            : nodePositions.get(renderSource)

          const targetPos = targetIsMetaNode
            ? metaNodePositions.get(renderTarget)
            : nodePositions.get(renderTarget)

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

        // Find all intersections
        for (let i = 0; i < edgeSegments.length; i++) {
          for (let j = i + 1; j < edgeSegments.length; j++) {
            const seg1 = edgeSegments[i]
            const seg2 = edgeSegments[j]

            const intersection = getLineIntersection(
              seg1.x1, seg1.y1, seg1.x2, seg1.y2,
              seg2.x1, seg2.y1, seg2.x2, seg2.y2
            )

            if (intersection) {
              // Add crossing to the edge that should "hop" (use consistent ordering)
              const hopEdgeId = seg1.edgeId < seg2.edgeId ? seg1.edgeId : seg2.edgeId

              if (!edgeCrossings.has(hopEdgeId)) {
                edgeCrossings.set(hopEdgeId, [])
              }
              edgeCrossings.get(hopEdgeId)!.push(intersection)
            }
          }
        }
      }

      // ===================================================================
      // EDGE RENDERING WITH HOPS
      // ===================================================================

      // Draw edges using transformed edge list (accounts for grouping)
      transformedEdges.forEach((transformedEdge) => {
        if (!transformedEdge.shouldRender) return

        const { edge, renderSource, renderTarget, sourceIsMetaNode, targetIsMetaNode } = transformedEdge

        // Skip if either original node is filtered out
        if (filteredNodeIds) {
          if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) {
            return
          }
        }

        // Get positions based on whether we're rendering to node or meta-node
        const sourcePos = sourceIsMetaNode
          ? metaNodePositions.get(renderSource)
          : nodePositions.get(renderSource)

        const targetPos = targetIsMetaNode
          ? metaNodePositions.get(renderTarget)
          : nodePositions.get(renderTarget)

        if (sourcePos && targetPos) {
          // Evaluate rules for this edge
          const rules = getEnabledRules()
          const ruleResult = evaluateEdgeRules(edge, rules)

          // Get edge template (rule result takes priority)
          const templateId = ruleResult.edgeTemplateId || edge.edgeTemplateId
          const template = templateId
            ? getEdgeTemplateById(templateId)
            : getDefaultEdgeTemplate()

          // Apply template or use defaults
          const edgeColor = template?.color || '#475569'
          const edgeWidth = template?.width || 2
          const edgeOpacity = template?.opacity ?? 1
          const edgeStyle = template?.style || 'solid'
          const lineType = template?.lineType || 'straight'
          const arrowType = template?.arrowType || 'default'
          const arrowPosition = template?.arrowPosition || 'end'
          const edgeLabel = template?.label || edge.label

          // Set line dash array based on style
          if (edgeStyle === 'dashed') {
            ctx.setLineDash([10, 5])
          } else if (edgeStyle === 'dotted') {
            ctx.setLineDash([2, 4])
          } else {
            ctx.setLineDash([])
          }

          // Draw edge line based on line type
          ctx.strokeStyle = edgeColor
          ctx.lineWidth = edgeWidth
          ctx.globalAlpha = edgeOpacity

          const nodeRadius = 30

          // Draw line based on type
          if (lineType === 'curved') {
            // Bezier curve
            const controlX = (sourcePos.x + targetPos.x) / 2
            const controlY = (sourcePos.y + targetPos.y) / 2
            const dx = targetPos.x - sourcePos.x
            const dy = targetPos.y - sourcePos.y
            const distance = Math.sqrt(dx * dx + dy * dy)
            const curvature = 0.2
            const offsetX = -dy * curvature * (distance / 200)
            const offsetY = dx * curvature * (distance / 200)

            ctx.beginPath()
            ctx.moveTo(sourcePos.x, sourcePos.y)
            ctx.quadraticCurveTo(
              controlX + offsetX,
              controlY + offsetY,
              targetPos.x,
              targetPos.y
            )
            ctx.stroke()
          } else if (lineType === 'orthogonal') {
            // 90-degree turns
            const midX = (sourcePos.x + targetPos.x) / 2
            ctx.beginPath()
            ctx.moveTo(sourcePos.x, sourcePos.y)
            ctx.lineTo(midX, sourcePos.y)
            ctx.lineTo(midX, targetPos.y)
            ctx.lineTo(targetPos.x, targetPos.y)
            ctx.stroke()
          } else {
            // Straight line (default) - with hop arcs at crossings
            const crossings = edgeCrossings.get(edge.id) || []

            if (crossings.length === 0) {
              // No crossings - draw normal line
              ctx.beginPath()
              ctx.moveTo(sourcePos.x, sourcePos.y)
              ctx.lineTo(targetPos.x, targetPos.y)
              ctx.stroke()
            } else {
              // Has crossings - draw line with hop arcs
              const hopRadius = 8 // Size of the hop arc

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

              // Draw line segments between crossings with arcs
              ctx.beginPath()
              ctx.moveTo(sourcePos.x, sourcePos.y)

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
                ctx.lineTo(beforeX, beforeY)

                // Draw arc over crossing
                ctx.quadraticCurveTo(arcX, arcY, afterX, afterY)
              })

              // Draw final segment to target
              ctx.lineTo(targetPos.x, targetPos.y)
              ctx.stroke()
            }
          }

          // Reset line dash
          ctx.setLineDash([])

          // Helper function to draw arrow at a position
          const drawArrow = (x: number, y: number, angle: number) => {
            ctx.fillStyle = edgeColor

            if (arrowType === 'default') {
              const arrowSize = 8
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(
                x - arrowSize * Math.cos(angle - Math.PI / 6),
                y - arrowSize * Math.sin(angle - Math.PI / 6)
              )
              ctx.lineTo(
                x - arrowSize * Math.cos(angle + Math.PI / 6),
                y - arrowSize * Math.sin(angle + Math.PI / 6)
              )
              ctx.closePath()
              ctx.fill()
            } else if (arrowType === 'triangle') {
              const arrowSize = 12
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(
                x - arrowSize * Math.cos(angle - Math.PI / 8),
                y - arrowSize * Math.sin(angle - Math.PI / 8)
              )
              ctx.lineTo(
                x - arrowSize * Math.cos(angle + Math.PI / 8),
                y - arrowSize * Math.sin(angle + Math.PI / 8)
              )
              ctx.closePath()
              ctx.fill()
            } else if (arrowType === 'circle') {
              const circleRadius = 4
              ctx.beginPath()
              ctx.arc(x, y, circleRadius, 0, Math.PI * 2)
              ctx.fill()
            }
          }

          // Draw arrows based on arrow position
          if (arrowType !== 'none' && arrowPosition !== 'none') {
            const angle = Math.atan2(targetPos.y - sourcePos.y, targetPos.x - sourcePos.x)

            // Draw arrow at end (target)
            if (arrowPosition === 'end' || arrowPosition === 'both') {
              const endX = targetPos.x - nodeRadius * Math.cos(angle)
              const endY = targetPos.y - nodeRadius * Math.sin(angle)
              drawArrow(endX, endY, angle)
            }

            // Draw arrow at start (source)
            if (arrowPosition === 'start' || arrowPosition === 'both') {
              const startX = sourcePos.x + nodeRadius * Math.cos(angle)
              const startY = sourcePos.y + nodeRadius * Math.sin(angle)
              drawArrow(startX, startY, angle + Math.PI) // Reverse direction
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

      // Draw meta-nodes
      visibleMetaNodes.forEach((metaNode) => {
        const pos = metaNodePositions.get(metaNode.id)
        if (!pos) return

        if (!metaNode.collapsed) {
          // Expanded meta-nodes no longer show a badge - they are invisible
          // This forces all groupings to be shown as collapsed containers with grid layout
          return // Skip rendering - nodes are shown ungrouped
        }

        // Draw collapsed meta-node - showing contained nodes with full styling

        // Get contained nodes (filter by search if active)
        let containedNodes = nodes.filter((n) => metaNode.childNodeIds.includes(n.id))
        if (filteredNodeIds && filteredNodeIds.size > 0) {
          containedNodes = containedNodes.filter((n) => filteredNodeIds.has(n.id))
        }

        // Calculate layout for contained nodes (grid layout)
        // Use wider rectangles instead of squares for better visual organization
        const nodeCount = containedNodes.length
        const cols = Math.min(6, Math.ceil(Math.sqrt(nodeCount * 1.5))) // Wider rectangles
        const rows = Math.ceil(nodeCount / cols)

        // Use base card dimensions (will be adjusted per node based on their templates)
        const baseCardWidth = 120
        const baseCardHeight = 60
        const spacing = 15
        const padding = 25
        const headerHeight = 0 // No header - removed blue label

        // For container sizing, use maximum size multiplier among contained nodes
        let maxSizeMultiplier = 1
        containedNodes.forEach((node) => {
          const rules = getEnabledRules()
          const ruleResult = evaluateNodeRules(node, rules)
          const templateId = ruleResult.cardTemplateId || node.cardTemplateId
          const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined
          const sizeMultiplier = cardTemplate?.size || 1
          maxSizeMultiplier = Math.max(maxSizeMultiplier, sizeMultiplier)
        })

        const cardWidth = baseCardWidth * maxSizeMultiplier
        const cardHeight = baseCardHeight * maxSizeMultiplier

        const containerWidth = Math.max(200, cols * (cardWidth + spacing) - spacing + padding * 2)
        const containerHeight = rows * (cardHeight + spacing) - spacing + padding * 2 + headerHeight

        const containerX = pos.x - containerWidth / 2
        const containerY = pos.y - containerHeight / 2
        const radius = 12

        // Draw container background
        ctx.fillStyle = '#0f172a'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 4

        ctx.beginPath()
        ctx.moveTo(containerX + radius, containerY)
        ctx.lineTo(containerX + containerWidth - radius, containerY)
        ctx.quadraticCurveTo(containerX + containerWidth, containerY, containerX + containerWidth, containerY + radius)
        ctx.lineTo(containerX + containerWidth, containerY + containerHeight - radius)
        ctx.quadraticCurveTo(containerX + containerWidth, containerY + containerHeight, containerX + containerWidth - radius, containerY + containerHeight)
        ctx.lineTo(containerX + radius, containerY + containerHeight)
        ctx.quadraticCurveTo(containerX, containerY + containerHeight, containerX, containerY + containerHeight - radius)
        ctx.lineTo(containerX, containerY + radius)
        ctx.quadraticCurveTo(containerX, containerY, containerX + radius, containerY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Header removed - no blue label displayed

        // Draw each contained node with full card styling
        const startX = containerX + padding
        const startY = containerY + headerHeight + padding

        containedNodes.forEach((node, idx) => {
          const row = Math.floor(idx / cols)
          const col = idx % cols
          const nodeX = startX + col * (cardWidth + spacing) + cardWidth / 2
          const nodeY = startY + row * (cardHeight + spacing) + cardHeight / 2

          // Get style rules and template for this node
          const rules = getEnabledRules()
          const ruleResult = evaluateNodeRules(node, rules)
          const templateId = ruleResult.cardTemplateId || node.cardTemplateId
          const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined

          // Apply size multiplier for this specific node
          const nodeSizeMultiplier = cardTemplate?.size || 1
          const nodeCardWidth = baseCardWidth * nodeSizeMultiplier
          const nodeCardHeight = baseCardHeight * nodeSizeMultiplier

          // Draw node card (same as regular nodes but without selection highlight)
          const x = nodeX - nodeCardWidth / 2
          const y = nodeY - nodeCardHeight / 2

          // Get template colors or defaults
          const bgColor = cardTemplate?.backgroundColor || (node.isStub ? '#1e293b' : '#0f172a')
          const borderColor = cardTemplate?.borderColor || (node.isStub ? '#475569' : '#0891b2')
          const borderWidth = cardTemplate?.borderWidth || 2
          const shape = cardTemplate?.shape || 'rect'

          ctx.fillStyle = bgColor
          ctx.strokeStyle = borderColor
          ctx.lineWidth = borderWidth

          // Draw shape based on template
          ctx.beginPath()

          switch (shape) {
            case 'circle':
              const circleRadius = Math.min(nodeCardWidth, nodeCardHeight) / 2
              ctx.arc(nodeX, nodeY, circleRadius, 0, Math.PI * 2)
              break

            case 'ellipse':
              ctx.ellipse(nodeX, nodeY, nodeCardWidth / 2, nodeCardHeight / 2, 0, 0, Math.PI * 2)
              break

            case 'diamond':
              ctx.moveTo(nodeX, y)
              ctx.lineTo(x + nodeCardWidth, nodeY)
              ctx.lineTo(nodeX, y + nodeCardHeight)
              ctx.lineTo(x, nodeY)
              ctx.closePath()
              break

            case 'triangle':
              ctx.moveTo(nodeX, y)
              ctx.lineTo(x + nodeCardWidth, y + nodeCardHeight)
              ctx.lineTo(x, y + nodeCardHeight)
              ctx.closePath()
              break

            case 'star':
              const outerRadius = Math.min(nodeCardWidth, nodeCardHeight) / 2
              const innerRadius = outerRadius * 0.4
              for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
                const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2
                if (i === 0) {
                  ctx.moveTo(nodeX + outerRadius * Math.cos(outerAngle), nodeY + outerRadius * Math.sin(outerAngle))
                } else {
                  ctx.lineTo(nodeX + outerRadius * Math.cos(outerAngle), nodeY + outerRadius * Math.sin(outerAngle))
                }
                ctx.lineTo(nodeX + innerRadius * Math.cos(innerAngle), nodeY + innerRadius * Math.sin(innerAngle))
              }
              ctx.closePath()
              break

            case 'rect':
            default:
              const cardRadius = 8
              ctx.moveTo(x + cardRadius, y)
              ctx.lineTo(x + nodeCardWidth - cardRadius, y)
              ctx.quadraticCurveTo(x + nodeCardWidth, y, x + nodeCardWidth, y + cardRadius)
              ctx.lineTo(x + nodeCardWidth, y + nodeCardHeight - cardRadius)
              ctx.quadraticCurveTo(x + nodeCardWidth, y + nodeCardHeight, x + nodeCardWidth - cardRadius, y + nodeCardHeight)
              ctx.lineTo(x + cardRadius, y + nodeCardHeight)
              ctx.quadraticCurveTo(x, y + nodeCardHeight, x, y + nodeCardHeight - cardRadius)
              ctx.lineTo(x, y + cardRadius)
              ctx.quadraticCurveTo(x, y, x + cardRadius, y)
              ctx.closePath()
              break
          }

          ctx.fill()
          ctx.stroke()

          // Draw icon if template has one
          if (cardTemplate?.icon) {
            const iconSize = 16
            const iconX = x + 10
            const iconY = y + 10

            ctx.font = `${iconSize}px sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText(cardTemplate.icon, iconX, iconY)
          }

          // Draw label
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(node.label, nodeX, y + nodeCardHeight - 15)
        })
      })

      // Draw nodes as cards (only visible nodes)
      visibleNodes.forEach((node) => {
        const pos = nodePositions.get(node.id)
        if (!pos) {
          // Debug: log nodes without positions
          console.warn(`Node ${node.id} is visible but has no position`)
          return
        }

        const isSelected = node.id === selectedNodeId

        // Evaluate rules for this node FIRST to get card template
        const rules = getEnabledRules()
        const ruleResult = evaluateNodeRules(node, rules)
        const templateId = ruleResult.cardTemplateId || node.cardTemplateId
        const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined

        // Apply size multiplier from template
        const sizeMultiplier = cardTemplate?.size || 1
        let cardWidth = 120 * sizeMultiplier
        let cardHeight = 60 * sizeMultiplier

        // Auto-fit: measure all visible content and adjust card size if needed
        if (cardTemplate?.autoFit) {
          let maxWidth = 0
          let totalHeight = 0

          // Measure label
          ctx.font = '12px sans-serif'
          maxWidth = Math.max(maxWidth, ctx.measureText(node.label).width)
          totalHeight += 20 // Label height

          // Measure visible attributes
          if (cardTemplate?.attributeDisplays && cardTemplate.attributeDisplays.length > 0) {
            const visibleAttrs = cardTemplate.attributeDisplays
              .filter((attrDisplay) => attrDisplay.visible)
              .sort((a, b) => a.order - b.order)

            visibleAttrs.forEach((attrDisplay) => {
              let attrValue = ''
              if (attrDisplay.attributeName === '__id__') {
                attrValue = node.id
              } else if (node.attributes[attrDisplay.attributeName]) {
                const value = node.attributes[attrDisplay.attributeName]
                attrValue = Array.isArray(value) ? value.join(', ') : value
              }

              if (attrValue) {
                const fontSize = attrDisplay.fontSize || 10
                ctx.font = `${fontSize}px sans-serif`
                const labelText = attrDisplay.displayLabel || attrDisplay.attributeName
                const prefix = attrDisplay.prefix || ''
                const suffix = attrDisplay.suffix || ''
                const fullText = `${prefix}${labelText}: ${attrValue}${suffix}`
                maxWidth = Math.max(maxWidth, ctx.measureText(fullText).width)
                totalHeight += fontSize + 4 // Attribute height + spacing
              }
            })
          }

          // Add padding and apply
          const requiredWidth = maxWidth + 40
          const requiredHeight = totalHeight + 50 // Extra padding for icon
          cardWidth = Math.max(cardWidth, requiredWidth)
          cardHeight = Math.max(cardHeight, requiredHeight)
        }

        // Debug: log if template is missing when expected
        if (templateId && !cardTemplate) {
          console.warn(`Node ${node.id} has templateId ${templateId} but template not found`)
        }

        // Draw card background using template colors or defaults
        const bgColor = cardTemplate?.backgroundColor || (node.isStub ? '#1e293b' : '#0f172a')
        let borderColor = cardTemplate?.borderColor || (node.isStub ? '#475569' : '#0891b2')
        const borderWidth = cardTemplate?.borderWidth || 2
        const shape = cardTemplate?.shape || 'rect'
        const effects = cardTemplate?.effects

        // Apply RGB cycling to border if enabled
        if (effects?.rgbCycle?.enabled && (effects.rgbCycle.target === 'border' || effects.rgbCycle.target === 'both')) {
          borderColor = getRGBColor(animationTime, effects.rgbCycle.speed)
        }

        // Apply shadow effect if enabled
        if (effects?.shadow?.enabled) {
          ctx.shadowColor = effects.shadow.color
          ctx.shadowBlur = effects.shadow.blur
          ctx.shadowOffsetX = effects.shadow.offsetX
          ctx.shadowOffsetY = effects.shadow.offsetY
        }

        // Apply pulse effect if enabled (scale based on time)
        let pulseScale = 1
        if (effects?.pulse?.enabled) {
          const pulseSpeed = effects.pulse.speed
          pulseScale = 1 + Math.sin(animationTime * pulseSpeed * 2) * 0.1
        }

        // Apply glow effect if enabled
        if (effects?.glow?.enabled) {
          let glowColor = effects.glow.color
          if (effects.rgbCycle?.enabled && (effects.rgbCycle.target === 'glow' || effects.rgbCycle.target === 'both')) {
            glowColor = getRGBColor(animationTime, effects.rgbCycle.speed)
          }
          ctx.shadowColor = glowColor
          ctx.shadowBlur = effects.glow.blur * effects.glow.intensity
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        }

        // Check if shape should be transparent
        const transparentShape = cardTemplate?.transparentShape || false

        ctx.fillStyle = bgColor
        ctx.strokeStyle = isSelected ? '#22d3ee' : borderColor
        ctx.lineWidth = isSelected ? 3 : borderWidth

        // Draw shape based on template (skip if transparent)
        const adjustedWidth = cardWidth * pulseScale
        const adjustedHeight = cardHeight * pulseScale
        const x = pos.x - adjustedWidth / 2
        const y = pos.y - adjustedHeight / 2

        if (!transparentShape) {
          ctx.beginPath()

          switch (shape) {
          case 'circle':
            // Draw as circle using the average of width/height as diameter
            const circleRadius = Math.min(adjustedWidth, adjustedHeight) / 2
            ctx.arc(pos.x, pos.y, circleRadius * pulseScale, 0, Math.PI * 2)
            break

          case 'ellipse':
            // Draw as ellipse
            ctx.ellipse(pos.x, pos.y, adjustedWidth / 2, adjustedHeight / 2, 0, 0, Math.PI * 2)
            break

          case 'diamond':
            // Draw as diamond (rotated square)
            ctx.moveTo(pos.x, y) // Top point
            ctx.lineTo(x + adjustedWidth, pos.y) // Right point
            ctx.lineTo(pos.x, y + adjustedHeight) // Bottom point
            ctx.lineTo(x, pos.y) // Left point
            ctx.closePath()
            break

          case 'triangle':
            // Draw as triangle
            ctx.moveTo(pos.x, y) // Top point
            ctx.lineTo(x + adjustedWidth, y + adjustedHeight) // Bottom right
            ctx.lineTo(x, y + adjustedHeight) // Bottom left
            ctx.closePath()
            break

          case 'star':
            // Draw as 5-point star
            const outerRadius = Math.min(adjustedWidth, adjustedHeight) / 2
            const innerRadius = outerRadius * 0.4
            for (let i = 0; i < 5; i++) {
              const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
              const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2
              if (i === 0) {
                ctx.moveTo(pos.x + outerRadius * Math.cos(outerAngle), pos.y + outerRadius * Math.sin(outerAngle))
              } else {
                ctx.lineTo(pos.x + outerRadius * Math.cos(outerAngle), pos.y + outerRadius * Math.sin(outerAngle))
              }
              ctx.lineTo(pos.x + innerRadius * Math.cos(innerAngle), pos.y + innerRadius * Math.sin(innerAngle))
            }
            ctx.closePath()
            break

          case 'rect':
          default:
            // Draw as rounded rectangle (default)
            const radius = 8
            ctx.moveTo(x + radius, y)
            ctx.lineTo(x + adjustedWidth - radius, y)
            ctx.quadraticCurveTo(x + adjustedWidth, y, x + adjustedWidth, y + radius)
            ctx.lineTo(x + adjustedWidth, y + adjustedHeight - radius)
            ctx.quadraticCurveTo(x + adjustedWidth, y + adjustedHeight, x + adjustedWidth - radius, y + adjustedHeight)
            ctx.lineTo(x + radius, y + adjustedHeight)
            ctx.quadraticCurveTo(x, y + adjustedHeight, x, y + adjustedHeight - radius)
            ctx.lineTo(x, y + radius)
            ctx.quadraticCurveTo(x, y, x + radius, y)
            ctx.closePath()
            break
          }

          ctx.fill()
          ctx.stroke()
        }

        // Reset shadow after drawing shape
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0

        // Draw icon circle or template icon (if showIcon is not false)
        const showIcon = cardTemplate?.showIcon !== false
        if (showIcon) {
          const iconRadius = 16
          const iconX = pos.x
          const iconY = pos.y - 15

          if (cardTemplate?.icon) {
            // Use template icon with custom size
            const iconSize = cardTemplate.iconSize ? cardTemplate.iconSize * 16 : 16
            ctx.font = `${iconSize}px sans-serif`
            ctx.fillStyle = cardTemplate.iconColor || '#fff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(cardTemplate.icon, iconX, iconY)
          } else {
            // Default icon circle with first letter
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
          }
        }

        // Draw label
        ctx.fillStyle = '#e2e8f0'
        ctx.font = '12px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillText(node.label, pos.x, pos.y + 8)

        // Render attributes from card template (already evaluated above)
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

              ctx.fillStyle = color
              ctx.font = `${fontSize}px sans-serif`
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillText(displayText, pos.x, yOffset)

              yOffset += fontSize + 4
            }
          })

          // Show indicator if there are more attributes
          if (visibleAttrs.length > maxAttrsToShow) {
            ctx.fillStyle = '#64748b'
            ctx.font = '9px sans-serif'
            ctx.fillText(`+${visibleAttrs.length - maxAttrsToShow} more`, pos.x, yOffset)
          }
        }
      })

      // Restore context
      ctx.restore()

      // Request next animation frame for continuous rendering (for animations)
      animationRef.current = requestAnimationFrame(render)
    }

    // Start render loop
    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, edges, nodePositions, selectedNodeId, filteredNodeIds, visibleNodes, swimlanes, metaNodes, visibleMetaNodes, metaNodePositions, panOffset, zoom, rotation, transformedEdges, targetNodePositions, targetMetaNodePositions, draggedNodeId, manuallyPositionedMetaNodes])

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          width: '100%',
          height: '100%',
          cursor: isPanning ? 'move' : draggedNodeId ? 'grabbing' : 'grab'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />


      {/* Export button */}
      {nodes.length > 0 && (
        <button
          onClick={handleExport}
          className="group absolute top-4 right-4 px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-cyber-400 transition-all flex items-center gap-2 overflow-hidden hover:px-3"
          title="Export graph as SVG"
        >
          <Download className="w-4 h-4 flex-shrink-0" />
          <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Export SVG</span>
        </button>
      )}

      {/* Graph info indicator */}
      {nodes.length > 0 && (
        <div className="absolute top-16 right-4">
          <button
            onClick={() => setShowGraphInfo(!showGraphInfo)}
            className="group px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-2"
            title="Graph info"
          >
            <Info className="w-4 h-4 flex-shrink-0" />
            <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden text-sm">
              Info
            </span>
          </button>
          {showGraphInfo && (
            <div className="absolute top-0 right-16 bg-dark-secondary/90 border border-dark rounded-lg px-3 py-2 text-sm text-slate-300 min-w-[150px]">
              <div className="flex flex-col gap-2">
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
        </div>
      )}


      {/* Hull Outlines Toggle */}
      {nodes.length > 0 && (
        <button
          onClick={() => setShowHulls(!showHulls)}
          className={`group absolute top-28 right-4 px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm transition-all flex items-center gap-2 overflow-hidden hover:px-3 ${
            showHulls ? 'text-cyber-400 border-cyber-500/50' : 'text-slate-300'
          }`}
          title="Toggle Cluster Hulls"
        >
          <Shapes className="w-4 h-4 flex-shrink-0" />
          <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Hulls</span>
        </button>
      )}

      {/* Physics Controls */}
      {nodes.length > 0 && (
        <div className="absolute top-40 right-4">
          <button
            onClick={() => setShowPhysicsControls(!showPhysicsControls)}
            className="group px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-cyber-400 transition-colors flex items-center gap-2"
            title="Physics Parameters"
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Physics</span>
            {iterationCount < maxIterations && (
              <span className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" title={`Calculating physics: ${iterationCount}/${maxIterations}`}></span>
            )}
          </button>

          {/* Controls panel */}
          {showPhysicsControls && (
            <div className="absolute top-0 right-16 bg-dark-secondary/90 border border-dark rounded-lg overflow-hidden min-w-[280px]">
            <div className="border-t border-dark p-3 space-y-3">
              {/* Repulsion Strength */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Repulsion Force: {(physicsParams.repulsionStrength / 1000).toFixed(1)}k
                </label>
                <input
                  type="range"
                  min="1000"
                  max="30000"
                  step="500"
                  value={physicsParams.repulsionStrength}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, repulsionStrength: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
              </div>

              {/* Attraction Strength */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Spring Strength: {physicsParams.attractionStrength.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="2.0"
                  step="0.05"
                  value={physicsParams.attractionStrength}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, attractionStrength: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
              </div>

              {/* Leaf Spring Strength */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Leaf Tightness: {physicsParams.leafSpringStrength.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  value={physicsParams.leafSpringStrength}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, leafSpringStrength: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
              </div>

              {/* Damping */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Damping: {(physicsParams.damping * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="0.99"
                  step="0.01"
                  value={physicsParams.damping}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, damping: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
              </div>

              {/* Node Chaos */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Node Chaos: {physicsParams.nodeChaosFactor.toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={physicsParams.nodeChaosFactor}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, nodeChaosFactor: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Randomizes physics per node for organic layouts
                </p>
              </div>

              {/* Center Gravity */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">
                  Center Gravity: {physicsParams.centerGravity.toFixed(3)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="0.01"
                  step="0.0001"
                  value={physicsParams.centerGravity}
                  onChange={(e) => setPhysicsParams(prev => ({ ...prev, centerGravity: Number(e.target.value) }))}
                  className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Pulls nodes toward canvas center
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 mb-2">
                {/* Reset button */}
                <button
                  onClick={() => setPhysicsParams(defaultPhysicsParams)}
                  className="flex-1 px-3 py-2 bg-slate-500/20 hover:bg-slate-500/30 border border-slate-500/50 rounded-lg text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-2"
                  title="Reset to default values"
                >
                  <span>Reset</span>
                </button>

                {/* Rerun button */}
                <button
                  onClick={handleRerunLayout}
                  className="flex-1 px-3 py-2 bg-cyber-500/20 hover:bg-cyber-500/30 border border-cyber-500/50 rounded-lg text-sm text-cyber-400 hover:text-cyber-300 transition-colors flex items-center justify-center gap-2"
                  title="Rerun physics simulation with current parameters"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Rerun</span>
                </button>
              </div>

              {/* Continue Physics button */}
              <div className="flex gap-2">
                <button
                  onClick={handleContinuePhysics}
                  className="flex-1 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 rounded-lg text-sm text-purple-400 hover:text-purple-300 transition-colors flex items-center justify-center gap-2"
                  title="Continue physics from current positions"
                >
                  <span>Continue Physics</span>
                </button>
              </div>
            </div>
            </div>
          )}
        </div>
      )}

      {/* Graph Controls */}
      <GraphControls
        zoom={zoom}
        rotation={rotation}
        isLocked={isLocked}
        onZoomIn={() => {
          const canvas = canvasRef.current
          if (!canvas) return

          const zoomFactor = 1.1 // 10% zoom increment
          const newZoom = Math.min(5, zoom * zoomFactor)

          // Zoom towards center of screen
          const centerX = canvas.offsetWidth / 2
          const centerY = canvas.offsetHeight / 2

          // Calculate the point in graph space at the center
          const graphX = (centerX - panOffset.x) / zoom
          const graphY = (centerY - panOffset.y) / zoom

          // Calculate new pan offset to keep that point at center
          const newPanX = centerX - graphX * newZoom
          const newPanY = centerY - graphY * newZoom

          // Set target values and start animation
          setTargetZoom(newZoom)
          setTargetPanOffset({ x: newPanX, y: newPanY })
          setIsAnimating(true)
        }}
        onZoomOut={() => {
          const canvas = canvasRef.current
          if (!canvas) return

          const zoomFactor = 0.9 // 10% zoom decrement
          const newZoom = Math.max(0.1, zoom * zoomFactor)

          // Zoom towards center of screen
          const centerX = canvas.offsetWidth / 2
          const centerY = canvas.offsetHeight / 2

          // Calculate the point in graph space at the center
          const graphX = (centerX - panOffset.x) / zoom
          const graphY = (centerY - panOffset.y) / zoom

          // Calculate new pan offset to keep that point at center
          const newPanX = centerX - graphX * newZoom
          const newPanY = centerY - graphY * newZoom

          // Set target values and start animation
          setTargetZoom(newZoom)
          setTargetPanOffset({ x: newPanX, y: newPanY })
          setIsAnimating(true)
        }}
        onReset={() => {
          // Set target values and start animation
          setTargetZoom(1)
          setTargetPanOffset({ x: 0, y: 0 })
          setTargetRotation(0)
          setIsAnimating(true)
        }}
        onRotateLeft={() => {
          setTargetRotation((rotation - 15) % 360)
          setIsAnimating(true)
        }}
        onRotateRight={() => {
          setTargetRotation((rotation + 15) % 360)
          setIsAnimating(true)
        }}
        onToggleLock={() => setIsLocked(!isLocked)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        minimapContent={
          canvasRef.current && nodePositions.size > 0 ? (
            <Minimap
              nodePositions={nodePositions}
              metaNodePositions={metaNodePositions}
              panOffset={panOffset}
              zoom={zoom}
              canvasWidth={canvasRef.current.offsetWidth}
              canvasHeight={canvasRef.current.offsetHeight}
              onPanChange={(offset) => {
                setPanOffset(offset)
              }}
            />
          ) : undefined
        }
      />


    </div>
  )
}

/**
 * Graph control buttons
 */
interface GraphControlsProps {
  zoom: number
  rotation: number
  isLocked: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onRotateLeft: () => void
  onRotateRight: () => void
  onToggleLock: () => void
  showMinimap: boolean
  onToggleMinimap: () => void
  minimapContent?: React.ReactNode
}

function GraphControls({ zoom, rotation, isLocked, onZoomIn, onZoomOut, onReset, onRotateLeft, onRotateRight, onToggleLock, showMinimap, onToggleMinimap, minimapContent }: GraphControlsProps) {
  return (
    <div className="absolute bottom-6 right-4 flex items-center gap-2">
      {/* Zoom indicator */}
      <div className="px-3 py-2 bg-dark-secondary/90 border border-dark rounded-lg text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Zoom:</span>
          <span className="font-medium">{(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>
      <button
        onClick={onZoomIn}
        disabled={zoom >= 5}
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom in (scroll wheel or click)"
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
        onClick={onZoomOut}
        disabled={zoom <= 0.1}
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        title="Zoom out (scroll wheel or click)"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>
      <button
        onClick={onReset}
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Reset view (zoom 100%, center, no rotation)"
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
      <button
        onClick={onRotateLeft}
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Rotate counter-clockwise"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
      <button
        onClick={onRotateRight}
        className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
        title="Rotate clockwise"
      >
        <RotateCw className="w-5 h-5" />
      </button>
      <button
        onClick={onToggleLock}
        className={`w-10 h-10 border border-dark rounded-lg flex items-center justify-center transition-colors shadow-lg ${
          isLocked
            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 hover:text-amber-300'
            : 'bg-dark-secondary hover:bg-dark-tertiary text-slate-400 hover:text-slate-200'
        }`}
        title={isLocked ? "Unlock node movement" : "Lock node movement"}
      >
        {isLocked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
      </button>

      {/* Minimap button and content */}
      <div className="relative">
        <button
          onClick={onToggleMinimap}
          className="w-10 h-10 bg-dark-secondary hover:bg-dark-tertiary border border-dark rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors shadow-lg"
          title="Toggle Minimap"
        >
          <MapIcon className="w-5 h-5" />
        </button>

        {/* Minimap content appears above the button */}
        {showMinimap && minimapContent && (
          <div className="absolute bottom-12 right-0 bg-dark-secondary/90 border border-dark rounded-lg p-2 min-w-[200px]">
            {minimapContent}
          </div>
        )}
      </div>
    </div>
  )
}
