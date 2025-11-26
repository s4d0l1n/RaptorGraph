import { useState, useMemo } from 'react'
import { X, Layers2, Plus, Trash2, GripVertical } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useGraphStore } from '@/stores/graphStore'
import { generateMetaNodes } from '@/lib/grouping'
import { toast } from './Toast'
import type { CombinationLayer } from '@/types'

/**
 * Node combination configuration panel
 * UI for enabling and configuring node combination by attributes
 */
export function GroupingPanel() {
  const { activePanel, setActivePanel } = useUIStore()
  const { groupingConfig, setGroupingConfig } = useProjectStore()
  const { nodes, setMetaNodes } = useGraphStore()

  const [enabled, setEnabled] = useState(groupingConfig.enabled)

  // Initialize layers from config or create default
  const [layers, setLayers] = useState<CombinationLayer[]>(() => {
    if (groupingConfig.layers && groupingConfig.layers.length > 0) {
      return groupingConfig.layers
    }
    // Legacy support: convert single attribute to layer
    if (groupingConfig.groupByAttribute) {
      return [
        {
          id: `layer-${Date.now()}`,
          attribute: groupingConfig.groupByAttribute,
          autoCollapse: groupingConfig.autoCollapse,
          order: 0,
        },
      ]
    }
    return []
  })

  const isOpen = activePanel === 'grouping'

  // Get available attributes for combining
  const availableAttributes = useMemo(() => {
    const attrSet = new Set<string>()
    nodes.forEach((node) => {
      Object.keys(node.attributes).forEach((key) => attrSet.add(key))
    })
    return Array.from(attrSet).sort()
  }, [nodes])

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  const handleAddLayer = () => {
    const newLayer: CombinationLayer = {
      id: `layer-${Date.now()}`,
      attribute: '',
      autoCollapse: true,
      order: layers.length,
    }
    setLayers([...layers, newLayer])
  }

  const handleRemoveLayer = (layerId: string) => {
    const filtered = layers.filter((l) => l.id !== layerId)
    // Reorder remaining layers
    const reordered = filtered.map((l, idx) => ({ ...l, order: idx }))
    setLayers(reordered)
  }

  const handleUpdateLayer = (layerId: string, updates: Partial<CombinationLayer>) => {
    setLayers(layers.map((l) => (l.id === layerId ? { ...l, ...updates } : l)))
  }

  const handleApplyGrouping = () => {
    if (enabled && layers.length === 0) {
      toast.error('Please add at least one combination layer')
      return
    }

    if (enabled && layers.some((l) => !l.attribute)) {
      toast.error('Please select an attribute for all layers')
      return
    }

    const newConfig = {
      enabled,
      layers: enabled ? layers : undefined,
      // Keep legacy fields for backward compatibility
      groupByAttribute: enabled && layers.length > 0 ? layers[0].attribute : undefined,
      autoCollapse: enabled && layers.length > 0 ? layers[0].autoCollapse : true,
    }

    setGroupingConfig(newConfig)

    // Generate meta-nodes if enabled
    if (enabled && layers.length > 0) {
      const metaNodes = generateMetaNodes(nodes, newConfig)
      const totalLayers = layers.length
      toast.success(
        `Combined nodes: ${metaNodes.length} combination${metaNodes.length !== 1 ? 's' : ''} created across ${totalLayers} layer${totalLayers !== 1 ? 's' : ''}`
      )
      setMetaNodes(metaNodes)
    } else {
      setMetaNodes([])
      toast.success('Node combinations cleared')
    }

    handleClose()
  }

  const handlePreview = () => {
    if (!enabled || layers.length === 0) {
      toast.error('Please enable combining and add at least one layer')
      return
    }

    if (layers.some((l) => !l.attribute)) {
      toast.error('Please select an attribute for all layers')
      return
    }

    const tempConfig = {
      enabled,
      layers,
      groupByAttribute: layers[0].attribute,
      autoCollapse: layers[0].autoCollapse,
    }

    const metaNodes = generateMetaNodes(nodes, tempConfig)

    if (metaNodes.length === 0) {
      toast.info('No combinations would be created (need 2+ nodes per combination)')
    } else {
      const totalLayers = layers.length
      toast.info(
        `Preview: ${metaNodes.length} combination${metaNodes.length !== 1 ? 's' : ''} across ${totalLayers} layer${totalLayers !== 1 ? 's' : ''}`
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Combine Nodes</h2>
            <p className="text-sm text-slate-400 mt-1">
              Combine nodes by attribute values into collapsible containers
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-dark rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Enable Combining */}
          <div className="flex items-center justify-between p-4 bg-dark border border-dark rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers2 className="w-5 h-5 text-cyber-500" />
                <span className="font-semibold text-slate-100">Enable Combining</span>
              </div>
              <p className="text-sm text-slate-400">
                Combine nodes with the same attribute values into nested layers
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyber-500"></div>
            </label>
          </div>

          {/* Combination Layers */}
          {enabled && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-300">
                  Combination Layers
                </label>
                <button
                  onClick={handleAddLayer}
                  className="flex items-center gap-1 px-3 py-1 bg-cyber-500 hover:bg-cyber-600 text-white text-sm rounded transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Layer
                </button>
              </div>

              {layers.length === 0 && (
                <div className="p-4 bg-dark border border-dark-tertiary rounded-lg text-center text-slate-400 text-sm">
                  No layers defined. Click "Add Layer" to create your first combination layer.
                </div>
              )}

              {layers.map((layer, index) => (
                <div
                  key={layer.id}
                  className="p-4 bg-dark border border-dark-tertiary rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-500" />
                      <span className="font-medium text-slate-200">
                        Layer {index + 1}
                        {index === 0 && ' (Base)'}
                        {index > 0 && ' (Nested)'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveLayer(layer.id)}
                      className="p-1 hover:bg-dark-secondary rounded transition-colors text-slate-400 hover:text-red-400"
                      aria-label="Remove layer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Combine by attribute
                    </label>
                    <select
                      value={layer.attribute}
                      onChange={(e) =>
                        handleUpdateLayer(layer.id, { attribute: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-dark-secondary border border-dark rounded text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyber-500"
                    >
                      <option value="">Select an attribute...</option>
                      {availableAttributes.map((attr) => (
                        <option key={attr} value={attr}>
                          {attr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`collapse-${layer.id}`}
                      checked={layer.autoCollapse}
                      onChange={(e) =>
                        handleUpdateLayer(layer.id, { autoCollapse: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor={`collapse-${layer.id}`}
                      className="text-sm text-slate-300 cursor-pointer"
                    >
                      Auto-collapse this layer
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="font-medium text-blue-400 mb-2">How Nested Combinations Work</div>
            <ul className="text-sm text-slate-300 space-y-1.5">
              <li>• <strong>Layer 1 (Base):</strong> Nodes with matching attributes are combined</li>
              <li>• <strong>Layer 2+ (Nested):</strong> Combines the combinations from previous layers</li>
              <li>• Only combinations with 2+ items are created</li>
              <li>• Click containers to expand/collapse and see contents</li>
              <li>• Edges are preserved and connect to/from containers</li>
              <li>• Example: Layer 1 by "department", Layer 2 by "location" groups departments by location</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark bg-dark flex items-center justify-between">
          <button
            onClick={handlePreview}
            disabled={!enabled || layers.length === 0}
            className="px-4 py-2 bg-dark-tertiary hover:bg-slate-700 disabled:bg-dark disabled:text-slate-600 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
          >
            Preview Combinations
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-dark hover:bg-dark-tertiary text-slate-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyGrouping}
              className="px-4 py-2 bg-cyber-500 hover:bg-cyber-600 text-white rounded-lg transition-colors font-medium"
            >
              Apply Combination
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
