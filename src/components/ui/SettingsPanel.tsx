import { X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useSettingsStore } from '@/stores/settingsStore'

/**
 * Settings panel for application configuration
 */
export function SettingsPanel() {
  const { activePanel, setActivePanel } = useUIStore()
  const { useWebGL, setUseWebGL } = useSettingsStore()

  const isOpen = activePanel === 'settings'

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark">
          <h2 className="text-xl font-bold text-slate-100">Settings</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-dark rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(80vh-140px)]">
          {/* Rendering Settings */}
          <section>
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Rendering</h3>

            <div className="space-y-4">
              {/* WebGL Toggle */}
              <div className="flex items-center justify-between p-4 bg-dark border border-dark-tertiary rounded-lg">
                <div className="flex-1">
                  <div className="font-medium text-slate-200">WebGL Rendering</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Use GPU-accelerated WebGL for better performance with large graphs.
                    Recommended for graphs with 500+ nodes.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4">
                  <input
                    type="checkbox"
                    checked={useWebGL}
                    onChange={(e) => setUseWebGL(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyber-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyber-500"></div>
                </label>
              </div>

              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                <p className="text-sm text-cyan-300">
                  {useWebGL ? (
                    <>⚡ WebGL Rendering Active - GPU-accelerated rendering for maximum performance</>
                  ) : (
                    <>🎨 Canvas 2D Rendering Active - Works great for graphs up to 1000+ nodes</>
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark bg-dark-tertiary">
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 bg-cyber-500 hover:bg-cyber-600 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
