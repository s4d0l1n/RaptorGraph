/**
 * G6 Graph View Component
 * Main G6 (AntV) v5 visualization with custom node/edge rendering
 */

import { useEffect, useRef } from 'react'
import {
  Graph,
  GraphData,
  NodeData as G6NodeData,
  EdgeData as G6EdgeData,
} from '@antv/g6'
import { useGraphStore } from '../stores/graphStore'
import { useStyleStore } from '../stores/styleStore'
import { useCardTemplateStore } from '../stores/cardTemplateStore'
import { useAttributeTemplateStore } from '../stores/attributeTemplateStore'
import { useEdgeTemplateStore } from '../stores/edgeTemplateStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useUIStore } from '../stores/uiStore'
import { computeNodeStyle, computeEdgeStyle } from '../utils/styleEvaluator'
import type { NodeData, EdgeData, CardTemplate, AttributeDisplay, AttributeTemplate } from '../types'
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  RotateCcw
} from 'lucide-react'

/**
 * Resolve AttributeDisplay properties by merging attribute template
 */
function resolveAttributeDisplay(
  display: AttributeDisplay,
  attributeTemplateGetter: (id: string) => AttributeTemplate | undefined,
  defaultTemplate: AttributeTemplate | undefined
): any {
  let resolvedStyle: any = {}

  if (defaultTemplate) {
    resolvedStyle = { ...defaultTemplate }
  }

  if (display.attributeTemplateId) {
    const template = attributeTemplateGetter(display.attributeTemplateId)
    if (template) {
      resolvedStyle = { ...resolvedStyle, ...template }
    }
  }

  if (display.overrides) {
    resolvedStyle = { ...resolvedStyle, ...display.overrides }
  }

  return resolvedStyle
}

/**
 * Compute node label from card template
 */
function computeNodeLabel(
  node: NodeData,
  template: CardTemplate | undefined,
  attributeTemplateGetter: (id: string) => AttributeTemplate | undefined,
  defaultAttributeTemplate: AttributeTemplate | undefined
): string {
  if (!template || !template.attributeDisplays) {
    return node.label || node.id
  }

  const visibleDisplays = template.attributeDisplays
    .filter((d) => d.visible)
    .sort((a, b) => a.order - b.order)

  const lines: string[] = []

  for (const display of visibleDisplays) {
    let value: any

    if (display.attribute === '__id__') {
      value = node.id
    } else {
      value = node.attributes[display.attribute]
    }

    if (value === undefined || value === null) continue

    const resolvedStyle = resolveAttributeDisplay(
      display,
      attributeTemplateGetter,
      defaultAttributeTemplate
    )

    let displayValue = Array.isArray(value) ? value.join(', ') : String(value)

    if (resolvedStyle.labelPrefix) {
      displayValue = resolvedStyle.labelPrefix + displayValue
    }
    if (resolvedStyle.labelSuffix) {
      displayValue = displayValue + resolvedStyle.labelSuffix
    }

    const label = display.displayLabel || display.attribute
    const line = template.layout.showLabels
      ? `${label}: ${displayValue}`
      : displayValue

    lines.push(line)
  }

  return lines.join('\n') || node.id
}

/**
 * Convert NodeData to G6 v5 node configuration
 */
