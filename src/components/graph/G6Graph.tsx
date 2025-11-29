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
import { calculateForceLayout } from '@/lib/layouts/forceLayout'
import { calculateRadialLayout } from '@/lib/layouts/radialLayout'
import { calculateHierarchicalLayout } from '@/lib/layouts/hierarchicalLayout'
import { calculateFruchtermanLayout } from '@/lib/layouts/fruchtermanLayout'
import { calculateKamadaKawaiLayout } from '@/lib/layouts/kamadaKawaiLayout'
import { calculateSpectralLayout } from '@/lib/layouts/spectralLayout'
import { calculateSugiyamaLayout } from '@/lib/layouts/sugiyamaLayout'
import { getVisibleNodesWithGrouping, calculateMetaNodePosition, transformEdgesForGrouping } from '@/lib/grouping'
import { evaluateNodeRules, evaluateEdgeRules } from '@/lib/styleEvaluator'
import { useRulesStore } from '@/stores/rulesStore'

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
  const { exportAsPNG } = useGraphExport()
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

  // Memoize export handler
  const handleExport = useCallback(() => {
    exportAsPNG(canvasRef.current, 'raptorgraph-export', 2)
  }, [exportAsPNG])

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

    // Check if mouse is over a meta-node first (they're larger)
    for (const [metaNodeId, pos] of metaNodePositions.entries()) {
      const metaNode = visibleMetaNodes.find((mn) => mn.id === metaNodeId)
      if (!metaNode) continue

      if (metaNode.collapsed) {
        // Collapsed meta-node - check full bounding box
        const nodeCount = metaNode.childNodeIds.length
        const cols = Math.min(4, Math.ceil(Math.sqrt(nodeCount)))
        const rows = Math.ceil(nodeCount / cols)
        const cardWidth = 120
        const cardHeight = 60
        const spacing = 15
        const padding = 25
        const headerHeight = 35
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
  }, [nodePositions, metaNodePositions, panOffset, zoom])

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

        setNodePositions((prev) => {
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
        setTargetNodePositions((prev) => {
          const newTargets = new Map(prev)
          newTargets.set(draggedNodeId, { x: newX, y: newY })
          return newTargets
        })
      }

      // Request animation frame for smooth rendering during drag
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draggedNodeId, dragOffset, isPanning, panStart, panOffset, zoom, metaNodePositions])

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

  // Handle mouse wheel for zooming
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const delta = -e.deltaY / 1000
    setZoom((prev) => Math.max(0.1, Math.min(5, prev + delta)))
  }, [])

  // Initialize node positions with memoized layout calculation
  useEffect(() => {
    if (nodes.length === 0) return

    const canvas = canvasRef.current
    if (!canvas) return

    const width = canvas.offsetWidth
    const height = canvas.offsetHeight

    // NO LAYOUT ALGORITHMS - just initialize random positions
    // Physics will handle everything in the render loop

    setNodePositions((prev) => {
      const newPositions = new Map<string, NodePosition>()
      nodes.forEach((node) => {
        const existing = prev.get(node.id)
        if (existing) {
          // Keep existing position
          newPositions.set(node.id, existing)
        } else {
          // New node - random initial position
          newPositions.set(node.id, {
            x: width / 2 + (Math.random() - 0.5) * 400,
            y: height / 2 + (Math.random() - 0.5) * 400,
            vx: 0,
            vy: 0,
          })
        }
      })
      return newPositions
    })

    setSwimlanes(new Map())
  }, [nodes, edges, layoutConfig])

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

  // Track simulation state
  const [iterationCount, setIterationCount] = useState(0)
  const maxIterations = 500

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

        // Stop simulation after convergence
        if (iterationCount >= maxIterations) {
          // If user is dragging, apply spring physics to connected nodes
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

              // OVERLAP PREVENTION during drag
              const maxPasses = 3
              for (let pass = 0; pass < maxPasses; pass++) {
                // Check connected nodes against all other nodes
                connectedNodes.forEach(nodeId1 => {
                  const pos1 = updated.get(nodeId1)
                  if (!pos1) return

                  updated.forEach((pos2, nodeId2) => {
                    // Skip self and dragged node
                    if (nodeId1 === nodeId2 || nodeId2 === draggedNodeId) return

                    const dx = pos2.x - pos1.x
                    const dy = pos2.y - pos1.y
                    const dist = Math.sqrt(dx * dx + dy * dy)

                    if (dist < minDistance && dist > 0) {
                      const overlap = minDistance - dist
                      const pushDist = overlap / 2
                      const nx = dx / dist
                      const ny = dy / dist

                      // Push apart
                      pos1.x -= nx * pushDist
                      pos1.y -= ny * pushDist

                      // Also push the other node if it's connected
                      if (connectedNodes.has(nodeId2)) {
                        pos2.x += nx * pushDist
                        pos2.y += ny * pushDist
                      }
                    }
                  })
                })
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

            return prev
          }
          return prev
        }

        // nodeRadius and minDistance already declared above (used by drag physics)
        const area = canvas.width * canvas.height
        const nodeCount = nodes.length

        // Optimal edge length (k in F-R algorithm)
        const k = Math.sqrt(area / nodeCount)

        // Temperature for simulated annealing - exponential decay
        // Start with 2x higher temperature to help escape local minima
        const temperature = k * 2 * Math.pow(1 - iterationCount / maxIterations, 2)

        // nodeRadius and minDistance already declared above for overlap check

        // Stub orbit radius (how far nodes orbit around their stub)
        const stubOrbitRadius = 150

        // Minimum distance between different families = 2 * orbit radius
        const familySeparation = stubOrbitRadius * 2

        // Map each node to its stub family (adjacency and nodeMap already built above)
        const nodeToFamily = new Map<string, string>()
        nodes.forEach(node => {
          const neighbors = adjacency.get(node.id) || new Set()
          // Find connected stubs
          for (const neighborId of neighbors) {
            const neighbor = nodeMap.get(neighborId)
            if (neighbor?.isStub) {
              nodeToFamily.set(node.id, neighborId)
              break
            }
          }
          // Stubs are their own family
          if (node.isStub) {
            nodeToFamily.set(node.id, node.id)
          }
        })

        // Calculate family sizes for force normalization
        const familySizes = new Map<string, number>()
        nodeToFamily.forEach((family) => {
          familySizes.set(family, (familySizes.get(family) || 0) + 1)
        })

        // Separate stub nodes from child nodes
        const stubNodes = nodes.filter(n => n.isStub)
        const childNodes = nodes.filter(n => !n.isStub)

        // PHASE 1: Calculate forces ONLY for stub nodes (stub-to-stub repulsion)
        const stubDisplacements = new Map<string, { x: number; y: number }>()

        stubNodes.forEach(stubNode => {
          const pos = prev.get(stubNode.id)
          if (!pos) return

          let dx = 0
          let dy = 0

          // STUB-TO-STUB REPULSION ONLY
          stubNodes.forEach(otherStub => {
            if (otherStub.id === stubNode.id) return

            const otherPos = prev.get(otherStub.id)
            if (!otherPos) return

            const deltaX = pos.x - otherPos.x
            const deltaY = pos.y - otherPos.y
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

            if (distance > 0) {
              // Scale by PRODUCT of their family sizes
              const myFamily = nodeToFamily.get(stubNode.id)
              const otherFamily = nodeToFamily.get(otherStub.id)
              const myFamilySize = myFamily ? (familySizes.get(myFamily) || 1) : 1
              const otherFamilySize = otherFamily ? (familySizes.get(otherFamily) || 1) : 1

              // Larger stubs push each other harder to make room for their children
              const force = (k * k * 10 * myFamilySize * otherFamilySize) / distance

              dx += (deltaX / distance) * force
              dy += (deltaY / distance) * force
            }
          })

          // Weak center gravity to prevent explosion
          const centerX = canvas.width / 2
          const centerY = canvas.height / 2
          const gravityStrength = 0.01
          dx += (centerX - pos.x) * gravityStrength
          dy += (centerY - pos.y) * gravityStrength

          stubDisplacements.set(stubNode.id, { x: dx, y: dy })
        })

        // Apply stub displacements with temperature limiting
        stubDisplacements.forEach((disp, stubId) => {
          const pos = prev.get(stubId)
          if (!pos) return

          // If this is the dragged node, keep it at its current position
          if (draggedNodeId === stubId) {
            updated.set(stubId, { ...pos, vx: 0, vy: 0 })
            return
          }

          const dispLength = Math.sqrt(disp.x * disp.x + disp.y * disp.y)

          if (dispLength > 0) {
            const progress = iterationCount / maxIterations
            let damping = 0.3 + (0.4 * progress) // Starts slippery, ends gentle

            // SIZE-BASED VELOCITY: Bigger stubs move faster
            const family = nodeToFamily.get(stubId)
            if (family) {
              const familySize = familySizes.get(family) || 1
              const speedBoost = Math.max(0.5, 1 - (familySize * 0.025))
              damping *= speedBoost
            }

            // Random perturbation to escape local minima
            const perturbStrength = temperature * 0.15 * (1 - progress)
            const perturbX = (Math.random() - 0.5) * perturbStrength
            const perturbY = (Math.random() - 0.5) * perturbStrength

            // Limit by temperature
            const limitedLength = Math.min(dispLength, temperature)
            const vx = ((disp.x / dispLength) * limitedLength + perturbX) * damping
            const vy = ((disp.y / dispLength) * limitedLength + perturbY) * damping

            const newX = pos.x + vx
            const newY = pos.y + vy

            // Stop if movement is tiny AND we're in late stages
            if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01 && progress > 0.8) {
              updated.set(stubId, { ...pos, vx: 0, vy: 0 })
            } else {
              updated.set(stubId, { x: newX, y: newY, vx, vy })
            }
          } else {
            updated.set(stubId, pos)
          }
        })

        // PHASE 2: Child nodes follow their parent stubs via spring forces
        childNodes.forEach(childNode => {
          const pos = prev.get(childNode.id)
          if (!pos) return

          // If this is the dragged node, keep it at its current position
          if (draggedNodeId === childNode.id) {
            updated.set(childNode.id, { ...pos, vx: 0, vy: 0 })
            return
          }

          let dx = 0
          let dy = 0

          const neighbors = adjacency.get(childNode.id) || new Set()

          // 1. SPRING FORCE: Pull toward parent stub
          const parentStubId = nodeToFamily.get(childNode.id)
          if (parentStubId) {
            const stubPos = updated.get(parentStubId) // Use updated stub position
            if (stubPos) {
              const deltaX = stubPos.x - pos.x
              const deltaY = stubPos.y - pos.y
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

              if (distance > 0) {
                // Strong spring force to keep child near stub (Hooke's law: F = k * x)
                const idealDistance = stubOrbitRadius
                const stretch = distance - idealDistance
                const springForce = stretch * 0.15 // Spring constant

                dx += (deltaX / distance) * springForce
                dy += (deltaY / distance) * springForce
              }
            }
          }

          // 2. REPULSION: Push away from sibling nodes in same family (prevent overlap)
          childNodes.forEach(otherChild => {
            if (otherChild.id === childNode.id) return

            const otherFamily = nodeToFamily.get(otherChild.id)
            const myFamily = nodeToFamily.get(childNode.id)

            // Only repel within same family
            if (myFamily && otherFamily && myFamily === otherFamily) {
              const otherPos = updated.get(otherChild.id) || prev.get(otherChild.id)
              if (!otherPos) return

              const deltaX = pos.x - otherPos.x
              const deltaY = pos.y - otherPos.y
              const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

              if (distance > 0 && distance < minDistance * 1.5) {
                // Gentle repulsion between siblings
                const force = (k * k * 2) / distance
                dx += (deltaX / distance) * force
                dy += (deltaY / distance) * force
              }
            }
          })

          // 3. NODE-TO-NODE CONNECTIONS: Pull toward connected non-stub nodes
          neighbors.forEach(neighborId => {
            const neighbor = nodeMap.get(neighborId)
            if (neighbor?.isStub) return // Skip stub connections (already handled above)

            const neighborPos = updated.get(neighborId) || prev.get(neighborId)
            if (!neighborPos) return

            const deltaX = neighborPos.x - pos.x
            const deltaY = neighborPos.y - pos.y
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

            if (distance > 0) {
              // Moderate spring force for node-to-node connections
              const force = (distance * distance) / k * 0.8
              dx += (deltaX / distance) * force
              dy += (deltaY / distance) * force
            }
          })

          // Apply child node displacement with damping
          const dispLength = Math.sqrt(dx * dx + dy * dy)

          if (dispLength > 0) {
            const progress = iterationCount / maxIterations
            const damping = 0.5 + (0.3 * progress) // Smoother damping for children (0.5 -> 0.8)

            // Children move more freely, less temperature constraint
            const limitedLength = Math.min(dispLength, temperature * 1.5)
            const vx = ((dx / dispLength) * limitedLength) * damping
            const vy = ((dy / dispLength) * limitedLength) * damping

            const newX = pos.x + vx
            const newY = pos.y + vy

            // Stop if movement is tiny AND we're in late stages
            if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01 && progress > 0.8) {
              updated.set(childNode.id, { ...pos, vx: 0, vy: 0 })
            } else {
              updated.set(childNode.id, { x: newX, y: newY, vx, vy })
            }
          } else {
            updated.set(childNode.id, pos)
          }
        })

        // PROGRESSIVE OVERLAP ENFORCEMENT
        // Early: nodes can pass through (helps untangle)
        // Late: strict enforcement (prevents final overlaps)
        const progress = iterationCount / maxIterations
        const enforceOverlaps = progress > 0.3 // Start enforcing after 30% progress

        if (enforceOverlaps) {
          const overlapNodeIds = Array.from(updated.keys())
          const overlapStrength = Math.min(1, (progress - 0.3) / 0.7) // Gradually increase from 30% to 100%

          for (let i = 0; i < overlapNodeIds.length; i++) {
            const id1 = overlapNodeIds[i]
            const pos1 = updated.get(id1)!

            for (let j = i + 1; j < overlapNodeIds.length; j++) {
              const id2 = overlapNodeIds[j]
              const pos2 = updated.get(id2)!

              const dx = pos2.x - pos1.x
              const dy = pos2.y - pos1.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              // Overlap prevention with progressive strength
              if (distance < minDistance && distance > 0) {
                const overlap = minDistance - distance
                const pushDistance = (overlap / 2) * overlapStrength

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
        }

        // CLUSTER STABILIZATION - stop clusters that have enough space
        if (progress > 0.5) {
          // Calculate cluster velocities and nearby cluster distances
          const clusterData = new Map<string, {
            nodeIds: Set<string>,
            centerX: number,
            centerY: number,
            avgVelocity: number,
            nearestClusterDist: number
          }>()

          // Group nodes by family and calculate cluster centers
          nodeToFamily.forEach((family, nodeId) => {
            if (!clusterData.has(family)) {
              clusterData.set(family, {
                nodeIds: new Set(),
                centerX: 0,
                centerY: 0,
                avgVelocity: 0,
                nearestClusterDist: Infinity
              })
            }
            clusterData.get(family)!.nodeIds.add(nodeId)
          })

          // Calculate centers and velocities
          clusterData.forEach((data, family) => {
            let totalX = 0, totalY = 0, totalVel = 0
            data.nodeIds.forEach(nodeId => {
              const pos = updated.get(nodeId)
              if (pos) {
                totalX += pos.x
                totalY += pos.y
                totalVel += Math.sqrt(pos.vx * pos.vx + pos.vy * pos.vy)
              }
            })
            const count = data.nodeIds.size
            data.centerX = totalX / count
            data.centerY = totalY / count
            data.avgVelocity = totalVel / count
          })

          // Find nearest cluster distance for each cluster
          clusterData.forEach((data1, family1) => {
            clusterData.forEach((data2, family2) => {
              if (family1 === family2) return

              const dx = data2.centerX - data1.centerX
              const dy = data2.centerY - data1.centerY
              const dist = Math.sqrt(dx * dx + dy * dy)

              if (dist < data1.nearestClusterDist) {
                data1.nearestClusterDist = dist
              }
            })
          })

          // Stop clusters that have enough space
          const minClusterSeparation = 400 // Minimum space between cluster centers
          clusterData.forEach((data, family) => {
            // If cluster has enough space and is moving slowly, stop it
            if (data.nearestClusterDist > minClusterSeparation && data.avgVelocity < 2) {
              data.nodeIds.forEach(nodeId => {
                const pos = updated.get(nodeId)
                if (pos) {
                  pos.vx = 0
                  pos.vy = 0
                }
              })
            }
          })
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

      // Save context and apply pan/zoom transformations
      ctx.save()
      ctx.translate(panOffset.x, panOffset.y)
      ctx.scale(zoom, zoom)

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
          // Draw expanded meta-node as a small clickable badge
          const badgeWidth = 140
          const badgeHeight = 30
          const badgeX = pos.x - badgeWidth / 2
          const badgeY = pos.y - badgeHeight / 2
          const badgeRadius = 6

          // Draw badge background
          ctx.fillStyle = '#1e40af'
          ctx.strokeStyle = '#3b82f6'
          ctx.lineWidth = 2

          ctx.beginPath()
          ctx.moveTo(badgeX + badgeRadius, badgeY)
          ctx.lineTo(badgeX + badgeWidth - badgeRadius, badgeY)
          ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius)
          ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - badgeRadius)
          ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - badgeRadius, badgeY + badgeHeight)
          ctx.lineTo(badgeX + badgeRadius, badgeY + badgeHeight)
          ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius)
          ctx.lineTo(badgeX, badgeY + badgeRadius)
          ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY)
          ctx.closePath()
          ctx.fill()
          ctx.stroke()

          // Draw badge text
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 11px sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(
            `${metaNode.groupValue} (${metaNode.childNodeIds.length})`,
            pos.x,
            pos.y
          )

          return // Skip collapsed rendering
        }

        // Draw collapsed meta-node - showing contained nodes with full styling

        // Get contained nodes (use ALL nodes, not just visibleNodes, to show all nodes in the collapsed group)
        const containedNodes = nodes.filter((n) => metaNode.childNodeIds.includes(n.id))

        // Calculate layout for contained nodes (grid layout)
        const nodeCount = containedNodes.length
        const cols = Math.min(4, Math.ceil(Math.sqrt(nodeCount))) // Max 4 columns
        const rows = Math.ceil(nodeCount / cols)

        // Use base card dimensions (will be adjusted per node based on their templates)
        const baseCardWidth = 120
        const baseCardHeight = 60
        const spacing = 15
        const padding = 25
        const headerHeight = 35

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

        // Draw header
        ctx.fillStyle = '#1e40af'
        ctx.fillRect(containerX + 4, containerY + 4, containerWidth - 8, headerHeight - 4)

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 13px sans-serif'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(metaNode.groupValue, containerX + padding, containerY + headerHeight / 2)

        ctx.font = '11px sans-serif'
        ctx.fillStyle = '#93c5fd'
        ctx.textAlign = 'right'
        ctx.fillText(`${nodeCount} node${nodeCount !== 1 ? 's' : ''}`, containerX + containerWidth - padding, containerY + headerHeight / 2)

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
          const label = node.label.length > 14 ? node.label.substring(0, 14) + '...' : node.label
          ctx.fillText(label, nodeX, y + nodeCardHeight - 15)
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
        const label = node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label
        ctx.fillText(label, pos.x, pos.y + 8)

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
  }, [nodes, edges, nodePositions, selectedNodeId, filteredNodeIds, visibleNodes, swimlanes, metaNodes, visibleMetaNodes, metaNodePositions, panOffset, zoom, transformedEdges, targetNodePositions, targetMetaNodePositions, draggedNodeId, manuallyPositionedMetaNodes])

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
        onWheel={handleWheel}
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
      <GraphControls
        zoom={zoom}
        onZoomIn={() => setZoom((prev) => Math.min(5, prev + 0.2))}
        onZoomOut={() => setZoom((prev) => Math.max(0.1, prev - 0.2))}
        onReset={() => {
          setZoom(1)
          setPanOffset({ x: 0, y: 0 })
        }}
      />

      {/* Zoom indicator */}
      {nodes.length > 0 && (
        <div className="absolute bottom-6 left-6 px-3 py-2 bg-dark-secondary/90 border border-dark rounded-lg text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Zoom:</span>
            <span className="font-medium">{(zoom * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Graph control buttons
 */
interface GraphControlsProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
}

function GraphControls({ zoom, onZoomIn, onZoomOut, onReset }: GraphControlsProps) {
  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2">
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
        title="Reset view (zoom 100%, center)"
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
