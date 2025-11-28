import { X, ExternalLink, Tag, Database, Clock, FileText, Layers2, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useGraphStore } from '@/stores/graphStore'
import { useRulesStore } from '@/stores/rulesStore'
import { useTemplateStore } from '@/stores/templateStore'
import { evaluateNodeRules, type FontTemplateApplication } from '@/lib/styleEvaluator'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import type { FontTemplate } from '@/types'

/**
 * Convert a FontTemplate to CSS style object
 * Only applies properties that differ from defaults to allow partial styling
 */
function fontTemplateToStyle(template: FontTemplate | undefined): React.CSSProperties {
  if (!template) return {}

  const style: React.CSSProperties = {}

  // Only apply properties that are explicitly set (not default values)
  if (template.fontFamily && template.fontFamily !== 'Inter') {
    style.fontFamily = template.fontFamily
  }
  if (template.fontSize && template.fontSize !== 1) {
    style.fontSize = `${template.fontSize}rem`
  }
  if (template.fontWeight && template.fontWeight !== 'normal') {
    style.fontWeight = template.fontWeight
  }
  if (template.fontStyle && template.fontStyle !== 'normal') {
    style.fontStyle = template.fontStyle
  }
  if (template.color) {
    style.color = template.color
  }
  if (template.backgroundColor) {
    style.backgroundColor = template.backgroundColor
    style.padding = '0.25rem 0.5rem'
    style.borderRadius = '0.25rem'
  }
  if (template.textDecoration && template.textDecoration !== 'none') {
    style.textDecoration = template.textDecoration
  }
  if (template.textTransform && template.textTransform !== 'none') {
    style.textTransform = template.textTransform
  }
  if (template.textShadow?.enabled) {
    style.textShadow = `${template.textShadow.offsetX}px ${template.textShadow.offsetY}px ${template.textShadow.blur}px ${template.textShadow.color}`
  }

  return style
}

/**
 * Node detail panel - right sidebar showing node information
 * Shows individual node details or all combined nodes when a meta-node is selected
 */
