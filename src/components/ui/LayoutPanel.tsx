import { X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

/**
 * Layout selector panel - DISABLED (no layouts available)
 */
export function LayoutPanel() {
  const { activePanel, setActivePanel } = useUIStore()

  const isOpen = activePanel === 'layout'

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-100">Graph Layout</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-dark rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-slate-400">
          Layout algorithms have been removed. Nodes can be freely positioned by dragging.
        </p>
      </div>
    </div>
  )
}
