import { X, ExternalLink, Tag, Database, Clock, FileText, Layers2, ChevronDown, ChevronUp } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useGraphStore } from '@/stores/graphStore'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useState } from 'react'

/**
 * Node detail panel - slide-out from right showing node information
 * Shows individual node details or all combined nodes when a meta-node is selected
 */
export function NodeDetailPanel() {
  const { selectedNodeId, selectedMetaNodeId, setSelectedNodeId, setSelectedMetaNodeId } = useUIStore()
  const { nodes, getNodeById, getConnectedEdges, getMetaNodeById, toggleMetaNodeCollapse } = useGraphStore()

  // Check if we're showing a meta-node or regular node
  const isMetaNode = !!selectedMetaNodeId
  const metaNode = selectedMetaNodeId ? getMetaNodeById(selectedMetaNodeId) : null
  const node = selectedNodeId ? getNodeById(selectedNodeId) : null

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

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-dark-secondary border-l border-dark shadow-2xl z-40 overflow-hidden flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark bg-dark-tertiary">
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

      {/* Content */}
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
                <p className="text-sm font-mono text-slate-200 break-all">{node.id}</p>
                {node.label !== node.id && (
                  <p className="text-xs text-slate-400 mt-1">Label: {node.label}</p>
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
                  className="px-2 py-1 bg-cyber-500/20 border border-cyber-500/30 rounded text-xs text-cyber-400"
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
                      <div className="flex flex-wrap gap-1 mt-1">
                        {value.map((v, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-200 break-all font-mono">{String(value)}</p>
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
    </div>
  )
}