export function NodeDetailPanel() {
  const { selectedNodeId, selectedMetaNodeId, setSelectedNodeId, setSelectedMetaNodeId } = useUIStore()
  const { nodes, getNodeById, getConnectedEdges, getMetaNodeById, toggleMetaNodeCollapse } = useGraphStore()
  const { styleRules } = useRulesStore()
  const { getFontTemplateById } = useTemplateStore()

  // IMPORTANT: All hooks must be called before any conditional returns
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [isMinimized, setIsMinimized] = useState(false)

  // Check if we're showing a meta-node or regular node
  const isMetaNode = !!selectedMetaNodeId
  const metaNode = selectedMetaNodeId ? getMetaNodeById(selectedMetaNodeId) : null
  const node = selectedNodeId ? getNodeById(selectedNodeId) : null

  // Evaluate rules to get font templates with granular scoping
  const fontTemplateApplications = useMemo<FontTemplateApplication[]>(() => {
    if (!node) return []
    const evaluation = evaluateNodeRules(node, styleRules)
    return evaluation.fontTemplates
  }, [node, styleRules])

  // Helper function to get style for a specific attribute
  const getAttributeStyle = (attributeName: string): React.CSSProperties => {
    // Find font templates that apply to this attribute
    for (const app of fontTemplateApplications) {
      if (app.scope === 'node') {
        // Node-level styling applies to everything
        const template = getFontTemplateById(app.templateId)
        if (template) return fontTemplateToStyle(template)
      } else if (app.scope === 'attribute' && app.attribute === attributeName) {
        // Attribute-level styling
        const template = getFontTemplateById(app.templateId)
        if (template) return fontTemplateToStyle(template)
      }
    }
    return {}
  }

  // Helper function to get style for a specific value within an attribute
  const getValueStyle = (attributeName: string, value: string): React.CSSProperties => {
    let resultStyle: React.CSSProperties = {}

    // Find font templates that apply to this specific value
    // Apply in priority order: node -> attribute -> value (value is most specific)
    for (const app of fontTemplateApplications) {
      if (app.scope === 'node') {
        // Node-level styling applies to everything (lowest priority)
        const template = getFontTemplateById(app.templateId)
        if (template) {
          resultStyle = { ...resultStyle, ...fontTemplateToStyle(template) }
        }
      }
    }

    for (const app of fontTemplateApplications) {
      if (app.scope === 'attribute' && app.attribute === attributeName) {
        // Attribute-level styling (medium priority)
        const template = getFontTemplateById(app.templateId)
        if (template) {
          resultStyle = { ...resultStyle, ...fontTemplateToStyle(template) }
        }
      }
    }

    for (const app of fontTemplateApplications) {
      if (app.scope === 'value' && app.attribute === attributeName) {
        // Value-level styling (highest priority) - only apply if this value matches
        if (app.values?.includes(String(value))) {
          const template = getFontTemplateById(app.templateId)
          if (template) {
            resultStyle = { ...resultStyle, ...fontTemplateToStyle(template) }
          }
        }
      }
    }

    return resultStyle
  }

  if (!selectedNodeId && !selectedMetaNodeId) return null
  if (!node && !metaNode) return null

  // Get child nodes if this is a meta-node
  const childNodes = metaNode
    ? metaNode.childNodeIds.map((id) => getNodeById(id)).filter((n): n is NonNullable<typeof n> => n !== null)
    : []

  // For regular nodes, get connection info
  const connectedEdges = node ? getConnectedEdges(selectedNodeId!) : []
  const inDegree = connectedEdges.filter((e) => e.target === selectedNodeId).length
  const outDegree = connectedEdges.filter((e) => e.source === selectedNodeId).length

  // Get connected nodes
  const connectedNodeIds = new Set<string>()
  connectedEdges.forEach((edge) => {
    if (edge.source === selectedNodeId) connectedNodeIds.add(edge.target)
    if (edge.target === selectedNodeId) connectedNodeIds.add(edge.source)
  })
  const connectedNodes = Array.from(connectedNodeIds)
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is typeof nodes[0] => n !== undefined)

  return (
    <aside className={cn(
      "bg-dark-secondary border-l border-dark flex-shrink-0 transition-all duration-300 relative flex flex-col h-screen",
      isMinimized ? "w-16" : "w-96"
    )}>
      {/* Collapse Toggle Button (matches left sidebar) */}
      <button
        onClick={() => setIsMinimized(!isMinimized)}
        className="absolute -left-3 top-6 w-6 h-6 bg-dark-tertiary border border-dark rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors z-10"
        title={isMinimized ? 'Expand panel' : 'Collapse panel'}
      >
        {isMinimized ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Header */}
      {!isMinimized && (
        <div className="flex items-center justify-between p-4 border-b border-dark bg-dark-tertiary flex-shrink-0">
          <div className="flex items-center gap-2">
            {isMetaNode ? (
              <>
                <Layers2 className="w-5 h-5 text-cyber-500" />
                <h2 className="text-lg font-bold text-slate-100">Combined Nodes</h2>
                <span className="text-sm text-slate-400">({childNodes.length})</span>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    'w-3 h-3 rounded-full',
                    node!.isStub ? 'bg-slate-500' : 'bg-cyber-500'
                  )}
                />
                <h2 className="text-lg font-bold text-slate-100">Node Details</h2>
              </>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedNodeId(null)
              setSelectedMetaNodeId(null)
            }}
            className="p-1.5 rounded-lg hover:bg-dark-secondary text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Meta-node info or regular node info */}
        {isMetaNode && metaNode ? (
          <>
            {/* Meta-node header */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Layers2 className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  Combination Info
                </h3>
              </div>
              <div className="p-3 bg-dark/50 rounded-lg border border-dark space-y-2">
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Grouped by:</span>
                  <span className="text-sm text-slate-200">{metaNode.groupByAttribute}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Value:</span>
                  <span className="text-sm text-slate-200">{metaNode.groupValue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs text-slate-500">Layer:</span>
                  <span className="text-sm text-slate-200">
                    {metaNode.layer + 1} {metaNode.layer === 0 ? '(Base)' : '(Nested)'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dark">
                  <span className="text-xs text-slate-500">Collapsed:</span>
                  <button
                    onClick={() => toggleMetaNodeCollapse(metaNode.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-cyber-500/20 hover:bg-cyber-500/30 border border-cyber-500/30 rounded text-xs text-cyber-400 transition-colors"
                  >
                    {metaNode.collapsed ? (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Expand
                      </>
                    ) : (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Collapse
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Child nodes list */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  Contained Nodes
                </h3>
                <span className="text-xs text-slate-600">({childNodes.length})</span>
              </div>
              <div className="space-y-2">
                {childNodes.map((childNode) => {
                  const isExpanded = expandedNodes.has(childNode.id)
                  return (
                    <div
                      key={childNode.id}
                      className="p-3 bg-dark/50 rounded-lg border border-dark hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <button
                          onClick={() => setSelectedNodeId(childNode.id)}
                          className="text-sm font-medium text-cyber-400 hover:text-cyber-300 transition-colors flex-1 text-left"
                        >
                          {childNode.label}
                        </button>
                        <button
                          onClick={() => {
                            const newExpanded = new Set(expandedNodes)
                            if (isExpanded) {
                              newExpanded.delete(childNode.id)
                            } else {
                              newExpanded.add(childNode.id)
                            }
                            setExpandedNodes(newExpanded)
                          }}
                          className="p-1 hover:bg-dark rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="space-y-1.5 mt-2 pt-2 border-t border-dark">
                          <div className="text-xs text-slate-500 mb-1">ID: <span className="text-slate-300 font-mono">{childNode.id}</span></div>
                          {Object.entries(childNode.attributes).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="text-xs">
                              <span className="text-slate-500">{key}:</span>{' '}
                              <span className="text-slate-300">
                                {Array.isArray(value) ? value.join(', ') : String(value)}
                              </span>
                            </div>
                          ))}
                          {Object.keys(childNode.attributes).length > 5 && (
                            <div className="text-xs text-slate-600 italic">
                              +{Object.keys(childNode.attributes).length - 5} more attributes
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        ) : node ? (
          <>
            {/* Node ID and Label */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                  Identifier
                </h3>
              </div>
              <div className="p-3 bg-dark/50 rounded-lg border border-dark">
                <p
                  className="text-sm font-mono break-all"
                  style={{ color: 'rgb(226 232 240)', ...getAttributeStyle('__id__') }}
                >
                  {node.id}
                </p>
                {node.label !== node.id && (
                  <p
                    className="text-xs mt-1"
                    style={{ color: 'rgb(148 163 184)' }}
                  >
                    Label: {node.label}
                  </p>
                )}
              </div>
            </div>

        {/* Stub Indicator */}
        {node.isStub && (
          <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <p className="text-sm text-yellow-400 font-medium">Stub Node</p>
            </div>
            <p className="text-xs text-yellow-400/70 mt-1">
              Auto-created from link reference. May be promoted when full data is loaded.
            </p>
          </div>
        )}

        {/* Tags */}
        {node.tags.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Tags
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-cyber-500/20 border border-cyber-500/30 rounded text-xs"
                  style={{ color: 'rgb(103 232 249)', ...getValueStyle('tags', tag) }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attributes */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Attributes
            </h3>
            <span className="text-xs text-slate-600">
              ({Object.keys(node.attributes).length})
            </span>
          </div>
          <div className="space-y-2">
            {Object.keys(node.attributes).length === 0 ? (
              <p className="text-sm text-slate-600 italic">No attributes</p>
            ) : (
              Object.entries(node.attributes).map(([key, value]) => (
                <div
                  key={key}
                  className="p-3 bg-dark/50 rounded-lg border border-dark hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">{key}</span>
                  </div>
                  <div className="mt-1">
                    {Array.isArray(value) ? (
                      <div className="space-y-0.5">
                        {value.map((v, i) => (
                          <div
                            key={i}
                            className="text-sm break-all"
                            style={{ color: 'rgb(226 232 240)', ...getValueStyle(key, String(v)) }}
                          >
                            {v}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p
                        className="text-sm break-all font-mono"
                        style={{ color: 'rgb(226 232 240)', ...getAttributeStyle(key) }}
                      >
                        {String(value)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timestamp */}
        {node.timestamp && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Timestamp
              </h3>
            </div>
            <div className="p-3 bg-dark/50 rounded-lg border border-dark">
              <p className="text-sm text-slate-200">
                {format(new Date(node.timestamp), 'PPpp')}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Unix: {node.timestamp}
              </p>
            </div>
          </div>
        )}

        {/* Source Files */}
        {node.sourceFiles.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Source Files
              </h3>
            </div>
            <div className="space-y-1">
              {node.sourceFiles.map((file) => (
                <div
                  key={file}
                  className="px-3 py-2 bg-dark/50 rounded-lg border border-dark text-sm text-slate-300"
                >
                  {file}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Connections */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Connections
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-xs text-green-400 mb-1">Incoming</div>
              <div className="text-2xl font-bold text-green-400">{inDegree}</div>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="text-xs text-blue-400 mb-1">Outgoing</div>
              <div className="text-2xl font-bold text-blue-400">{outDegree}</div>
            </div>
          </div>

          {/* Connected Nodes */}
          {connectedNodes.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-slate-500 mb-2">
                Connected Nodes ({connectedNodes.length})
              </h4>
              {connectedNodes.slice(0, 10).map((connectedNode) => (
                <button
                  key={connectedNode.id}
                  onClick={() => setSelectedNodeId(connectedNode.id)}
                  className="w-full px-3 py-2 bg-dark/50 rounded-lg border border-dark hover:border-cyber-500/50 hover:bg-cyber-500/10 transition-colors text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300 truncate group-hover:text-cyber-400 transition-colors">
                      {connectedNode.label}
                    </span>
                    {connectedNode.isStub && (
                      <span className="text-xs text-slate-600">STUB</span>
                    )}
                  </div>
                </button>
              ))}
              {connectedNodes.length > 10 && (
                <p className="text-xs text-slate-600 text-center py-2">
                  +{connectedNodes.length - 10} more
                </p>
              )}
            </div>
          )}
        </div>
        </>
      ) : null}
      </div>
      )}
    </aside>
  )
}
