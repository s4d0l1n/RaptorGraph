/**
 * Graph View Component
 * Main Cytoscape.js visualization with interactions
 */

import { useEffect, useRef } from 'react'
import cytoscape, { Core, NodeSingular } from 'cytoscape'
// @ts-ignore - no types available
import coseBilkent from 'cytoscape-cose-bilkent'
// @ts-ignore - no types available
import cola from 'cytoscape-cola'
import { useGraphStore } from '../stores/graphStore'
import { useStyleStore } from '../stores/styleStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useUIStore } from '../stores/uiStore'
import { computeNodeStyle, computeEdgeStyle } from '../utils/styleEvaluator'
import type { NodeData, EdgeData } from '../types'

// Register layout extensions
cytoscape.use(coseBilkent)
cytoscape.use(cola)

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)

  const { nodes, edges } = useGraphStore()
  const { styleRules, getEnabledRules } = useStyleStore()
  const { layoutConfig } = useLayoutStore()
  const uiStore = useUIStore()

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current || cyRef.current) return

    const cy = cytoscape({
      container: containerRef.current,
      style: getCytoscapeStyles() as any,
      layout: { name: 'preset' },
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.2,
    })

    // Node click handler
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      const nodeData = node.data() as NodeData & { id: string }
      const connectedEdges = node.connectedEdges().length

      uiStore.selectNode({
        id: nodeData.id,
        data: nodeData,
        connectedEdges,
      })
    })

    // Double-click to center and highlight
    cy.on('dbltap', 'node', (evt) => {
      const node = evt.target as NodeSingular
      cy.animate({
        center: { eles: node },
        zoom: 2,
        duration: 500,
      })

      // Highlight neighbors
      const neighbors = node.neighborhood()
      cy.elements().removeClass('highlighted')
      node.addClass('highlighted')
      neighbors.addClass('highlighted')

      setTimeout(() => {
        cy.elements().removeClass('highlighted')
      }, 2000)
    })

    // Click on background to deselect
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        uiStore.clearSelection()
        uiStore.closePanel('detailPanel')
      }
    })

    cyRef.current = cy

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  // Update graph data
  useEffect(() => {
    if (!cyRef.current) return

    const cy = cyRef.current

    // Convert nodes and edges to Cytoscape format
    const cyNodes = nodes.map((node) => ({
      data: { ...node, id: node.id },
    }))

    const cyEdges = edges.map((edge) => ({
      data: {
        ...edge,
        id: edge.id || `${edge.source}-${edge.target}`,
      },
    }))

    // Batch update
    cy.startBatch()
    cy.elements().remove()
    cy.add([...cyNodes, ...cyEdges])
    cy.endBatch()

    // Run layout
    runLayout(cy, layoutConfig.type)
  }, [nodes, edges, layoutConfig])

  // Apply style rules
  useEffect(() => {
    if (!cyRef.current) return

    const cy = cyRef.current
    const enabledRules = getEnabledRules()

    // Apply styles to nodes
    cy.nodes().forEach((node) => {
      const nodeData = node.data() as NodeData
      const style = computeNodeStyle(nodeData, enabledRules)

      // Apply computed style
      if (style.backgroundColor) {
        node.style('background-color', style.backgroundColor)
      }
      if (style.borderColor) {
        node.style('border-color', style.borderColor)
      }
      if (style.borderWidth !== undefined) {
        node.style('border-width', style.borderWidth)
      }
      if (style.shape) {
        node.style('shape', style.shape)
      }
      if (style.size) {
        const baseSize = 40
        node.style('width', baseSize * style.size)
        node.style('height', baseSize * style.size)
      }
      if (style.opacity !== undefined) {
        node.style('opacity', style.opacity)
      }
      if (style.lineStyle) {
        node.style('border-style', style.lineStyle)
      }
    })

    // Apply styles to edges
    cy.edges().forEach((edge) => {
      const edgeData = edge.data() as EdgeData
      const style = computeEdgeStyle(edgeData, enabledRules)

      if (style.borderColor) {
        edge.style('line-color', style.borderColor)
        edge.style('target-arrow-color', style.borderColor)
      }
      if (style.borderWidth !== undefined) {
        edge.style('width', style.borderWidth)
      }
      if (style.opacity !== undefined) {
        edge.style('opacity', style.opacity)
      }
      if (style.lineStyle) {
        edge.style('line-style', style.lineStyle)
      }
    })
  }, [styleRules, nodes, edges])

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-gray-50 dark:bg-gray-900"
      style={{ minHeight: '500px' }}
    />
  )
}

