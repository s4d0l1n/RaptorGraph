import { useState, useMemo } from 'react'
import { X, Circle, Grid3x3, Target, Clock, Shuffle } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useProjectStore } from '@/stores/projectStore'
import { useGraphStore } from '@/stores/graphStore'
import { toast } from './Toast'
import type { LayoutType } from '@/types'

interface LayoutOption {
  type: LayoutType
  label: string
  description: string
  icon: React.ReactNode
}

/**
 * Layout selector panel
 * UI for choosing graph layout algorithm
 */
export function LayoutPanel() {
  const { activePanel, setActivePanel } = useUIStore()
  const { layoutConfig, setLayoutConfig } = useProjectStore()
  const { nodes } = useGraphStore()

  const [selectedLayout, setSelectedLayout] = useState<LayoutType>(layoutConfig.type)
  const [swimlaneAttribute, setSwimlaneAttribute] = useState(
    layoutConfig.timelineSwimlaneAttribute || ''
  )

  const isOpen = activePanel === 'layout'

  // Get available attributes for swimlane grouping
  const availableAttributes = useMemo(() => {
    const attrSet = new Set<string>()
    nodes.forEach((node) => {
      Object.keys(node.attributes).forEach((key) => attrSet.add(key))
    })
    return Array.from(attrSet).sort()
  }, [nodes])

  const layouts: LayoutOption[] = [
    {
      type: 'circle',
      label: 'Circle',
      description: 'Nodes arranged in a circular pattern',
      icon: <Circle className="w-6 h-6" />,
    },
    {
      type: 'grid',
      label: 'Grid',
      description: 'Nodes arranged in a grid pattern',
      icon: <Grid3x3 className="w-6 h-6" />,
    },
    {
      type: 'concentric',
      label: 'Concentric',
      description: 'Nodes in concentric circles based on degree',
      icon: <Target className="w-6 h-6" />,
    },
    {
      type: 'timeline',
      label: 'Timeline',
      description: 'Nodes positioned by timestamp with optional swimlanes',
      icon: <Clock className="w-6 h-6" />,
    },
    {
      type: 'fcose',
      label: 'Force',
      description: 'Force-directed layout (random fallback)',
      icon: <Shuffle className="w-6 h-6" />,
    },
  ]

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  const handleApplyLayout = () => {
    setLayoutConfig({
      type: selectedLayout,
      timelineSwimlaneAttribute: selectedLayout === 'timeline' ? swimlaneAttribute : undefined,
    })
    toast.success(`Applied ${layouts.find((l) => l.type === selectedLayout)?.label} layout`)
  }

  const currentLayoutOption = layouts.find((l) => l.type === selectedLayout)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Graph Layout</h2>
            <p className="text-sm text-slate-400 mt-1">
              Choose how nodes are positioned in the graph
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
        <div className="flex-1 overflow-y-auto p-4">
          {/* Layout Options */}
          <section className="mb-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Layout Algorithm</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {layouts.map((layout) => (
                <button
                  key={layout.type}
                  onClick={() => setSelectedLayout(layout.type)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedLayout === layout.type
                      ? 'border-cyber-500 bg-cyber-500/10'
                      : 'border-dark bg-dark hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 ${
                        selectedLayout === layout.type ? 'text-cyber-400' : 'text-slate-400'
                      }`}
                    >
                      {layout.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-100 mb-1">{layout.label}</div>
                      <div className="text-sm text-slate-400">{layout.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Timeline-specific options */}
          {selectedLayout === 'timeline' && (
            <section className="p-4 bg-dark border border-dark rounded-lg">
              <h3 className="text-lg font-semibold text-slate-100 mb-3">Timeline Options</h3>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Swimlane Attribute (Optional)
                </label>
                <select
                  value={swimlaneAttribute}
                  onChange={(e) => setSwimlaneAttribute(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-secondary border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                >
                  <option value="">No swimlanes (Y-axis jitter)</option>
                  {availableAttributes.map((attr) => (
                    <option key={attr} value={attr}>
                      {attr}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Group nodes into horizontal swimlanes by attribute value
                </p>
              </div>
            </section>
          )}

          {/* Current Layout Info */}
          <section className="mt-6 p-4 bg-dark-tertiary border border-dark rounded-lg">
            <div className="text-sm text-slate-400">
              <span className="font-medium">Current Layout:</span>{' '}
              {layouts.find((l) => l.type === layoutConfig.type)?.label || 'Circle'}
            </div>
            {layoutConfig.type === 'timeline' && layoutConfig.timelineSwimlaneAttribute && (
              <div className="text-sm text-slate-400 mt-1">
                <span className="font-medium">Swimlane Attribute:</span>{' '}
                {layoutConfig.timelineSwimlaneAttribute}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark">
          <div className="text-sm text-slate-400">
            {currentLayoutOption && (
              <span>
                Selected: <span className="font-medium">{currentLayoutOption.label}</span>
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-dark hover:bg-dark-secondary text-slate-300 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyLayout}
              className="px-4 py-2 bg-cyber-500 hover:bg-cyber-600 text-white rounded transition-colors"
            >
              Apply Layout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
