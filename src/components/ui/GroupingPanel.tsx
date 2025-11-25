import { useState, useMemo } from 'react'
import { X, Layers2 } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useGraphStore } from '@/stores/graphStore'
import { generateMetaNodes } from '@/lib/grouping'
import { toast } from './Toast'

/**
 * Grouping configuration panel
 * UI for enabling and configuring node grouping by attributes
 */
export function GroupingPanel() {
  const { activePanel, setActivePanel } = useUIStore()
  const { groupingConfig, setGroupingConfig } = useProjectStore()
  const { nodes, setMetaNodes } = useGraphStore()

  const [enabled, setEnabled] = useState(groupingConfig.enabled)
  const [groupByAttribute, setGroupByAttribute] = useState(
    groupingConfig.groupByAttribute || ''
  )
  const [autoCollapse, setAutoCollapse] = useState(groupingConfig.autoCollapse)

  const isOpen = activePanel === 'grouping'

  // Get available attributes for grouping
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

  const handleApplyGrouping = () => {
    if (enabled && !groupByAttribute) {
      toast.error('Please select an attribute to group by')
      return
    }

    const newConfig = {
      enabled,
      groupByAttribute: enabled ? groupByAttribute : undefined,
      autoCollapse,
    }

    setGroupingConfig(newConfig)

    // Generate meta-nodes if enabled
    if (enabled && groupByAttribute) {
      const metaNodes = generateMetaNodes(nodes, newConfig)
      setMetaNodes(metaNodes)
      toast.success(
        `Grouping applied: ${metaNodes.length} group${metaNodes.length !== 1 ? 's' : ''} created`
      )
    } else {
      setMetaNodes([])
      toast.success('Grouping disabled')
    }

    handleClose()
  }

  const handlePreview = () => {
    if (!enabled || !groupByAttribute) {
      toast.error('Please enable grouping and select an attribute')
      return
    }

    const tempConfig = {
      enabled,
      groupByAttribute,
      autoCollapse,
    }

    const metaNodes = generateMetaNodes(nodes, tempConfig)

    if (metaNodes.length === 0) {
      toast.info('No groups would be created (need 2+ nodes per group)')
    } else {
      toast.info(
        `Preview: ${metaNodes.length} group${metaNodes.length !== 1 ? 's' : ''} would be created`
      )
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Node Grouping</h2>
            <p className="text-sm text-slate-400 mt-1">
              Group nodes by attribute values into collapsible meta-nodes
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
          {/* Enable Grouping */}
          <div className="flex items-center justify-between p-4 bg-dark border border-dark rounded-lg">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Layers2 className="w-5 h-5 text-cyber-500" />
                <span className="font-semibold text-slate-100">Enable Grouping</span>
              </div>
              <p className="text-sm text-slate-400">
                Group nodes with the same attribute value together
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

          {/* Group By Attribute */}
          {enabled && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Group By Attribute *
              </label>
              <select
                value={groupByAttribute}
                onChange={(e) => setGroupByAttribute(e.target.value)}
                className="w-full px-3 py-2 bg-dark border border-dark-tertiary rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
              >
                <option value="">Select an attribute...</option>
                {availableAttributes.map((attr) => (
                  <option key={attr} value={attr}>
                    {attr}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Nodes with the same value for this attribute will be grouped together
              </p>
            </div>
          )}

          {/* Auto-Collapse */}
          {enabled && (
            <div className="flex items-start gap-3 p-4 bg-dark border border-dark rounded-lg">
              <input
                type="checkbox"
                id="autoCollapse"
                checked={autoCollapse}
                onChange={(e) => setAutoCollapse(e.target.checked)}
                className="mt-1 w-4 h-4 cursor-pointer"
              />
              <div className="flex-1">
                <label
                  htmlFor="autoCollapse"
                  className="font-medium text-slate-200 cursor-pointer"
                >
                  Auto-Collapse Groups
                </label>
                <p className="text-sm text-slate-400 mt-1">
                  Automatically collapse groups when created (can be expanded by clicking)
                </p>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="font-medium text-blue-400 mb-2">How Grouping Works</div>
            <ul className="text-sm text-slate-300 space-y-1.5">
              <li>• Nodes with the same attribute value are grouped into meta-nodes</li>
              <li>• Only groups with 2+ nodes are created</li>
              <li>• Click meta-nodes to expand/collapse and see member nodes</li>
              <li>• Edges are preserved and connect to/from meta-nodes</li>
              <li>
                • Multi-value attributes (arrays) create membership in multiple groups
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-dark bg-dark flex items-center justify-between">
          <button
            onClick={handlePreview}
            disabled={!enabled || !groupByAttribute}
            className="px-4 py-2 bg-dark-tertiary hover:bg-slate-700 disabled:bg-dark disabled:text-slate-600 disabled:cursor-not-allowed text-slate-300 rounded-lg transition-colors"
          >
            Preview Groups
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
              Apply Grouping
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
