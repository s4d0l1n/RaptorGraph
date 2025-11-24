/**
 * Node Detail Panel
 * Shows detailed information about a selected node
 */

import { X, Copy, Tag, Link as LinkIcon } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useGraphStore } from '../stores/graphStore'
import { useCardTemplateStore } from '../stores/cardTemplateStore'
import { useAttributeTemplateStore } from '../stores/attributeTemplateStore'
import { useStyleStore } from '../stores/styleStore'
import { computeNodeStyle } from '../utils/styleEvaluator'
import type { AttributeDisplay, AttributeTemplate } from '../types'

/**
 * Resolve AttributeDisplay properties by merging attribute template
 * Hierarchy: Default Template → Specific Template → Overrides
 */
function resolveAttributeDisplay(
  display: AttributeDisplay | undefined,
  attributeTemplateGetter: (id: string) => AttributeTemplate | undefined,
  defaultTemplate: AttributeTemplate | undefined
): AttributeTemplate {
  // Start with default template or empty object
  let resolved: any = defaultTemplate ? { ...defaultTemplate } : {}

  // Apply specific attribute template if assigned
  if (display?.attributeTemplateId) {
    const template = attributeTemplateGetter(display.attributeTemplateId)
    if (template) {
      // Merge template properties (overwriting defaults)
      Object.keys(template).forEach(key => {
        if (template[key as keyof AttributeTemplate] !== undefined) {
          resolved[key] = template[key as keyof AttributeTemplate]
        }
      })
    }
  }

  // Apply overrides (highest priority)
  if (display?.overrides) {
    Object.keys(display.overrides).forEach(key => {
      if (display.overrides![key as keyof typeof display.overrides] !== undefined) {
        resolved[key] = display.overrides![key as keyof typeof display.overrides]
      }
    })
  }

  return resolved
}

export function NodeDetailPanel() {
  const { closePanel } = useUIStore()
  const { nodes, getEdgesForNode } = useGraphStore()
  const { getDefaultTemplate, getCardTemplate } = useCardTemplateStore()
  const { getAttributeTemplate, getDefaultTemplate: getDefaultAttributeTemplate } = useAttributeTemplateStore()
  const { getEnabledRules } = useStyleStore()

  // Get selected node from localStorage (set by G6GraphView)
  const selectedNodeId = localStorage.getItem('selectedNodeId')
  const data = nodes.find(n => n.id === selectedNodeId)

  if (!data) return null
  const edges = getEdgesForNode(data.id)

  // Get the active card template for this node
  const enabledRules = getEnabledRules()
  const style = computeNodeStyle(data, enabledRules)
  const defaultCardTemplate = getDefaultTemplate()
  let activeCardTemplate = defaultCardTemplate

  if (style.cardTemplateId) {
    const ruleTemplate = getCardTemplate(style.cardTemplateId)
    if (ruleTemplate) {
      activeCardTemplate = ruleTemplate
    }
  }

  const defaultAttrTemplate = getDefaultAttributeTemplate()

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
            {Object.entries(data.attributes).map(([key, value]) => {
              // Find AttributeDisplay for this attribute in the card template
              const attrDisplay = activeCardTemplate?.attributeDisplays.find(d => d.attribute === key)

              // Resolve the attribute template for this attribute
              const resolvedTemplate = resolveAttributeDisplay(attrDisplay, getAttributeTemplate, defaultAttrTemplate)

              // Build inline styles from template
              const labelStyle: React.CSSProperties = {}
              const valueStyle: React.CSSProperties = {}
              const containerStyle: React.CSSProperties = {}

              // Always try to apply template properties
              if (resolvedTemplate) {
                // Apply label styling
                if (resolvedTemplate.fontSize) labelStyle.fontSize = `${resolvedTemplate.fontSize}px`
                if (resolvedTemplate.fontFamily) labelStyle.fontFamily = resolvedTemplate.fontFamily
                if (resolvedTemplate.fontWeight) labelStyle.fontWeight = resolvedTemplate.fontWeight
                if (resolvedTemplate.fontStyle) labelStyle.fontStyle = resolvedTemplate.fontStyle
                if (resolvedTemplate.textDecoration) labelStyle.textDecoration = resolvedTemplate.textDecoration
                if (resolvedTemplate.color) labelStyle.color = resolvedTemplate.color
                if (resolvedTemplate.textShadow) labelStyle.textShadow = resolvedTemplate.textShadow
                if (resolvedTemplate.textOutlineWidth && resolvedTemplate.textOutlineColor) {
                  labelStyle.WebkitTextStroke = `${resolvedTemplate.textOutlineWidth}px ${resolvedTemplate.textOutlineColor}`
                }

                // Apply value styling (same as label)
                Object.assign(valueStyle, labelStyle)

                // Apply background styling
                if (resolvedTemplate.backgroundColor) {
                  containerStyle.backgroundColor = resolvedTemplate.backgroundColor
                }
                if (resolvedTemplate.backgroundPadding) {
                  containerStyle.padding = `${resolvedTemplate.backgroundPadding}px`
                }
                if (resolvedTemplate.borderRadius) {
                  containerStyle.borderRadius = `${resolvedTemplate.borderRadius}px`
                }
              }

              const displayLabel = attrDisplay?.displayLabel || key
              const prefix = resolvedTemplate?.labelPrefix || ''
              const suffix = resolvedTemplate?.labelSuffix || ''

              return (
                <div
                  key={key}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  style={containerStyle}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className="text-xs font-medium"
                      style={labelStyle}
                    >
                      {prefix}{displayLabel}{suffix}
                    </span>
                    <button
                      onClick={() =>
                        copyToClipboard(Array.isArray(value) ? value.join(', ') : String(value))
                      }
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Copy value"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-sm" style={valueStyle}>
                    {Array.isArray(value) ? (
                      // Array: show as simple list with same formatting as single values
                      <div className="space-y-0.5">
                        {value.map((v, idx) => (
                          <div key={idx} className="font-mono break-all">
                            {String(v)}
                          </div>
                        ))}
                      </div>
                    ) : typeof value === 'object' && value !== null ? (
                      // Object: show as key-value pairs
                      <div className="space-y-1 pl-2 border-l-2 border-blue-300 dark:border-blue-700">
                        {Object.entries(value).map(([k, v], idx) => (
                          <div key={idx} className="flex items-start space-x-2">
                            <span className="text-xs font-semibold min-w-[80px]">
                              {k}:
                            </span>
                            <span className="text-xs font-mono break-all">
                              {String(v)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // String: show as mono text
                      <span className="font-mono break-all">{String(value)}</span>
                    )}
                  </div>
                </div>
              )
            })}
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
                  {edge.sourceColumn && edge.targetColumn && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      via {edge.sourceColumn} → {edge.targetColumn}
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
