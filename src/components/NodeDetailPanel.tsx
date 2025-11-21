/**
 * Node Detail Panel
 * Shows detailed information about a selected node
 */

import { X, Copy, Tag, Link as LinkIcon } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useGraphStore } from '../stores/graphStore'

export function NodeDetailPanel() {
  const { selectedNode, closePanel } = useUIStore()
  const { getEdgesForNode } = useGraphStore()

  if (!selectedNode) return null

  const { data } = selectedNode
  const edges = getEdgesForNode(data.id)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 shadow-2xl z-40 flex flex-col border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Node Details
        </h2>
        <button
          onClick={() => closePanel('detailPanel')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Node ID */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Node ID
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 font-mono text-sm break-all">
              {data.id}
            </div>
            <button
              onClick={() => copyToClipboard(data.id)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Copy ID"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Label */}
        {data.label && data.label !== data.id && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Label
            </label>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              {data.label}
            </div>
          </div>
        )}

        {/* Stub Status */}
        {data.isStub && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ <strong>Stub Node</strong> - Auto-created from link mapping
            </p>
          </div>
        )}

        {/* Sources */}
        {data._sources && data._sources.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Source Files
            </label>
            <div className="flex flex-wrap gap-2">
              {data._sources.map((source, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-cyber-100 dark:bg-cyber-900/30 text-cyber-700 dark:text-cyber-300 rounded text-xs font-medium"
                >
                  {source}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {data.tags.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              <Tag className="w-3 h-3 inline mr-1" />
              Tags ({data.tags.length})
            </label>
            <div className="flex flex-wrap gap-2">
              {data.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Attributes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Attributes ({Object.keys(data.attributes).length})
          </label>
          <div className="space-y-3">
            {Object.entries(data.attributes).map(([key, value]) => (
              <div
                key={key}
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {key}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(Array.isArray(value) ? value.join(', ') : value)
                    }
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Copy value"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {Array.isArray(value) ? (
                    <div className="flex flex-wrap gap-1">
                      {value.map((v, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="font-mono break-all">{value}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Connected Edges */}
        {edges.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              <LinkIcon className="w-3 h-3 inline mr-1" />
              Connected Edges ({edges.length})
            </label>
            <div className="space-y-2">
              {edges.slice(0, 10).map((edge) => (
                <div
                  key={edge.id}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs"
                >
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {edge.source === data.id ? '→' : '←'}
                    </span>
                    <span className="font-mono break-all">
                      {edge.source === data.id ? edge.target : edge.source}
                    </span>
                  </div>
                  {edge.sourceAttr && edge.targetAttr && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      via {edge.sourceAttr} → {edge.targetAttr}
                    </div>
                  )}
                </div>
              ))}
              {edges.length > 10 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                  ... and {edges.length - 10} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
