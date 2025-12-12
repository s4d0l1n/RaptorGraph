import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Download, Settings, RotateCcw, RotateCw, Lock, LockOpen, Map as MapIcon, Shapes, Info, X } from 'lucide-react'
import { Viewport } from '@/lib/viewport'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useTemplateStore } from '@/stores/templateStore'
import { useGraphExport } from '@/hooks/useGraphExport'
import { calculateClusterIslandLayout } from '@/lib/layouts/clusterIslandLayout'
import { getVisibleNodesWithGrouping, calculateMetaNodePosition, transformEdgesForGrouping, applyGridLayoutToGroups } from '@/lib/grouping'
import { evaluateNodeRules, evaluateEdgeRules } from '@/lib/styleEvaluator'
import { useRulesStore } from '@/stores/rulesStore'
import { computeConvexHull, expandHull } from '@/lib/convexHull'
import { Minimap } from './Minimap'
import { calculatePhysicsFrame } from '@/lib/physics/forceDirected'
import { PhysicsPanel } from './PhysicsPanel'
import { HighlightPanel } from './HighlightPanel'
import { DEFAULT_PHYSICS_PARAMS, DEFAULT_HIGHLIGHT_EDGE_SETTINGS } from './constants'
import type { NodePosition, PhysicsParams, HighlightEdgeSettings } from './types'

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
  // PERFORMANCE: Layered canvas architecture - separate layers for different content
  // Only redraw layers that actually changed
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null) // Layer 0: Swimlanes, static background
  const edgeCanvasRef = useRef<HTMLCanvasElement>(null)       // Layer 1: Edges/connections
  const nodeCanvasRef = useRef<HTMLCanvasElement>(null)       // Layer 2: Nodes/cards
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)    // Layer 3: Selection highlights, hover effects
  const canvasRef = useRef<HTMLCanvasElement>(null) // Kept for compatibility, will use overlayCanvasRef
  const viewportRef = useRef<Viewport | null>(null)
  const canvasDimensionsRef = useRef({ width: 0, height: 0 }) // Track previous dimensions

  // Track which layers need to be redrawn
  const dirtyLayersRef = useRef({
    background: true,
    edges: true,
    nodes: true,
    overlay: true
  })
  const { nodes, edges, metaNodes } = useGraphStore()
  const { setSelectedNodeId, setSelectedMetaNodeId, selectedNodeId, selectedMetaNodeId, filteredNodeIds } = useUIStore()
  const { layoutConfig } = useProjectStore()
  const { getEdgeTemplateById, getDefaultEdgeTemplate, getCardTemplateById, cardTemplates, edgeTemplates } = useTemplateStore()
  const { exportAsSVG } = useGraphExport()
  const { getEnabledRules, styleRules } = useRulesStore()
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [metaNodePositions, setMetaNodePositions] = useState<Map<string, NodePosition>>(new Map())
  const [targetNodePositions, setTargetNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [targetMetaNodePositions, setTargetMetaNodePositions] = useState<Map<string, { x: number; y: number }>>(new Map())
  const [swimlanes, setSwimlanes] = useState<Map<string, number>>(new Map())
  const animationRef = useRef<number>()
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [manuallyPositionedMetaNodes, setManuallyPositionedMetaNodes] = useState<Set<string>>(new Set())
  const [animationTime, setAnimationTime] = useState(0)

  // PERFORMANCE: FPS tracking for monitoring performance
  const [fps, setFps] = useState(0)
  const frameCountRef = useRef(0)
  const lastFpsUpdateRef = useRef(performance.now())

  // Track if rendering is needed (motion detection)
  const needsRenderRef = useRef(true)
  const lastPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const lastMetaPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  // State to trigger re-render when viewport changes
  const [viewportState, setViewportState] = useState({ zoom: 1, pan: { x: 0, y: 0 }, rotation: 0 });

  // Initialize viewport (use overlay canvas for dimensions/events)
  useEffect(() => {
    if (overlayCanvasRef.current && !viewportRef.current) {
      viewportRef.current = new Viewport(overlayCanvasRef.current);
      // Synchronize state for the first render
      setViewportState(viewportRef.current.getTransform());
      // Also set canvasRef for backwards compatibility
      canvasRef.current = overlayCanvasRef.current;
    }
  }, []);

  // PERFORMANCE: Restart rendering when viewport changes (zoom, pan, rotate)
  useEffect(() => {
    needsRenderRef.current = true
    // Mark all layers as dirty when viewport changes (all content needs repositioning)
    dirtyLayersRef.current.background = true
    dirtyLayersRef.current.edges = true
    dirtyLayersRef.current.nodes = true
    dirtyLayersRef.current.overlay = true
  }, [viewportState]);

  // Physics parameters - adjustable by user
  const [physicsParams, setPhysicsParams] = useState<PhysicsParams>(DEFAULT_PHYSICS_PARAMS)
  const [showPhysicsControls, setShowPhysicsControls] = useState(false)
  const [physicsEnabled, setPhysicsEnabled] = useState(true)

  // PERFORMANCE: Restart rendering when physics are enabled or data changes
  useEffect(() => {
    needsRenderRef.current = true
    // Mark all layers as dirty when data changes significantly
    dirtyLayersRef.current.background = true
    dirtyLayersRef.current.edges = true
    dirtyLayersRef.current.nodes = true
    dirtyLayersRef.current.overlay = true
  }, [physicsEnabled, nodes, edges])

  // Node deviation factors - each node gets a random multiplier based on chaos factor
  const [nodeDeviationFactors, setNodeDeviationFactors] = useState<Map<string, number>>(new Map())

  // Visualization features
  const [showMinimap, setShowMinimap] = useState(false)
  const [showHulls, setShowHulls] = useState(false)
  const [showGraphInfo, setShowGraphInfo] = useState(false)
  const [clusterHulls, setClusterHulls] = useState<Map<number, { x: number; y: number }[]>>(new Map())
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<Set<string>>(new Set())
  const [edgeDistances, setEdgeDistances] = useState<Map<string, number>>(new Map())
  const [edgeFlowDirections, setEdgeFlowDirections] = useState<Map<string, boolean>>(new Map()) // true = forward (source->target), false = reverse

  // View controls
  const [isLocked, setIsLocked] = useState(false)
  const [rotation, setRotation] = useState(0) // in degrees
  const [targetZoom, setTargetZoom] = useState(1)
  const [targetPanOffset, setTargetPanOffset] = useState({ x: 0, y: 0 })
  const [targetRotation, setTargetRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  // Highlight edge customization
  const [highlightEdgeSettings, setHighlightEdgeSettings] = useState<HighlightEdgeSettings>(DEFAULT_HIGHLIGHT_EDGE_SETTINGS)

  const [showHighlightSettings, setShowHighlightSettings] = useState(false)
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false)
  const [showHighlightPanel, setShowHighlightPanel] = useState(false)
  const [topModal, setTopModal] = useState<'physics' | 'highlight' | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.export-menu-container')) {
        setShowExportMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showExportMenu])

  // PERFORMANCE: Mark layers dirty when visual settings change
  useEffect(() => {
    needsRenderRef.current = true
    dirtyLayersRef.current.background = true // Hulls and swimlanes are on background
  }, [showHulls, swimlanes])

  // PERFORMANCE: Mark layers dirty when selection or highlighting changes
  useEffect(() => {
    needsRenderRef.current = true
    dirtyLayersRef.current.edges = true // Highlighted edges
    dirtyLayersRef.current.nodes = true // Selected nodes
    dirtyLayersRef.current.overlay = true // Selection indicators
  }, [selectedNodeId, highlightedEdgeIds, edgeDistances, highlightEdgeSettings])

  // PERFORMANCE OPTIMIZATION: Cache adjacency map and node map
  // These are static data structures that only change when nodes/edges change
  // Building them every frame (60x/second) is wasteful
  const { adjacencyMap, nodeMap } = useMemo(() => {
    const adjacency = new Map<string, Set<string>>()
    const nodeMapping = new Map(nodes.map(n => [n.id, n]))

    // Initialize empty adjacency sets for all nodes
    nodes.forEach(n => adjacency.set(n.id, new Set()))

    // Populate adjacency relationships from edges
    edges.forEach(edge => {
      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    })

    return { adjacencyMap: adjacency, nodeMap: nodeMapping }
  }, [nodes, edges])

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

  // PHASE 2 OPTIMIZATION: Template/Rule Result Caching
  // Cache rule evaluation results to avoid re-evaluating on every frame (15-25% speedup)
  // Only recalculate when nodes, edges, templates, or rules change
  const evaluatedNodeTemplates = useMemo(() => {
    const cache = new Map<string, { cardTemplateId: string | undefined }>()
    const rules = getEnabledRules()

    nodes.forEach(node => {
      const ruleResult = evaluateNodeRules(node, rules)
      cache.set(node.id, {
        cardTemplateId: ruleResult.cardTemplateId || node.cardTemplateId
      })
    })

    return cache
  }, [nodes, styleRules, cardTemplates]) // Recalculate when nodes, rules, or templates change

  const evaluatedEdgeTemplates = useMemo(() => {
    const cache = new Map<string, { edgeTemplateId: string | undefined }>()
    const rules = getEnabledRules()

    edges.forEach(edge => {
      const ruleResult = evaluateEdgeRules(edge, rules)
      cache.set(edge.id, {
        edgeTemplateId: ruleResult.edgeTemplateId || edge.edgeTemplateId
      })
    })

    return cache
  }, [edges, styleRules, edgeTemplates]) // Recalculate when edges, rules, or templates change

  // PHASE 2 OPTIMIZATION: Text Measurement Caching
  // Pre-measure all text to avoid calling ctx.measureText() every frame (10-15% speedup)
  // This is especially important for autoFit cards that measure multiple text strings
  const textMeasurements = useMemo(() => {
    const cache = new Map<string, { width: number; height: number }>()

    // Create a temporary canvas for measuring text
    const tempCanvas = document.createElement('canvas')
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return cache

    nodes.forEach(node => {
      const cachedTemplate = evaluatedNodeTemplates.get(node.id)
      const templateId = cachedTemplate?.cardTemplateId || node.cardTemplateId
      const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined

      // Only measure if autoFit is enabled
      if (cardTemplate?.autoFit) {
        // Measure node label
        const labelFont = '12px sans-serif'
        const labelKey = `${node.label}-${labelFont}`
        if (!cache.has(labelKey)) {
          tempCtx.font = labelFont
          const metrics = tempCtx.measureText(node.label)
          cache.set(labelKey, { width: metrics.width, height: 20 })
        }

        // Measure visible attributes
        if (cardTemplate?.attributeDisplays && cardTemplate.attributeDisplays.length > 0) {
          const visibleAttrs = cardTemplate.attributeDisplays
            .filter((attrDisplay) => attrDisplay.visible)

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
              const font = `${fontSize}px sans-serif`
              const labelText = attrDisplay.displayLabel || attrDisplay.attributeName
              const prefix = attrDisplay.prefix || ''
              const suffix = attrDisplay.suffix || ''
              const fullText = `${prefix}${labelText}: ${attrValue}${suffix}`
              const textKey = `${fullText}-${font}`

              if (!cache.has(textKey)) {
                tempCtx.font = font
                const metrics = tempCtx.measureText(fullText)
                cache.set(textKey, { width: metrics.width, height: fontSize + 4 })
              }
            }
          })
        }
      }
    })

    return cache
  }, [nodes, evaluatedNodeTemplates, cardTemplates]) // Recalculate when nodes or templates change

  // Export handler for SVG - exports full graph as SVG
  const handleExportSVG = useCallback(() => {
    if (!canvasRef.current || !viewportRef.current) return;

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
        shape: cardTemplate?.shape || 'rect',
        sizeMultiplier: cardTemplate?.size || 1,
        icon: cardTemplate?.icon,
        iconSize: cardTemplate?.iconSize,
        iconColor: cardTemplate?.iconColor,
        isStub: node.isStub,
        label: node.label,
        attributes: node.attributes,
        attributeDisplays: cardTemplate?.attributeDisplays,
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

    // Export as SVG
    exportAsSVG(
      nodes,
      edges,
      metaNodes,
      nodePositions,
      metaNodePositions,
      nodeStyles,
      edgeStyles,
      'raptorgraph-export'
    )
  }, [nodes, edges, metaNodes, nodePositions, metaNodePositions, getEnabledRules, getCardTemplateById, getEdgeTemplateById, getDefaultEdgeTemplate, exportAsSVG])

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

  // Effect to calculate and highlight shortest paths from selected node/meta-node to all stub nodes
  useEffect(() => {
    console.log('>>> Path highlighting useEffect triggered. selectedNodeId=', selectedNodeId, 'selectedMetaNodeId=', selectedMetaNodeId)

    // Determine starting nodes based on selection
    let startNodeIds: string[] = []

    if (selectedNodeId) {
      // Regular node selected
      startNodeIds = [selectedNodeId]
      console.log('Path highlighting: Selected regular node', selectedNodeId)
    } else if (selectedMetaNodeId) {
      // Meta-node selected - use all its child nodes as starting points
      const metaNode = metaNodes.find(mn => mn.id === selectedMetaNodeId)
      if (metaNode) {
        startNodeIds = metaNode.childNodeIds
        console.log('Path highlighting: Selected meta-node', selectedMetaNodeId, 'with children', startNodeIds)
      }
    }

    if (startNodeIds.length === 0) {
      console.log('Path highlighting: No nodes selected, clearing highlights')
      setHighlightedEdgeIds(new Set())
      setEdgeDistances(new Map())
      setEdgeFlowDirections(new Map())
      return
    }

    // Build adjacency map with edge IDs and direction info
    const adjacency = new Map<string, { nodeId: string; edgeId: string; isForward: boolean }[]>()
    nodes.forEach(node => adjacency.set(node.id, []))
    edges.forEach(edge => {
      // When traversing source -> target, it's "forward" (true)
      adjacency.get(edge.source)?.push({ nodeId: edge.target, edgeId: edge.id, isForward: true })
      // When traversing target -> source, it's "reverse" (false)
      adjacency.get(edge.target)?.push({ nodeId: edge.source, edgeId: edge.id, isForward: false })
    })

    // Find stub/leaf nodes
    // First try to find nodes with isStub property, otherwise use leaf nodes (degree 1)
    let stubNodeIds = new Set(nodes.filter(n => n.isStub).map(n => n.id))
    console.log('Path highlighting: Found', stubNodeIds.size, 'stub nodes')

    // If no stub nodes found, use leaf nodes (degree 1)
    if (stubNodeIds.size === 0) {
      stubNodeIds = new Set(
        nodes.filter(n => {
          const neighbors = adjacency.get(n.id) || []
          return neighbors.length === 1
        }).map(n => n.id)
      )
      console.log('Path highlighting: Using', stubNodeIds.size, 'leaf nodes instead')
    }

    // If still no target nodes, just highlight all connected edges
    if (stubNodeIds.size === 0) {
      console.log('Path highlighting: No stub or leaf nodes found!')
      setHighlightedEdgeIds(new Set())
      setEdgeDistances(new Map())
      setEdgeFlowDirections(new Map())
      return
    }

    // BFS from all starting nodes to find shortest paths to all stub/leaf nodes
    // Exclude starting nodes from target stubs (don't find path from stub to itself)
    const targetStubIds = new Set(
      Array.from(stubNodeIds).filter(id => !startNodeIds.includes(id))
    )
    console.log('Path highlighting: Targeting', targetStubIds.size, 'stub nodes (excluding', startNodeIds.length, 'starting nodes)')

    const visited = new Set<string>(startNodeIds)
    const queue: { nodeId: string; distance: number; path: { edgeId: string; isForward: boolean }[] }[] =
      startNodeIds.map(nodeId => ({ nodeId, distance: 0, path: [] }))

    const edgeDistanceMap = new Map<string, number>()
    const edgeDirectionMap = new Map<string, boolean>()
    const allPaths = new Set<string>()
    const foundStubs = new Set<string>()
    const pathsToStubs = new Map<string, { edgeId: string; isForward: boolean }[]>() // stub nodeId -> edge path with direction

    let iterations = 0
    const maxIterations = 10000 // Safety limit

    while (queue.length > 0 && iterations < maxIterations) {
      iterations++
      const { nodeId, distance, path } = queue.shift()!

      // Check if current node is a target stub
      const isTargetStub = targetStubIds.has(nodeId)

      // If this is a target stub node and we haven't already found a path to it, save it
      if (isTargetStub && distance > 0 && !pathsToStubs.has(nodeId)) {
        foundStubs.add(nodeId)
        pathsToStubs.set(nodeId, path)
        // Add all edges in this path to the highlight set with their distances and directions
        path.forEach((pathEdge, index) => {
          allPaths.add(pathEdge.edgeId)
          // Only set distance and direction if not already set (prefer shorter paths)
          if (!edgeDistanceMap.has(pathEdge.edgeId)) {
            edgeDistanceMap.set(pathEdge.edgeId, index + 1)
            edgeDirectionMap.set(pathEdge.edgeId, pathEdge.isForward)
          }
        })
        // IMPORTANT: Continue BFS to find other stub nodes beyond this one
      }

      // Continue BFS to neighbors
      const neighbors = adjacency.get(nodeId) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.nodeId)) {
          visited.add(neighbor.nodeId)
          const newPath = [...path, { edgeId: neighbor.edgeId, isForward: neighbor.isForward }]
          queue.push({
            nodeId: neighbor.nodeId,
            distance: distance + 1,
            path: newPath
          })
        }
      }
    }

    console.log('Path highlighting: BFS iterations:', iterations, 'visited:', visited.size, 'nodes')

    console.log('Path highlighting: Highlighting', allPaths.size, 'edges. Found', foundStubs.size, 'stub nodes')
    console.log('Path highlighting: Distance map:', Array.from(edgeDistanceMap.entries()).slice(0, 5))

    setHighlightedEdgeIds(allPaths)
    setEdgeDistances(edgeDistanceMap)
    setEdgeFlowDirections(edgeDirectionMap)
  }, [selectedNodeId, selectedMetaNodeId, nodes, edges, metaNodes])

  // Mouse event handlers for dragging and panning
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !viewportRef.current) return;
    const viewport = viewportRef.current;
    const { width, height } = canvasRef.current;

    const rect = canvasRef.current.getBoundingClientRect();
    const screenX = (e.clientX - rect.left) * (width / rect.width);
    const screenY = (e.clientY - rect.top) * (height / rect.height);

    const worldPos = viewport.screenToWorld({ x: screenX, y: screenY });

    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
      return;
    }

    // Base card dimensions in world coordinates
    const baseCardWidth = 120;
    const baseCardHeight = 60;

    // Hit detection for meta-nodes (use larger hit box)
    for (const [metaNodeId, pos] of Array.from(metaNodePositions.entries()).reverse()) {
      // Meta-nodes can be larger, so use a generous hit box
      const hitWidth = 150;
      const hitHeight = 100;
      if (Math.abs(worldPos.x - pos.x) < hitWidth / 2 && Math.abs(worldPos.y - pos.y) < hitHeight / 2) {
        setSelectedMetaNodeId(metaNodeId);
        setSelectedNodeId(null);
        if (!isLocked) {
          setDraggedNodeId(metaNodeId);
          setDragOffset({ x: worldPos.x - pos.x, y: worldPos.y - pos.y });
        }
        return;
      }
    }

    // Hit detection for regular nodes (use base card dimensions)
    for (const [nodeId, pos] of Array.from(nodePositions.entries()).reverse()) {
      const node = nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Get the card template to determine actual size
      const cardTemplate = node.cardTemplateId ? getCardTemplateById(node.cardTemplateId) : undefined;
      const sizeMultiplier = cardTemplate?.size || 1;
      const cardWidth = baseCardWidth * sizeMultiplier;
      const cardHeight = baseCardHeight * sizeMultiplier;

      // Check if click is within the card bounds
      if (Math.abs(worldPos.x - pos.x) < cardWidth / 2 && Math.abs(worldPos.y - pos.y) < cardHeight / 2) {
        setSelectedNodeId(nodeId);
        setSelectedMetaNodeId(null);
        if (!isLocked) {
          setDraggedNodeId(nodeId);
          setDragOffset({ x: worldPos.x - pos.x, y: worldPos.y - pos.y });
        }
        return;
      }
    }

    // If no node was hit, start panning
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
  }, [nodePositions, metaNodePositions, isLocked, setSelectedNodeId, setSelectedMetaNodeId, nodes, getCardTemplateById]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !viewportRef.current) return;
    const viewport = viewportRef.current;

    // Handle panning
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      viewport.pan.x += dx;
      viewport.pan.y += dy;
      setPanStart({ x: e.clientX, y: e.clientY });
      setViewportState(viewport.getTransform()); // Trigger re-render;
      return;
    }

    // Handle node/meta-node dragging
    if (draggedNodeId) {
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = (e.clientX - rect.left) * (canvasRef.current.width / rect.width);
      const screenY = (e.clientY - rect.top) * (canvasRef.current.height / rect.height);
      const worldPos = viewport.screenToWorld({ x: screenX, y: screenY });

      const newX = worldPos.x - dragOffset.x;
      const newY = worldPos.y - dragOffset.y;

      const isMetaNode = metaNodePositions.has(draggedNodeId);

      if (isMetaNode) {
        setMetaNodePositions(prev => new Map(prev).set(draggedNodeId, { ...prev.get(draggedNodeId)!, x: newX, y: newY }));
        setTargetMetaNodePositions(prev => new Map(prev).set(draggedNodeId, { x: newX, y: newY }));
        setManuallyPositionedMetaNodes(prev => new Set(prev).add(draggedNodeId));
      } else {
        const belongsToGroup = metaNodes.find(mn => mn.childNodeIds.includes(draggedNodeId));
        setNodePositions(prev => {
          const newPositions = new Map(prev);
          const currentPos = newPositions.get(draggedNodeId);
          if (currentPos) {
            const dx = newX - currentPos.x;
            const dy = newY - currentPos.y;

            if (belongsToGroup) {
              belongsToGroup.childNodeIds.forEach(nodeId => {
                const nodePos = newPositions.get(nodeId);
                if (nodePos) {
                  newPositions.set(nodeId, { ...nodePos, x: nodePos.x + dx, y: nodePos.y + dy });
                }
              });
            } else {
              newPositions.set(draggedNodeId, { ...currentPos, x: newX, y: newY });
            }
          }
          return newPositions;
        });
      }
    }
  }, [draggedNodeId, dragOffset, isPanning, panStart, metaNodePositions, metaNodes, nodePositions]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Stop panning
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (!draggedNodeId) return

    // If no significant drag occurred, treat it as a click
    const canvas = canvasRef.current
    if (!canvas || !viewportRef.current) {
      setDraggedNodeId(null)
      return
    }

    const viewport = viewportRef.current
    const { width, height } = canvas
    const rect = canvas.getBoundingClientRect()
    const screenX = (e.clientX - rect.left) * (width / rect.width)
    const screenY = (e.clientY - rect.top) * (height / rect.height)
    const worldPos = viewport.screenToWorld({ x: screenX, y: screenY })

    // Check if draggedNodeId is a meta-node or regular node
    const pos = nodePositions.get(draggedNodeId) || metaNodePositions.get(draggedNodeId)
    if (pos) {
      const dragDistance = Math.sqrt((worldPos.x - pos.x - dragOffset.x) ** 2 + (worldPos.y - pos.y - dragOffset.y) ** 2)

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
  }, [draggedNodeId, nodePositions, dragOffset, metaNodePositions, metaNodes, setSelectedNodeId, setSelectedMetaNodeId, isPanning])

  // Handle mouse wheel for zooming - zoom towards cursor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!viewportRef.current) return;
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
      
      viewportRef.current.handleZoom(mouseX, mouseY, e.deltaY);
      
      // Force re-render by updating state
      setViewportState(viewportRef.current.getTransform());
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []); // Empty dependency array, runs once


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
    if (!overlayCanvasRef.current || nodes.length === 0 || nodePositions.size === 0) return

    // Get all canvas refs
    const bgCanvas = backgroundCanvasRef.current
    const edgeCanvas = edgeCanvasRef.current
    const nodeCanvas = nodeCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current

    if (!bgCanvas || !edgeCanvas || !nodeCanvas || !overlayCanvas) return

    const bgCtx = bgCanvas.getContext('2d')
    const edgeCtx = edgeCanvas.getContext('2d')
    const nodeCtx = nodeCanvas.getContext('2d')
    const overlayCtx = overlayCanvas.getContext('2d')

    if (!bgCtx || !edgeCtx || !nodeCtx || !overlayCtx) return

    // Keep legacy canvas ref for compatibility
    canvasRef.current = overlayCanvas

    // Cancel any existing animation frame
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }

    const render = () => {
      // PERFORMANCE: Calculate FPS
      frameCountRef.current++
      const now = performance.now()
      if (now - lastFpsUpdateRef.current >= 1000) {
        setFps(frameCountRef.current)
        frameCountRef.current = 0
        lastFpsUpdateRef.current = now
      }

      // Update animation time for effects
      setAnimationTime((prev) => prev + 0.016) // Assuming ~60fps
      // Only increment iteration count if physics is enabled
      if (physicsEnabled) {
        setIterationCount((prev) => Math.min(prev + 1, maxIterations))
      }

      // FORCE-DIRECTED LAYOUT: Fruchterman-Reingold with family-based spacing
      setNodePositions((prev) => {
        const updated = new Map<string, NodePosition>()
        const canvas = canvasRef.current
        if (!canvas) return prev

        // Use cached adjacency map (with fallback for initial render)
        // During first render, adjacencyMap might not be ready due to React timing
        let adjacency = adjacencyMap
        if (!adjacency || adjacency.size === 0) {
          // Fallback: rebuild adjacency map (only happens on first frame)
          adjacency = new Map<string, Set<string>>()
          nodes.forEach(n => adjacency.set(n.id, new Set()))
          edges.forEach(edge => {
            adjacency.get(edge.source)?.add(edge.target)
            adjacency.get(edge.target)?.add(edge.source)
          })
        }

        // Node sizing constants (used by drag physics and main physics)
        const nodeRadius = 60
        const minDistance = nodeRadius * 2.5

        // FOUR-PHASE LAYOUT APPROACH:
        // Phase 1 (0-250): Explosion - push clusters apart, leaves spread with parents
        // Phase 2 (250-350): Leaf retraction - pull leaves closer to parents
        // Phase 3 (350-450): Non-overlap enforcement - create clean spacing
        // Phase 4 (450-500): Final leaf snap - ultra-tight leaf positioning, creating hallways

        if (iterationCount >= maxIterations || !physicsEnabled) {
          // After all phases complete or if physics is disabled, only handle dragging
          if (draggedNodeId) {
            const updated = new Map<string, NodePosition>()
            prev.forEach((pos, id) => updated.set(id, { ...pos }))
            const draggedPos = prev.get(draggedNodeId)
            if (draggedPos) {
              // If physics is disabled, only move the dragged node - anchor all others
              if (!physicsEnabled) {
                // Physics disabled: only the dragged node moves, all others stay frozen
                return updated
              }

              // Physics enabled but simulation complete: apply spring forces to connected nodes
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

        // Use extracted physics engine for force-directed layout
        return calculatePhysicsFrame({
          nodes,
          positions: prev,
          adjacency,
          physicsParams,
          nodeDeviationFactors,
          draggedNodeId,
          canvasWidth: canvas.offsetWidth,
          canvasHeight: canvas.offsetHeight,
          iterationCount,
          maxIterations,
          nodeRadius
        })
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

      // PERFORMANCE: Only resize canvases when dimensions actually change
      // Resetting dimensions clears GPU-cached paths, forcing re-rasterization
      const newWidth = overlayCanvas.offsetWidth
      const newHeight = overlayCanvas.offsetHeight
      if (canvasDimensionsRef.current.width !== newWidth ||
          canvasDimensionsRef.current.height !== newHeight) {
        // Resize all canvases
        bgCanvas.width = newWidth
        bgCanvas.height = newHeight
        edgeCanvas.width = newWidth
        edgeCanvas.height = newHeight
        nodeCanvas.width = newWidth
        nodeCanvas.height = newHeight
        overlayCanvas.width = newWidth
        overlayCanvas.height = newHeight
        canvasDimensionsRef.current = { width: newWidth, height: newHeight }

        // Mark all layers as dirty when dimensions change
        dirtyLayersRef.current.background = true
        dirtyLayersRef.current.edges = true
        dirtyLayersRef.current.nodes = true
        dirtyLayersRef.current.overlay = true
      }

      // ===================================================================
      // LAYERED RENDERING FUNCTIONS
      // ===================================================================

      // Layer 0: Background (swimlanes, cluster hulls)
      const renderBackgroundLayer = () => {
        if (!dirtyLayersRef.current.background) return

        // Clear background canvas
        bgCtx.fillStyle = '#0f172a'
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height)

        // Save context and apply viewport transform
        bgCtx.save()
        if (viewportRef.current) {
          viewportRef.current.applyToContext(bgCtx)
        }

        // Draw swimlanes if in timeline mode
        if (swimlanes.size > 0) {
          const sortedSwimlanes = Array.from(swimlanes.entries()).sort((a, b) => a[1] - b[1])

          sortedSwimlanes.forEach(([label, yPos], i) => {
            // Draw swimlane background
            const swimlaneHeight = i < sortedSwimlanes.length - 1
              ? sortedSwimlanes[i + 1][1] - yPos
              : bgCanvas.height - yPos

            bgCtx.fillStyle = i % 2 === 0 ? '#1e293b' : '#0f172a'
            bgCtx.fillRect(0, yPos - swimlaneHeight / 2, bgCanvas.width, swimlaneHeight)

            // Draw swimlane label
            bgCtx.fillStyle = '#64748b'
            bgCtx.font = '12px sans-serif'
            bgCtx.textAlign = 'left'
            bgCtx.textBaseline = 'middle'
            bgCtx.fillText(label, 10, yPos)

            // Draw horizontal line
            bgCtx.strokeStyle = '#334155'
            bgCtx.lineWidth = 1
            bgCtx.beginPath()
            bgCtx.moveTo(0, yPos - swimlaneHeight / 2)
            bgCtx.lineTo(bgCanvas.width, yPos - swimlaneHeight / 2)
            bgCtx.stroke()
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
            bgCtx.fillStyle = clusterColors[colorIndex]
            bgCtx.strokeStyle = clusterBorderColors[colorIndex]
            bgCtx.lineWidth = 2
            bgCtx.setLineDash([5, 5])

            bgCtx.beginPath()
            bgCtx.moveTo(hullPoints[0].x, hullPoints[0].y)
            for (let i = 1; i < hullPoints.length; i++) {
              bgCtx.lineTo(hullPoints[i].x, hullPoints[i].y)
            }
            bgCtx.closePath()
            bgCtx.fill()
            bgCtx.stroke()

            bgCtx.setLineDash([])
          })
        }

        // Restore context
        bgCtx.restore()

        // Mark background layer as clean
        dirtyLayersRef.current.background = false
      }

      // ===================================================================
      // EDGE CROSSING DETECTION (for hop rendering)
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

      // Layer 1: Edges (connections between nodes)
      const renderEdgeLayer = () => {
        if (!dirtyLayersRef.current.edges) return

        // Clear edge canvas with transparency
        edgeCtx.clearRect(0, 0, edgeCanvas.width, edgeCanvas.height)

        // Save context and apply viewport transform
        edgeCtx.save()
        if (viewportRef.current) {
          viewportRef.current.applyToContext(edgeCtx)
        }

        // PERFORMANCE: Get visible viewport bounds for culling
        const viewportBounds = viewportRef.current?.getVisibleBounds()

        // PHASE 2 OPTIMIZATION: Canvas Path Batching
        // Group edges by their style properties to reduce state changes
        // This provides 15-20% speedup by minimizing edgeCtx.strokeStyle/lineWidth changes
        interface EdgeRenderBatch {
          edges: Array<{
            transformedEdge: typeof transformedEdges[0]
            sourcePos: { x: number; y: number }
            targetPos: { x: number; y: number }
          }>
          color: string
          width: number
          opacity: number
          style: string
          lineType: string
          lineDash: number[]
          lineDashOffset: number
        }

        const edgeBatches = new Map<string, EdgeRenderBatch>()

        // First pass: Group edges by style (only simple straight edges without animations)
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
            // PERFORMANCE: Viewport culling - skip edges completely outside visible area
            if (viewportBounds) {
              const edgeLeft = Math.min(sourcePos.x, targetPos.x)
              const edgeRight = Math.max(sourcePos.x, targetPos.x)
              const edgeTop = Math.min(sourcePos.y, targetPos.y)
              const edgeBottom = Math.max(sourcePos.y, targetPos.y)

              // Skip if edge bounding box doesn't intersect with viewport
              if (edgeRight < viewportBounds.left || edgeLeft > viewportBounds.right ||
                  edgeBottom < viewportBounds.top || edgeTop > viewportBounds.bottom) {
                return // Skip this edge - it's outside viewport
              }
            }

            // Get template
            const cachedTemplate = evaluatedEdgeTemplates.get(edge.id)
            const templateId = cachedTemplate?.edgeTemplateId || edge.edgeTemplateId
            const template = templateId
              ? getEdgeTemplateById(templateId)
              : getDefaultEdgeTemplate()

            const isHighlighted = highlightedEdgeIds.has(edge.id)
            const lineType = template?.lineType || 'straight'
            const hasCrossings = edgeCrossings.has(edge.id)

            // Only batch simple straight edges without highlights or crossings
            // Complex edges (curved, orthogonal, highlighted, with hops) render individually
            if (lineType === 'straight' && !isHighlighted && !hasCrossings) {
              const edgeColor = template?.color || '#475569'
              const edgeWidth = template?.width || 2
              const edgeOpacity = template?.opacity ?? 1
              const edgeStyle = template?.style || 'solid'

              let lineDash: number[] = []
              if (edgeStyle === 'dashed') {
                lineDash = [10, 5]
              } else if (edgeStyle === 'dotted') {
                lineDash = [2, 4]
              }

              // Create batch key from style properties
              const batchKey = `${edgeColor}-${edgeWidth}-${edgeOpacity}-${edgeStyle}`

              if (!edgeBatches.has(batchKey)) {
                edgeBatches.set(batchKey, {
                  edges: [],
                  color: edgeColor,
                  width: edgeWidth,
                  opacity: edgeOpacity,
                  style: edgeStyle,
                  lineType,
                  lineDash,
                  lineDashOffset: 0
                })
              }

              edgeBatches.get(batchKey)!.edges.push({
                transformedEdge,
                sourcePos,
                targetPos
              })
            }
          }
        })

        // Second pass: Draw batched edges (grouped by style)
        edgeBatches.forEach((batch) => {
          // Set style once for the entire batch
          edgeCtx.strokeStyle = batch.color
          edgeCtx.lineWidth = batch.width
          edgeCtx.globalAlpha = batch.opacity
          edgeCtx.setLineDash(batch.lineDash)
          edgeCtx.lineDashOffset = batch.lineDashOffset

          // Draw all edges in this batch
          batch.edges.forEach(({ sourcePos, targetPos }) => {
            edgeCtx.beginPath()
            edgeCtx.moveTo(sourcePos.x, sourcePos.y)
            edgeCtx.lineTo(targetPos.x, targetPos.y)
            edgeCtx.stroke()
          })

          // Reset line dash
          edgeCtx.setLineDash([])
          edgeCtx.globalAlpha = 1
        })

        // Third pass: Draw complex edges individually (curved, orthogonal, highlighted, with hops)
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
            // PERFORMANCE: Viewport culling - skip edges completely outside visible area
            if (viewportBounds) {
              const edgeLeft = Math.min(sourcePos.x, targetPos.x)
              const edgeRight = Math.max(sourcePos.x, targetPos.x)
              const edgeTop = Math.min(sourcePos.y, targetPos.y)
              const edgeBottom = Math.max(sourcePos.y, targetPos.y)

              // Skip if edge bounding box doesn't intersect with viewport
              if (edgeRight < viewportBounds.left || edgeLeft > viewportBounds.right ||
                  edgeBottom < viewportBounds.top || edgeTop > viewportBounds.bottom) {
                return // Skip this edge - it's outside viewport
              }
            }
            // PHASE 2 OPTIMIZATION: Use cached template evaluation results
            const cachedTemplate = evaluatedEdgeTemplates.get(edge.id)
            const templateId = cachedTemplate?.edgeTemplateId || edge.edgeTemplateId
            const template = templateId
              ? getEdgeTemplateById(templateId)
              : getDefaultEdgeTemplate()

            const lineType = template?.lineType || 'straight'
            const hasCrossings = edgeCrossings.has(edge.id)

            // Check if this edge is highlighted (shortest path from selected node to non-leaf nodes)
            const isHighlighted = highlightedEdgeIds.has(edge.id)

            // Skip simple straight edges without highlights or crossings (already batched)
            if (lineType === 'straight' && !isHighlighted && !hasCrossings) {
              return // Already drawn in batch
            }

            // Calculate opacity and width based on distance from selected node (gradient effect)
            let highlightOpacity = 1
            let highlightWidth = highlightEdgeSettings.width
            if (isHighlighted) {
              const distance = edgeDistances.get(edge.id) || 1

              // Color fade: Fade from 1.0 (distance 1) to 0.3 (distance 5+)
              if (highlightEdgeSettings.colorFade) {
                highlightOpacity = Math.max(0.3, 1.0 - (distance - 1) * 0.15)
              }

              // Size fade: Fade from full width (distance 1) to half width (distance 5+)
              if (highlightEdgeSettings.sizeFade) {
                const fadeFactor = Math.max(0.5, 1.0 - (distance - 1) * 0.1)
                highlightWidth = highlightEdgeSettings.width * fadeFactor
              }
            }

            // Apply template or use defaults, with highlighting override
            const edgeColor = isHighlighted ? highlightEdgeSettings.color : (template?.color || '#475569')
            const edgeWidth = isHighlighted ? highlightWidth : (template?.width || 2)
            const edgeOpacity = isHighlighted ? highlightOpacity : (template?.opacity ?? 1)
            const edgeStyle = template?.style || 'solid'
            // lineType already declared above for batching logic
            const arrowType = template?.arrowType || 'default'
            const arrowPosition = template?.arrowPosition || 'end'
            const edgeLabel = template?.label || edge.label

            // Set line dash array based on style
            if (isHighlighted && highlightEdgeSettings.animation) {
              // Animated dashed line for flow effect
              const flowDirection = edgeFlowDirections.get(edge.id) ?? true
              // Flow outward from selected node (forward = positive offset, reverse = negative offset)
              const flowMultiplier = flowDirection ? 1 : -1
              edgeCtx.setLineDash([20, 10])
              edgeCtx.lineDashOffset = flowMultiplier * animationTime * 15 // Much faster flow (15x speed)
            } else if (edgeStyle === 'dashed') {
              edgeCtx.setLineDash([10, 5])
              edgeCtx.lineDashOffset = 0
            } else if (edgeStyle === 'dotted') {
              edgeCtx.setLineDash([2, 4])
              edgeCtx.lineDashOffset = 0
            } else {
              edgeCtx.setLineDash([])
              edgeCtx.lineDashOffset = 0
            }

            // Draw edge line based on line type
            edgeCtx.strokeStyle = edgeColor
            edgeCtx.lineWidth = edgeWidth
            edgeCtx.globalAlpha = edgeOpacity

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

              edgeCtx.beginPath()
              edgeCtx.moveTo(sourcePos.x, sourcePos.y)
              edgeCtx.quadraticCurveTo(
                controlX + offsetX,
                controlY + offsetY,
                targetPos.x,
                targetPos.y
              )
              edgeCtx.stroke()
            } else if (lineType === 'orthogonal') {
              // 90-degree turns
              const midX = (sourcePos.x + targetPos.x) / 2
              edgeCtx.beginPath()
              edgeCtx.moveTo(sourcePos.x, sourcePos.y)
              edgeCtx.lineTo(midX, sourcePos.y)
              edgeCtx.lineTo(midX, targetPos.y)
              edgeCtx.lineTo(targetPos.x, targetPos.y)
              edgeCtx.stroke()
            } else {
              // Straight line (default) - with hop arcs at crossings
              const crossings = edgeCrossings.get(edge.id) || []

              if (crossings.length === 0) {
                // No crossings - draw normal line
                edgeCtx.beginPath()
                edgeCtx.moveTo(sourcePos.x, sourcePos.y)
                edgeCtx.lineTo(targetPos.x, targetPos.y)
                edgeCtx.stroke()
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
                edgeCtx.beginPath()
                edgeCtx.moveTo(sourcePos.x, sourcePos.y)

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
                  edgeCtx.lineTo(beforeX, beforeY)

                  // Draw arc over crossing
                  edgeCtx.quadraticCurveTo(arcX, arcY, afterX, afterY)
                })

                // Draw final segment to target
                edgeCtx.lineTo(targetPos.x, targetPos.y)
                edgeCtx.stroke()
              }
            }

            // Reset line dash
            edgeCtx.setLineDash([])

            // Helper function to draw arrow at a position
            const drawArrow = (x: number, y: number, angle: number) => {
              edgeCtx.fillStyle = edgeColor

              if (arrowType === 'default') {
                const arrowSize = 8
                edgeCtx.beginPath()
                edgeCtx.moveTo(x, y)
                edgeCtx.lineTo(
                  x - arrowSize * Math.cos(angle - Math.PI / 6),
                  y - arrowSize * Math.sin(angle - Math.PI / 6)
                )
                edgeCtx.lineTo(
                  x - arrowSize * Math.cos(angle + Math.PI / 6),
                  y - arrowSize * Math.sin(angle + Math.PI / 6)
                )
                edgeCtx.closePath()
                edgeCtx.fill()
              } else if (arrowType === 'triangle') {
                const arrowSize = 12
                edgeCtx.beginPath()
                edgeCtx.moveTo(x, y)
                edgeCtx.lineTo(
                  x - arrowSize * Math.cos(angle - Math.PI / 8),
                  y - arrowSize * Math.sin(angle - Math.PI / 8)
                )
                edgeCtx.lineTo(
                  x - arrowSize * Math.cos(angle + Math.PI / 8),
                  y - arrowSize * Math.sin(angle + Math.PI / 8)
                )
                edgeCtx.closePath()
                edgeCtx.fill()
              } else if (arrowType === 'circle') {
                const circleRadius = 4
                edgeCtx.beginPath()
                edgeCtx.arc(x, y, circleRadius, 0, Math.PI * 2)
                edgeCtx.fill()
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

              edgeCtx.fillStyle = '#e2e8f0'
              edgeCtx.font = '11px sans-serif'
              edgeCtx.textAlign = 'center'
              edgeCtx.textBaseline = 'middle'
              edgeCtx.fillText(edgeLabel, midX, midY - 10)
            }

            // Reset global alpha
            edgeCtx.globalAlpha = 1
          }
        })

        // Restore context
        edgeCtx.restore()

        // Mark edge layer as clean
        dirtyLayersRef.current.edges = false
      }

      // Layer 2: Nodes (meta-nodes and regular nodes)
      const renderNodeLayer = () => {
        if (!dirtyLayersRef.current.nodes) return

        // Clear node canvas with transparency
        nodeCtx.clearRect(0, 0, nodeCanvas.width, nodeCanvas.height)

        // Save context and apply viewport transform
        nodeCtx.save()
        if (viewportRef.current) {
          viewportRef.current.applyToContext(nodeCtx)
        }

        // PERFORMANCE: Get visible viewport bounds for culling
        const viewportBounds = viewportRef.current?.getVisibleBounds()

        // Draw meta-nodes
        visibleMetaNodes.forEach((metaNode) => {
          const pos = metaNodePositions.get(metaNode.id)
          if (!pos) return

          // PERFORMANCE: Viewport culling for meta-nodes
          // Meta-nodes can be large, use generous margin
          const metaNodeMargin = 500
          if (viewportBounds) {
            if (pos.x + metaNodeMargin < viewportBounds.left || pos.x - metaNodeMargin > viewportBounds.right ||
                pos.y + metaNodeMargin < viewportBounds.top || pos.y - metaNodeMargin > viewportBounds.bottom) {
              return // Skip this meta-node - it's outside viewport
            }
          }

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
            // PHASE 2 OPTIMIZATION: Use cached template evaluation results
            const cachedTemplate = evaluatedNodeTemplates.get(node.id)
            const templateId = cachedTemplate?.cardTemplateId || node.cardTemplateId
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
          nodeCtx.fillStyle = '#0f172a'
          nodeCtx.strokeStyle = '#3b82f6'
          nodeCtx.lineWidth = 4

          nodeCtx.beginPath()
          nodeCtx.moveTo(containerX + radius, containerY)
          nodeCtx.lineTo(containerX + containerWidth - radius, containerY)
          nodeCtx.quadraticCurveTo(containerX + containerWidth, containerY, containerX + containerWidth, containerY + radius)
          nodeCtx.lineTo(containerX + containerWidth, containerY + containerHeight - radius)
          nodeCtx.quadraticCurveTo(containerX + containerWidth, containerY + containerHeight, containerX + containerWidth - radius, containerY + containerHeight)
          nodeCtx.lineTo(containerX + radius, containerY + containerHeight)
          nodeCtx.quadraticCurveTo(containerX, containerY + containerHeight, containerX, containerY + containerHeight - radius)
          nodeCtx.lineTo(containerX, containerY + radius)
          nodeCtx.quadraticCurveTo(containerX, containerY, containerX + radius, containerY)
          nodeCtx.closePath()
          nodeCtx.fill()
          nodeCtx.stroke()

          // Header removed - no blue label displayed

          // Draw each contained node with full card styling
          const startX = containerX + padding
          const startY = containerY + headerHeight + padding

          containedNodes.forEach((node, idx) => {
            const row = Math.floor(idx / cols)
            const col = idx % cols
            const nodeX = startX + col * (cardWidth + spacing) + cardWidth / 2
            const nodeY = startY + row * (cardHeight + spacing) + cardHeight / 2

            // PHASE 2 OPTIMIZATION: Use cached template evaluation results
            const cachedTemplate = evaluatedNodeTemplates.get(node.id)
            const templateId = cachedTemplate?.cardTemplateId || node.cardTemplateId
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

            nodeCtx.fillStyle = bgColor
            nodeCtx.strokeStyle = borderColor
            nodeCtx.lineWidth = borderWidth

            // Draw shape based on template
            nodeCtx.beginPath()

            switch (shape) {
              case 'circle':
                const circleRadius = Math.min(nodeCardWidth, nodeCardHeight) / 2
                nodeCtx.arc(nodeX, nodeY, circleRadius, 0, Math.PI * 2)
                break

              case 'ellipse':
                nodeCtx.ellipse(nodeX, nodeY, nodeCardWidth / 2, nodeCardHeight / 2, 0, 0, Math.PI * 2)
                break

              case 'diamond':
                nodeCtx.moveTo(nodeX, y)
                nodeCtx.lineTo(x + nodeCardWidth, nodeY)
                nodeCtx.lineTo(nodeX, y + nodeCardHeight)
                nodeCtx.lineTo(x, nodeY)
                nodeCtx.closePath()
                break

              case 'triangle':
                nodeCtx.moveTo(nodeX, y)
                nodeCtx.lineTo(x + nodeCardWidth, y + nodeCardHeight)
                nodeCtx.lineTo(x, y + nodeCardHeight)
                nodeCtx.closePath()
                break

              case 'star':
                const outerRadius = Math.min(nodeCardWidth, nodeCardHeight) / 2
                const innerRadius = outerRadius * 0.4
                for (let i = 0; i < 5; i++) {
                  const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
                  const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2
                  if (i === 0) {
                    nodeCtx.moveTo(nodeX + outerRadius * Math.cos(outerAngle), nodeY + outerRadius * Math.sin(outerAngle))
                  } else {
                    nodeCtx.lineTo(nodeX + outerRadius * Math.cos(outerAngle), nodeY + outerRadius * Math.sin(outerAngle))
                  }
                  nodeCtx.lineTo(nodeX + innerRadius * Math.cos(innerAngle), nodeY + innerRadius * Math.sin(innerAngle))
                }
                nodeCtx.closePath()
                break

              case 'rect':
              default:
                const cardRadius = 8
                nodeCtx.moveTo(x + cardRadius, y)
                nodeCtx.lineTo(x + nodeCardWidth - cardRadius, y)
                nodeCtx.quadraticCurveTo(x + nodeCardWidth, y, x + nodeCardWidth, y + cardRadius)
                nodeCtx.lineTo(x + nodeCardWidth, y + nodeCardHeight - cardRadius)
                nodeCtx.quadraticCurveTo(x + nodeCardWidth, y + nodeCardHeight, x + nodeCardWidth - cardRadius, y + nodeCardHeight)
                nodeCtx.lineTo(x + cardRadius, y + nodeCardHeight)
                nodeCtx.quadraticCurveTo(x, y + nodeCardHeight, x, y + nodeCardHeight - cardRadius)
                nodeCtx.lineTo(x, y + cardRadius)
                nodeCtx.quadraticCurveTo(x, y, x + cardRadius, y)
                nodeCtx.closePath()
                break
            }

            nodeCtx.fill()
            nodeCtx.stroke()

            // Draw icon if template has one
            if (cardTemplate?.icon) {
              const iconSize = 16
              const iconX = x + 10
              const iconY = y + 10

              nodeCtx.font = `${iconSize}px sans-serif`
              nodeCtx.textAlign = 'left'
              nodeCtx.textBaseline = 'top'
              nodeCtx.fillText(cardTemplate.icon, iconX, iconY)
            }

            // Draw label
            nodeCtx.fillStyle = '#fff'
            nodeCtx.font = 'bold 11px sans-serif'
            nodeCtx.textAlign = 'center'
            nodeCtx.textBaseline = 'middle'
            nodeCtx.fillText(node.label, nodeX, y + nodeCardHeight - 15)
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

          // PERFORMANCE: Viewport culling - skip nodes outside visible area
          // Add margin to account for node size (max 240px for 2x size multiplier)
          const margin = 240
          if (viewportBounds) {
            if (pos.x + margin < viewportBounds.left || pos.x - margin > viewportBounds.right ||
                pos.y + margin < viewportBounds.top || pos.y - margin > viewportBounds.bottom) {
              return // Skip this node - it's outside viewport
            }
          }

          const isSelected = node.id === selectedNodeId

          // PHASE 2 OPTIMIZATION: Use cached template evaluation results
          const cachedTemplate = evaluatedNodeTemplates.get(node.id)
          const templateId = cachedTemplate?.cardTemplateId || node.cardTemplateId
          const cardTemplate = templateId ? getCardTemplateById(templateId) : undefined

          // Apply size multiplier from template
          const sizeMultiplier = cardTemplate?.size || 1
          let cardWidth = 120 * sizeMultiplier
          let cardHeight = 60 * sizeMultiplier

          // Auto-fit: measure all visible content and adjust card size if needed
          if (cardTemplate?.autoFit) {
            let maxWidth = 0
            let totalHeight = 0

            // PHASE 2 OPTIMIZATION: Use cached text measurements instead of nodeCtx.measureText()
            // Measure label
            const labelFont = '12px sans-serif'
            const labelKey = `${node.label}-${labelFont}`
            const labelMeasurement = textMeasurements.get(labelKey)
            if (labelMeasurement) {
              maxWidth = Math.max(maxWidth, labelMeasurement.width)
              totalHeight += labelMeasurement.height
            }

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
                  const font = `${fontSize}px sans-serif`
                  const labelText = attrDisplay.displayLabel || attrDisplay.attributeName
                  const prefix = attrDisplay.prefix || ''
                  const suffix = attrDisplay.suffix || ''
                  const fullText = `${prefix}${labelText}: ${attrValue}${suffix}`
                  const textKey = `${fullText}-${font}`

                  const measurement = textMeasurements.get(textKey)
                  if (measurement) {
                    maxWidth = Math.max(maxWidth, measurement.width)
                    totalHeight += measurement.height
                  }
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
            nodeCtx.shadowColor = effects.shadow.color
            nodeCtx.shadowBlur = effects.shadow.blur
            nodeCtx.shadowOffsetX = effects.shadow.offsetX
            nodeCtx.shadowOffsetY = effects.shadow.offsetY
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
            nodeCtx.shadowColor = glowColor
            nodeCtx.shadowBlur = effects.glow.blur * effects.glow.intensity
            nodeCtx.shadowOffsetX = 0
            nodeCtx.shadowOffsetY = 0
          }

          // Check if shape should be transparent
          const transparentShape = cardTemplate?.transparentShape || false

          nodeCtx.fillStyle = bgColor
          nodeCtx.strokeStyle = isSelected ? '#22d3ee' : borderColor
          nodeCtx.lineWidth = isSelected ? 3 : borderWidth

          // Draw shape based on template (skip if transparent)
          const adjustedWidth = cardWidth * pulseScale
          const adjustedHeight = cardHeight * pulseScale
          const x = pos.x - adjustedWidth / 2
          const y = pos.y - adjustedHeight / 2

          if (!transparentShape) {
            nodeCtx.beginPath()

            switch (shape) {
            case 'circle':
              // Draw as circle using the average of width/height as diameter
              const circleRadius = Math.min(adjustedWidth, adjustedHeight) / 2
              nodeCtx.arc(pos.x, pos.y, circleRadius * pulseScale, 0, Math.PI * 2)
              break

            case 'ellipse':
              // Draw as ellipse
              nodeCtx.ellipse(pos.x, pos.y, adjustedWidth / 2, adjustedHeight / 2, 0, 0, Math.PI * 2)
              break

            case 'diamond':
              // Draw as diamond (rotated square)
              nodeCtx.moveTo(pos.x, y) // Top point
              nodeCtx.lineTo(x + adjustedWidth, pos.y) // Right point
              nodeCtx.lineTo(pos.x, y + adjustedHeight) // Bottom point
              nodeCtx.lineTo(x, pos.y) // Left point
              nodeCtx.closePath()
              break

            case 'triangle':
              // Draw as triangle
              nodeCtx.moveTo(pos.x, y) // Top point
              nodeCtx.lineTo(x + adjustedWidth, y + adjustedHeight) // Bottom right
              nodeCtx.lineTo(x, y + adjustedHeight) // Bottom left
              nodeCtx.closePath()
              break

            case 'star':
              // Draw as 5-point star
              const outerRadius = Math.min(adjustedWidth, adjustedHeight) / 2
              const innerRadius = outerRadius * 0.4
              for (let i = 0; i < 5; i++) {
                const outerAngle = (i * 4 * Math.PI) / 5 - Math.PI / 2
                const innerAngle = ((i * 4 + 2) * Math.PI) / 5 - Math.PI / 2
                if (i === 0) {
                  nodeCtx.moveTo(pos.x + outerRadius * Math.cos(outerAngle), pos.y + outerRadius * Math.sin(outerAngle))
                } else {
                  nodeCtx.lineTo(pos.x + outerRadius * Math.cos(outerAngle), pos.y + outerRadius * Math.sin(outerAngle))
                }
                nodeCtx.lineTo(pos.x + innerRadius * Math.cos(innerAngle), pos.y + innerRadius * Math.sin(innerAngle))
              }
              nodeCtx.closePath()
              break

            case 'rect':
            default:
              // Draw as rounded rectangle (default)
              const radius = 8
              nodeCtx.moveTo(x + radius, y)
              nodeCtx.lineTo(x + adjustedWidth - radius, y)
              nodeCtx.quadraticCurveTo(x + adjustedWidth, y, x + adjustedWidth, y + radius)
              nodeCtx.lineTo(x + adjustedWidth, y + adjustedHeight - radius)
              nodeCtx.quadraticCurveTo(x + adjustedWidth, y + adjustedHeight, x + adjustedWidth - radius, y + adjustedHeight)
              nodeCtx.lineTo(x + radius, y + adjustedHeight)
              nodeCtx.quadraticCurveTo(x, y + adjustedHeight, x, y + adjustedHeight - radius)
              nodeCtx.lineTo(x, y + radius)
              nodeCtx.quadraticCurveTo(x, y, x + radius, y)
              nodeCtx.closePath()
              break
            }

            nodeCtx.fill()
            nodeCtx.stroke()
          }

          // Reset shadow after drawing shape
          nodeCtx.shadowColor = 'transparent'
          nodeCtx.shadowBlur = 0
          nodeCtx.shadowOffsetX = 0
          nodeCtx.shadowOffsetY = 0

          // Draw icon circle or template icon (if showIcon is not false)
          const showIcon = cardTemplate?.showIcon !== false
          if (showIcon) {
            const iconRadius = 16
            const iconX = pos.x
            const iconY = pos.y - 15

            if (cardTemplate?.icon) {
              // Use template icon with custom size
              const iconSize = cardTemplate.iconSize ? cardTemplate.iconSize * 16 : 16
              nodeCtx.font = `${iconSize}px sans-serif`
              nodeCtx.fillStyle = cardTemplate.iconColor || '#fff'
              nodeCtx.textAlign = 'center'
              nodeCtx.textBaseline = 'middle'
              nodeCtx.fillText(cardTemplate.icon, iconX, iconY)
            } else {
              // Default icon circle with first letter
              nodeCtx.fillStyle = node.isStub ? '#64748b' : '#06b6d4'
              nodeCtx.beginPath()
              nodeCtx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2)
              nodeCtx.fill()

              // Draw icon (simple letter)
              nodeCtx.fillStyle = '#fff'
              nodeCtx.font = 'bold 14px sans-serif'
              nodeCtx.textAlign = 'center'
              nodeCtx.textBaseline = 'middle'
              nodeCtx.fillText(node.label.charAt(0).toUpperCase(), iconX, iconY)
            }
          }

          // Draw label
          nodeCtx.fillStyle = '#e2e8f0'
          nodeCtx.font = '12px sans-serif'
          nodeCtx.textAlign = 'center'
          nodeCtx.textBaseline = 'top'
          nodeCtx.fillText(node.label, pos.x, pos.y + 8)

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

                nodeCtx.fillStyle = color
                nodeCtx.font = `${fontSize}px sans-serif`
                nodeCtx.textAlign = 'center'
                nodeCtx.textBaseline = 'top'
                nodeCtx.fillText(displayText, pos.x, yOffset)

                yOffset += fontSize + 4
              }
            })

            // Show indicator if there are more attributes
            if (visibleAttrs.length > maxAttrsToShow) {
              nodeCtx.fillStyle = '#64748b'
              nodeCtx.font = '9px sans-serif'
              nodeCtx.fillText(`+${visibleAttrs.length - maxAttrsToShow} more`, pos.x, yOffset)
            }
          }
        })

        // Restore context
        nodeCtx.restore()

        // Mark node layer as clean
        dirtyLayersRef.current.nodes = false
      }

      // Layer 3: Overlay (selection highlights, hover effects - currently transparent)
      const renderOverlayLayer = () => {
        if (!dirtyLayersRef.current.overlay) return

        // Clear overlay canvas with transparency
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

        // Save context and apply viewport transform
        overlayCtx.save()
        if (viewportRef.current) {
          viewportRef.current.applyToContext(overlayCtx)
        }

        // TODO: Add selection highlights, hover effects, etc. here in the future

        // Restore context
        overlayCtx.restore()

        // Mark overlay layer as clean
        dirtyLayersRef.current.overlay = false
      }

      // ===================================================================
      // CALL ALL LAYER RENDERING FUNCTIONS
      // ===================================================================
      renderBackgroundLayer()
      renderEdgeLayer()
      renderNodeLayer()
      renderOverlayLayer()

      // PERFORMANCE: Motion detection - mark layers dirty based on what changed
      let hasMotion = false

      // Check if physics is active
      if (physicsEnabled && iterationCount < maxIterations) {
        hasMotion = true
        // Physics running: edges and nodes need updates
        dirtyLayersRef.current.edges = true
        dirtyLayersRef.current.nodes = true
      }

      // Check if dragging
      if (draggedNodeId) {
        hasMotion = true
        // Dragging: edges and nodes need updates
        dirtyLayersRef.current.edges = true
        dirtyLayersRef.current.nodes = true
      }

      // Check if node positions changed
      if (!hasMotion) {
        nodePositions.forEach((pos, id) => {
          const lastPos = lastPositionsRef.current.get(id)
          if (!lastPos || Math.abs(pos.x - lastPos.x) > 0.1 || Math.abs(pos.y - lastPos.y) > 0.1) {
            hasMotion = true
            // Node positions changed: mark edges and nodes as dirty
            dirtyLayersRef.current.edges = true
            dirtyLayersRef.current.nodes = true
          }
        })
      }

      // Check if meta-node positions changed
      if (!hasMotion) {
        metaNodePositions.forEach((pos, id) => {
          const lastPos = lastMetaPositionsRef.current.get(id)
          if (!lastPos || Math.abs(pos.x - lastPos.x) > 0.1 || Math.abs(pos.y - lastPos.y) > 0.1) {
            hasMotion = true
            // Meta-node positions changed: mark edges and nodes as dirty
            dirtyLayersRef.current.edges = true
            dirtyLayersRef.current.nodes = true
          }
        })
      }

      // Update last positions for next frame
      lastPositionsRef.current = new Map(
        Array.from(nodePositions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
      )
      lastMetaPositionsRef.current = new Map(
        Array.from(metaNodePositions.entries()).map(([id, pos]) => [id, { x: pos.x, y: pos.y }])
      )

      // Only request next frame if there's motion or we need to render
      if (hasMotion || needsRenderRef.current) {
        needsRenderRef.current = hasMotion // Update flag for next frame
        animationRef.current = requestAnimationFrame(render)
      }
    }

    // Start render loop
    render()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [nodes, edges, nodePositions, selectedNodeId, filteredNodeIds, visibleNodes, swimlanes, metaNodes, visibleMetaNodes, metaNodePositions, viewportState, transformedEdges, targetNodePositions, targetMetaNodePositions, draggedNodeId, manuallyPositionedMetaNodes, highlightedEdgeIds, edgeDistances, edgeFlowDirections, highlightEdgeSettings, animationTime, physicsEnabled, physicsParams])

  return (
    <div className="relative w-full h-full">
      {/* PERFORMANCE: Layered Canvas Architecture */}
      {/* Layer 0: Background - swimlanes, static content (rarely changes) */}
      <canvas
        ref={backgroundCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Layer 1: Edges - connections between nodes (changes when nodes move) */}
      <canvas
        ref={edgeCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Layer 2: Nodes - cards/nodes (changes frequently during physics) */}
      <canvas
        ref={nodeCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Layer 3: Overlay - interaction layer with mouse events */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute top-0 left-0 w-full h-full"
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

      {/* Export menu */}
      {nodes.length > 0 && (
        <div className="absolute top-4 right-4 export-menu-container">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="group px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-cyber-400 transition-all flex items-center gap-2 overflow-hidden hover:px-3"
            title="Export graph"
          >
            <Download className="w-4 h-4 flex-shrink-0" />
            <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Export</span>
          </button>

          {/* Export - direct SVG export (no dropdown needed) */}
          {showExportMenu && (
            <div className="absolute top-12 right-0 bg-dark-secondary border border-dark rounded-lg shadow-lg overflow-hidden z-50 min-w-[180px]">
              <button
                onClick={() => {
                  handleExportSVG()
                  setShowExportMenu(false)
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-dark-tertiary hover:text-cyber-400 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export as SVG
              </button>
            </div>
          )}
        </div>
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
                <div className="flex items-center gap-1.5 pt-1 border-t border-dark">
                  <span className="text-xs text-slate-400">FPS:</span>
                  <span className={`font-medium ${
                    fps >= 50 ? 'text-green-400' :
                    fps >= 30 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {fps}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}


      {/* Hull Outlines Toggle - moved to highlight panel */}
      {nodes.length > 0 && false && (
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

      {/* Physics Settings Button */}
      {nodes.length > 0 && (
        <button
          onClick={() => {
            setShowPhysicsPanel(!showPhysicsPanel)
            setTopModal('physics')
          }}
          className="group absolute top-28 right-4 px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-cyber-400 transition-all flex items-center gap-2 overflow-hidden hover:px-3"
          title="Physics Parameters"
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Physics</span>
          {iterationCount < maxIterations && (
            <span className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full animate-pulse" title={`Calculating physics: ${iterationCount}/${maxIterations}`}></span>
          )}
        </button>
      )}

      {/* Highlight Settings Button */}
      {nodes.length > 0 && (
        <button
          onClick={() => {
            setShowHighlightPanel(!showHighlightPanel)
            setTopModal('highlight')
          }}
          className="group absolute top-40 right-4 px-2 py-2 bg-dark-secondary/90 hover:bg-dark border border-dark rounded-lg text-sm text-slate-300 hover:text-purple-400 transition-all flex items-center gap-2 overflow-hidden hover:px-3"
          title="Highlight & Visual Settings"
        >
          <Shapes className="w-4 h-4 flex-shrink-0" />
          <span className="max-w-0 group-hover:max-w-xs transition-all duration-200 whitespace-nowrap overflow-hidden">Highlight</span>
        </button>
      )}

      {/* Graph Controls */}
      <GraphControls
        zoom={viewportState.zoom}
        rotation={viewportState.rotation}
        isLocked={isLocked}
        onZoomIn={() => {
          if (!viewportRef.current) return;
          viewportRef.current.zoom *= 1.2;
          setViewportState(viewportRef.current.getTransform());
        }}
        onZoomOut={() => {
          if (!viewportRef.current) return;
          viewportRef.current.zoom /= 1.2;
          setViewportState(viewportRef.current.getTransform());
        }}
        onReset={() => {
          if (!viewportRef.current) return;
          viewportRef.current.zoom = 1;
          viewportRef.current.pan = { x: 0, y: 0 };
          viewportRef.current.rotation = 0;
          setViewportState(viewportRef.current.getTransform());
        }}
        onRotateLeft={() => {
          if (!viewportRef.current) return;
          viewportRef.current.rotation -= 15;
          setViewportState(viewportRef.current.getTransform());
        }}
        onRotateRight={() => {
          if (!viewportRef.current) return;
          viewportRef.current.rotation += 15;
          setViewportState(viewportRef.current.getTransform());
        }}
        onToggleLock={() => setIsLocked(!isLocked)}
        showMinimap={showMinimap}
        onToggleMinimap={() => setShowMinimap(!showMinimap)}
        minimapContent={
          canvasRef.current && nodePositions.size > 0 ? (
            <Minimap
              nodePositions={nodePositions}
              metaNodePositions={metaNodePositions}
              panOffset={viewportState.pan}
              zoom={viewportState.zoom}
              canvasWidth={canvasRef.current.offsetWidth}
              canvasHeight={canvasRef.current.offsetHeight}
              onPanChange={(offset) => {
                if (!viewportRef.current) return;
                viewportRef.current.pan = offset;
                setViewportState(viewportRef.current.getTransform());
              }}
            />
          ) : undefined
        }
      />

      {/* Highlight Settings Modal Panel (Right Side) */}
      {showHighlightPanel && (
        <aside className={`fixed right-0 top-0 h-screen w-96 bg-dark-secondary border-l border-dark flex flex-col ${topModal === 'highlight' ? 'z-50' : 'z-40'}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark bg-dark-tertiary flex-shrink-0">
            <div className="flex items-center gap-2">
              <Shapes className="w-5 h-5 text-purple-400" />
              <h2 className="text-lg font-bold text-slate-100">Highlight & Visuals</h2>
            </div>
            <button
              onClick={() => setShowHighlightPanel(false)}
              className="p-1.5 rounded-lg hover:bg-dark-secondary text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="text-sm font-medium text-slate-300 mb-3">Highlight Edge Settings</div>

            {/* Edge Width */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Edge Width: {highlightEdgeSettings.width}px
              </label>
              <input
                type="range"
                min="2"
                max="20"
                step="1"
                value={highlightEdgeSettings.width}
                onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, width: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Thickness of highlighted path edges
              </p>
            </div>

            {/* Edge Color */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Edge Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={highlightEdgeSettings.color}
                  onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, color: e.target.value }))}
                  className="w-12 h-8 bg-dark border border-dark rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={highlightEdgeSettings.color}
                  onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, color: e.target.value }))}
                  className="flex-1 px-2 py-1 bg-dark border border-dark rounded text-xs text-slate-300"
                  placeholder="#22d3ee"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Color of highlighted path edges
              </p>
            </div>

            {/* Color Fade Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-400">Color Fade</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={highlightEdgeSettings.colorFade}
                    onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, colorFade: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-cyber-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-300 rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Fade opacity with distance from selected node
              </p>
            </div>

            {/* Size Fade Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-400">Size Fade</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={highlightEdgeSettings.sizeFade}
                    onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, sizeFade: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-cyber-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-300 rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Taper edge width with distance (thick to thin)
              </p>
            </div>

            {/* Animation Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs text-slate-400">Flow Animation</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={highlightEdgeSettings.animation}
                    onChange={(e) => setHighlightEdgeSettings(prev => ({ ...prev, animation: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-cyber-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-300 rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Animated dashed line showing flow direction
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-dark my-4"></div>

            {/* Hull Outlines Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-300">Show Cluster Hulls</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={showHulls}
                    onChange={(e) => setShowHulls(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-purple-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-300 rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Display convex hulls around parent-leaf node clusters
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Physics Settings Modal Panel (Right Side) */}
      {showPhysicsPanel && (
        <aside className={`fixed right-0 top-0 h-screen w-96 bg-dark-secondary border-l border-dark flex flex-col ${topModal === 'physics' ? 'z-50' : 'z-40'}`}>
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark bg-dark-tertiary flex-shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-cyber-400" />
              <h2 className="text-lg font-bold text-slate-100">Physics Parameters</h2>
            </div>
            <button
              onClick={() => setShowPhysicsPanel(false)}
              className="p-1.5 rounded-lg hover:bg-dark-secondary text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Physics Enabled Toggle */}
            <div className="pb-3 border-b border-dark">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-300">Physics Enabled</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={physicsEnabled}
                    onChange={(e) => setPhysicsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-green-500 transition-colors"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-slate-300 rounded-full peer-checked:translate-x-5 transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Enable/disable physics simulation. When disabled, you can move nodes without physics affecting other nodes.
              </p>
            </div>

            {/* Repulsion Strength */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Repulsion Force: {(physicsParams.repulsionStrength / 1000).toFixed(1)}k
              </label>
              <input
                type="range"
                min="1000"
                max="50000"
                step="500"
                value={physicsParams.repulsionStrength}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, repulsionStrength: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                How strongly nodes push away from each other
              </p>
            </div>

            {/* Attraction Strength */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Spring Strength: {physicsParams.attractionStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.01"
                max="5.0"
                step="0.05"
                value={physicsParams.attractionStrength}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, attractionStrength: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                How tightly edges pull connected nodes together
              </p>
            </div>

            {/* Leaf Spring Strength */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Leaf Tightness: {physicsParams.leafSpringStrength.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.1"
                max="10.0"
                step="0.1"
                value={physicsParams.leafSpringStrength}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, leafSpringStrength: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                How closely leaf nodes orbit their parent nodes
              </p>
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
              <p className="text-xs text-slate-500 mt-1">
                Energy loss per frame - higher values slow movement
              </p>
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
                Center Gravity: {physicsParams.centerGravity.toFixed(4)}
              </label>
              <input
                type="range"
                min="-0.02"
                max="0.02"
                step="0.0001"
                value={physicsParams.centerGravity}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, centerGravity: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Positive pulls toward center, negative pushes away
              </p>
            </div>

            {/* Repulsion Radius */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Repulsion Radius: {physicsParams.repulsionRadius}px
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="100"
                value={physicsParams.repulsionRadius}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, repulsionRadius: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                How far nodes can push each other (500=close, 5000=far islands)
              </p>
            </div>

            {/* Hub Edge Strength */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Hub Edge Strength: {physicsParams.hubEdgeStrength.toFixed(3)}
              </label>
              <input
                type="range"
                min="0"
                max="0.2"
                step="0.001"
                value={physicsParams.hubEdgeStrength}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, hubEdgeStrength: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Hub-to-hub edge pull (0=payout/stretch freely, 0.2=strong pull)
              </p>
            </div>

            {/* Hub Repulsion Boost */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">
                Hub Repulsion Boost: {physicsParams.hubRepulsionBoost.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="2.0"
                step="0.1"
                value={physicsParams.hubRepulsionBoost}
                onChange={(e) => setPhysicsParams(prev => ({ ...prev, hubRepulsionBoost: Number(e.target.value) }))}
                className="w-full h-1 bg-dark rounded-lg appearance-none cursor-pointer accent-cyber-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Extra repulsion for high-degree nodes (0=none, 2=very strong)
              </p>
            </div>

            {/* Enable Final Animation */}
            <div>
              <label className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Final Animation</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={physicsParams.enableFinalAnimation}
                    onChange={(e) => setPhysicsParams(prev => ({ ...prev, enableFinalAnimation: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-dark rounded-full peer peer-checked:bg-cyber-500 transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-slate-400 rounded-full peer-checked:translate-x-5 peer-checked:bg-white transition-transform"></div>
                </div>
              </label>
              <p className="text-xs text-slate-500 mt-1">
                After physics, animate "clicking" each hub to tighten children
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-4 border-t border-dark">
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
        </aside>
      )}

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
