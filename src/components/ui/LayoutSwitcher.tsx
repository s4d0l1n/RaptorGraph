import { useState } from 'react'
import { Network, ChevronDown, Zap, FolderOpen } from 'lucide-react'
import { LayoutPresets } from '@/components/ui/LayoutPresets'
import type { LayoutType } from '@/types'

// Re-export LayoutType for backwards compatibility
export type { LayoutType }

interface LayoutInfo {
  id: LayoutType
  name: string
  description: string
  icon: string
}

const LAYOUTS: LayoutInfo[] = [
  { id: 'bigbang', name: 'Big Bang', description: 'Physics-based force layout with dynamic interactions', icon: '💥' },
]

interface LayoutSwitcherProps {
  currentLayout?: LayoutType
  onLayoutChange: (layout: LayoutType) => void
  onAutoLayout?: () => void
}

/**
 * Layout Switcher UI
 * Allows users to switch between different graph layouts
 */
export function LayoutSwitcher({
  currentLayout = 'bigbang',
  onLayoutChange,
  onAutoLayout
}: LayoutSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPresetsOpen, setIsPresetsOpen] = useState(false)

  const currentLayoutInfo = LAYOUTS.find(l => l.id === currentLayout) || LAYOUTS[0]

  const handleLayoutSelect = (layout: LayoutType) => {
    onLayoutChange(layout)
    setIsOpen(false)
  }

  return (
    <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-2xl">
        {/* Current Layout Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-3 px-4 py-2 hover:bg-dark-tertiary transition-colors"
        >
          <Network className="w-4 h-4 text-slate-400" />
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentLayoutInfo.icon}</span>
            <div className="text-left">
              <div className="text-sm font-medium text-slate-200">{currentLayoutInfo.name}</div>
              <div className="text-xs text-slate-400">{currentLayoutInfo.description}</div>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Action Buttons */}
        <div className="border-t border-dark">
          {onAutoLayout && (
            <button
              onClick={() => {
                onAutoLayout()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-dark-tertiary transition-colors text-amber-400 hover:text-amber-300"
            >
              <Zap className="w-4 h-4" />
              <span className="text-sm font-medium">Auto-Layout</span>
            </button>
          )}
          <button
            onClick={() => {
              setIsPresetsOpen(true)
              setIsOpen(false)
            }}
            className="w-full flex items-center gap-2 px-4 py-2 hover:bg-dark-tertiary transition-colors text-blue-400 hover:text-blue-300"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-sm font-medium">Layout Presets</span>
          </button>
        </div>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-dark-secondary border border-dark rounded-lg shadow-2xl max-h-96 overflow-y-auto">
            {LAYOUTS.map((layout) => (
              <button
                key={layout.id}
                onClick={() => handleLayoutSelect(layout.id)}
                className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-dark-tertiary transition-colors ${
                  layout.id === currentLayout ? 'bg-dark-tertiary' : ''
                }`}
              >
                <span className="text-xl">{layout.icon}</span>
                <div className="text-left flex-1">
                  <div className="text-sm font-medium text-slate-200">{layout.name}</div>
                  <div className="text-xs text-slate-400">{layout.description}</div>
                </div>
                {layout.id === currentLayout && (
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Layout Presets Modal */}
      <LayoutPresets
        currentLayout={currentLayout}
        onLoadPreset={onLayoutChange}
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
      />
    </div>
  )
}