// Base Cytoscape styles
function getCytoscapeStyles() {
  return [
    {
      selector: 'node',
      style: {
        'background-color': '#0ea5e9',
        'border-width': 2,
        'border-color': '#0284c7',
        'label': 'data(label)',
        'color': '#1f2937',
        'text-valign': 'center',
        'text-halign': 'center',
        'font-size': '12px',
        'font-weight': 'bold',
        'text-outline-color': '#ffffff',
        'text-outline-width': 2,
        'width': 40,
        'height': 40,
      },
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-width': 4,
        'border-color': '#fbbf24',
      },
    },
    {
      selector: 'node[isStub = true]',
      style: {
        'border-style': 'dashed',
        'opacity': 0.7,
        'background-color': '#9ca3af',
      },
    },
    {
      selector: 'edge',
      style: {
        'width': 2,
        'line-color': '#9ca3af',
        'target-arrow-color': '#9ca3af',
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 1,
      },
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color': '#fbbf24',
        'target-arrow-color': '#fbbf24',
        'width': 3,
      },
    },
    {
      selector: ':selected',
      style: {
        'border-width': 4,
        'border-color': '#ef4444',
      },
    },
  ]
}

// Run layout
function runLayout(cy: Core, layoutType: string) {
  const layouts: Record<string, any> = {
    'cose-bilkent': {
      name: 'cose-bilkent',
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30,
      randomize: false,
      nodeRepulsion: 4500,
      idealEdgeLength: 100,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.25,
      numIter: 2500,
      tile: true,
      tilingPaddingVertical: 10,
      tilingPaddingHorizontal: 10,
    },
    'cola': {
      name: 'cola',
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30,
      nodeSpacing: 50,
      edgeLength: 100,
      convergenceThreshold: 0.01,
    },
    'circle': {
      name: 'circle',
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30,
    },
    'grid': {
      name: 'grid',
      animate: true,
      animationDuration: 1000,
      fit: true,
      padding: 30,
      rows: undefined,
      cols: undefined,
    },
  }

  const config = layouts[layoutType] || layouts['cose-bilkent']
  cy.layout(config).run()
}

/**
 * Graph Controls Component
 */
export function GraphControls() {
  const { layoutConfig, setLayoutType } = useLayoutStore()

  const handleLayout = (type: string) => {
    setLayoutType(type as any)
  }

  const handleFit = () => {
    // This will be handled by a ref to the cy instance
    // For now, we'll trigger a re-render
    window.dispatchEvent(new CustomEvent('cytoscape-fit'))
  }

  const handleExportPNG = () => {
    window.dispatchEvent(new CustomEvent('cytoscape-export-png'))
  }

  return (
    <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 space-y-2 border border-gray-200 dark:border-gray-700">
      <div>
        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Layout
        </label>
        <select
          value={layoutConfig.type}
          onChange={(e) => handleLayout(e.target.value)}
          className="w-full p-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-cyber-500"
        >
          <option value="cose-bilkent">Force-Directed (cose-bilkent)</option>
          <option value="cola">Constraint-Based (cola)</option>
          <option value="circle">Circle</option>
          <option value="grid">Grid</option>
        </select>
      </div>

      <button
        onClick={handleFit}
        className="w-full px-3 py-2 text-sm bg-cyber-600 hover:bg-cyber-700 text-white rounded transition-colors"
      >
        Fit to Screen
      </button>

      <button
        onClick={handleExportPNG}
        className="w-full px-3 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
      >
        Export PNG
      </button>
    </div>
  )
}
