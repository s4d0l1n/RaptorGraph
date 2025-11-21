import { useEffect } from 'react'
import { Moon, Sun, Upload, Palette, AlertCircle, CheckCircle } from 'lucide-react'
import { useUIStore } from './stores/uiStore'
import { useGraphStore } from './stores/graphStore'
import { FileUpload, CSVFilesList } from './components/FileUpload'
import { ColumnMapper } from './components/ColumnMapper'
import { GraphView, GraphControls } from './components/GraphView'
import { NodeDetailPanel } from './components/NodeDetailPanel'
import { StyleRulesPanel } from './components/StyleRulesPanel'
import { ProjectIOButtons } from './components/ProjectIO'

function App() {
  const { darkMode, toggleDarkMode, panels, openPanel, error, success, clearMessages } = useUIStore()
  const { nodes, edges } = useGraphStore()

  useEffect(() => {
    // Initialize dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const hasData = nodes.length > 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 flex-shrink-0 z-30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl font-bold text-cyber-600 dark:text-cyber-400">
                🦖 Protoceratop
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Threat Hunting Graph Visualization
              </span>
            </div>

            {hasData && (
              <div className="text-sm text-gray-600 dark:text-gray-400 border-l border-gray-300 dark:border-gray-700 pl-4">
                {nodes.length} nodes • {edges.length} edges
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {hasData && <ProjectIOButtons />}

            <button
              onClick={() => openPanel('uploadWizard')}
              className="flex items-center space-x-2 px-4 py-2 bg-cyber-600 hover:bg-cyber-700 text-white rounded-lg transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Upload CSV</span>
            </button>

            {hasData && (
              <button
                onClick={() => openPanel('stylePanel')}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
              >
                <Palette className="w-4 h-4" />
                <span>Style Rules</span>
              </button>
            )}

            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Messages */}
      {error && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4 flex items-start space-x-3 max-w-md">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={clearMessages}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="fixed top-20 right-4 z-50 animate-slide-in">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg shadow-lg p-4 flex items-start space-x-3 max-w-md">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
            <button
              onClick={clearMessages}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {!hasData ? (
          /* Welcome Screen */
          <div className="h-full flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-gray-100">
                  Welcome to Protoceratop
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  A powerful, 100% client-side threat hunting graph visualization tool.
                  Turn your CSVs into interactive graphs instantly!
                </p>
              </div>

              <FileUpload />
              <CSVFilesList />

              <div className="mt-8 grid grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-cyber-600 dark:text-cyber-400 font-semibold mb-2">
                    ⚡ 100% Offline
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    All processing happens in your browser. No data ever leaves your machine.
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-cyber-600 dark:text-cyber-400 font-semibold mb-2">
                    🎨 Powerful Styling
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Conditional styling with full regex support. Highlight what matters.
                  </p>
                </div>

                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-cyber-600 dark:text-cyber-400 font-semibold mb-2">
                    🔗 Smart Linking
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    Auto-create edges by matching attribute values. Stub nodes included.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Graph View */
          <div className="h-full relative">
            <GraphView />
            <GraphControls />
          </div>
        )}
      </main>

      {/* Modals & Panels */}
      {panels.uploadWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Upload CSV Files</h2>
              <button
                onClick={() => useUIStore.getState().closePanel('uploadWizard')}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>
            <FileUpload />
            <CSVFilesList />
          </div>
        </div>
      )}

      {panels.columnMapper && <ColumnMapper />}
      {panels.detailPanel && <NodeDetailPanel />}
      {panels.stylePanel && <StyleRulesPanel />}
    </div>
  )
}

export default App