function convertNodeToG6(
  node: NodeData,
  styleRules: any[],
  cardTemplateGetter: (id: string) => CardTemplate | undefined,
  attributeTemplateGetter: (id: string) => AttributeTemplate | undefined,
  defaultCardTemplate: CardTemplate | undefined,
  defaultAttributeTemplate: AttributeTemplate | undefined
): G6NodeData {
  // Compute style from rules
  const computedStyle = computeNodeStyle(node, styleRules)

  // Get card template
  const templateId = computedStyle.cardTemplateId
  const template = templateId ? cardTemplateGetter(templateId) : defaultCardTemplate

  // Compute label
  const label = computeNodeLabel(
    node,
    template,
    attributeTemplateGetter,
    defaultAttributeTemplate
  )

  // Node visual style from template
  const nodeStyle = template?.nodeStyle || {}

  // Determine node type
  let nodeType = 'circle'
  if (nodeStyle.imageUrl || nodeStyle.icon) {
    nodeType = 'image'
  } else if (nodeStyle.shape) {
    const shapeMap: Record<string, string> = {
      'ellipse': 'circle',
      'circle': 'circle',
      'rectangle': 'rect',
      'roundrectangle': 'rect',
      'diamond': 'diamond',
      'triangle': 'triangle',
      'hexagon': 'hexagon',
      'star': 'star'
    }
    nodeType = shapeMap[nodeStyle.shape] || 'circle'
  }

  const size = (nodeStyle.size || 1) * 60

  const g6Node: G6NodeData = {
    id: node.id,
    data: {
      label,
      type: nodeType,
      fill: nodeStyle.backgroundColor || '#5B8FF9',
      stroke: nodeStyle.borderColor || '#2f54eb',
      lineWidth: nodeStyle.borderWidth || 2,
      opacity: nodeStyle.opacity !== undefined ? nodeStyle.opacity : 1,
      size,
      labelText: label,
      labelFill: template?.textStyle?.color || '#000000',
      labelFontSize: template?.textStyle?.fontSize || 12,
      labelFontFamily: template?.textStyle?.fontFamily || 'Arial',
    },
  }

  // Handle images/icons
  if (nodeStyle.imageUrl) {
    g6Node.data!.src = nodeStyle.imageUrl
    g6Node.data!.size = [(nodeStyle.size || 1) * 80, (nodeStyle.size || 1) * 80]
  } else if (nodeStyle.icon?.startsWith('/icons/')) {
    g6Node.data!.src = nodeStyle.icon
    g6Node.data!.size = [(nodeStyle.size || 2.5) * 50, (nodeStyle.size || 2.5) * 50]
  }

  return g6Node
}

/**
 * Convert EdgeData to G6 v5 edge configuration
 */
function convertEdgeToG6(
  edge: EdgeData,
  styleRules: any[],
  edgeTemplateGetter: (id: string) => any,
  defaultEdgeTemplate: any
): G6EdgeData {
  const computedStyle = computeEdgeStyle(edge, styleRules)

  const templateId = computedStyle.edgeTemplateId
  const template = templateId ? edgeTemplateGetter(templateId) : defaultEdgeTemplate

  const g6Edge: G6EdgeData = {
    id: edge.id || `${edge.source}-${edge.target}-${Math.random()}`,
    source: edge.source,
    target: edge.target,
    data: {
      type: 'line',
      label: edge.label || template?.label || '',
      stroke: template?.lineColor || '#b1b1b1',
      lineWidth: template?.lineWidth || 1,
      opacity: template?.opacity !== undefined ? template?.opacity : 1,
      lineDash: template?.lineStyle === 'dashed' ? [5, 5] :
               template?.lineStyle === 'dotted' ? [2, 2] : undefined,
      endArrow: template?.arrowShape !== 'none',
      labelFill: template?.labelColor || '#666',
      labelFontSize: template?.labelFontSize || 12,
      labelBackground: template?.labelBackgroundColor || '#ffffff',
    },
  }

  return g6Edge
}

export function G6GraphView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<Graph | null>(null)

  const { nodes, edges } = useGraphStore()
  const { styleRules } = useStyleStore()
  const { layoutConfig } = useLayoutStore()
  const { openPanel } = useUIStore()

  const { cardTemplates, getCardTemplate, getDefaultTemplate: getDefaultCardTemplate } = useCardTemplateStore()
  const { attributeTemplates, getAttributeTemplate, getDefaultTemplate: getDefaultAttributeTemplate } = useAttributeTemplateStore()
  const { edgeTemplates, getEdgeTemplate, getDefaultTemplate: getDefaultEdgeTemplate } = useEdgeTemplateStore()

  // Initialize G6 graph
  useEffect(() => {
    if (!containerRef.current || graphRef.current) return

    const container = containerRef.current
    const width = container.offsetWidth
    const height = container.offsetHeight

    const graph = new Graph({
      container: container,
      width,
      height,
      autoFit: 'view',
      data: { nodes: [], edges: [] },
      layout: {
        type: 'd3-force',
        preventOverlap: true,
        nodeSize: 40,
      },
      behaviors: ['drag-canvas', 'zoom-canvas', 'drag-element'],
    })

    // Event listeners
    graph.on('node:click', (event: any) => {
      const nodeId = event.target.id
      const nodeData = nodes.find(n => n.id === nodeId)
      if (nodeData) {
        openPanel('detailPanel')
        localStorage.setItem('selectedNodeId', nodeId)
      }
    })

    graphRef.current = graph

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (graphRef.current && containerRef.current) {
        graphRef.current.setSize(
          containerRef.current.offsetWidth,
          containerRef.current.offsetHeight
        )
      }
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (graphRef.current) {
        graphRef.current.destroy()
        graphRef.current = null
      }
    }
  }, [nodes, openPanel])

  // Update graph data
  useEffect(() => {
    if (!graphRef.current || nodes.length === 0) return

    const defaultCardTemplate = getDefaultCardTemplate()
    const defaultAttributeTemplate = getDefaultAttributeTemplate()
    const defaultEdgeTemplate = getDefaultEdgeTemplate()

    // Convert data to G6 format
    const g6Nodes = nodes.map(node =>
      convertNodeToG6(
        node,
        styleRules,
        getCardTemplate,
        getAttributeTemplate,
        defaultCardTemplate,
        defaultAttributeTemplate
      )
    )

    const g6Edges = edges.map(edge =>
      convertEdgeToG6(
        edge,
        styleRules,
        getEdgeTemplate,
        defaultEdgeTemplate
      )
    )

    const graphData: GraphData = {
      nodes: g6Nodes,
      edges: g6Edges,
    }

    graphRef.current.setData(graphData)
    graphRef.current.render()

    // Apply layout
    const layoutType = layoutConfig.type || 'force'
    runLayout(graphRef.current, layoutType, layoutConfig)

  }, [nodes, edges, styleRules, cardTemplates, attributeTemplates, edgeTemplates, layoutConfig, getCardTemplate, getAttributeTemplate, getDefaultCardTemplate, getDefaultAttributeTemplate, getEdgeTemplate, getDefaultEdgeTemplate])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <GraphControls graph={graphRef.current} />
    </div>
  )
}

/**
 * Run layout algorithm on graph
 */
function runLayout(graph: Graph, layoutType: string, layoutConfig?: any) {
  const layoutConfigs: Record<string, any> = {
    'force': {
      type: 'd3-force',
      preventOverlap: true,
      nodeSize: 40,
      linkDistance: 150,
    },
    'fcose': {
      type: 'd3-force',
      preventOverlap: true,
      nodeSize: 40,
      linkDistance: 150,
    },
    'cose-bilkent': {
      type: 'd3-force',
      preventOverlap: true,
      nodeSize: 40,
      linkDistance: 180,
    },
    'cola': {
      type: 'd3-force',
      preventOverlap: true,
      nodeSize: 40,
    },
    'dagre': {
      type: 'dagre',
      rankdir: layoutConfig?.options?.rankDir || 'TB',
      nodesep: 50,
      ranksep: 80,
    },
    'breadthfirst': {
      type: 'dagre',
      rankdir: 'TB',
      nodesep: 50,
    },
    'circular': {
      type: 'circular',
      radius: 300,
      divisions: 5,
    },
    'grid': {
      type: 'grid',
      preventOverlap: true,
      nodeSize: 60,
    },
    'concentric': {
      type: 'concentric',
      preventOverlap: true,
      nodeSize: 60,
      minNodeSpacing: 50,
    },
    'radial': {
      type: 'radial',
      preventOverlap: true,
      nodeSize: 60,
      nodeSpacing: 100,
    },
    'preset': {
      type: 'grid',
    },
  }

  const config = layoutConfigs[layoutType] || layoutConfigs['force']
  graph.layout(config)
}

/**
 * Graph control buttons component
 */
function GraphControls({ graph }: { graph: Graph | null }) {
  const handleZoomIn = () => {
    if (graph) {
      const zoom = graph.getZoom()
      graph.zoomTo(zoom * 1.2, true)
    }
  }

  const handleZoomOut = () => {
    if (graph) {
      const zoom = graph.getZoom()
      graph.zoomTo(zoom * 0.8, true)
    }
  }

  const handleFitView = () => {
    if (graph) {
      graph.fitView()
    }
  }

  const handleReset = () => {
    if (graph) {
      graph.fitView()
      graph.zoomTo(1, true)
    }
  }

  const handleExportPNG = () => {
    if (graph) {
      graph.toDataURL().then((dataURL: string) => {
        const link = document.createElement('a')
        link.download = `protoceratop-graph-${Date.now()}.png`
        link.href = dataURL
        link.click()
      })
    }
  }

  return (
    <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2">
      <button
        onClick={handleZoomIn}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button
        onClick={handleZoomOut}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <button
        onClick={handleFitView}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Fit View"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
      <button
        onClick={handleReset}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Reset View"
      >
        <RotateCcw className="w-5 h-5" />
      </button>
      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
      <button
        onClick={handleExportPNG}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        title="Export PNG"
      >
        <Download className="w-5 h-5" />
      </button>
    </div>
  )
}
