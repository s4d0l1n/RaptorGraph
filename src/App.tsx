import { useEffect } from 'react'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toaster, toast } from '@/components/ui/Toast'
import { UploadPanel } from '@/components/ui/UploadPanel'
import { ColumnMapper } from '@/components/ui/ColumnMapper'
import { NodeDetailPanel } from '@/components/ui/NodeDetailPanel'
import { CardTemplatePanel } from '@/components/ui/CardTemplatePanel'
import { EdgeTemplatePanel } from '@/components/ui/EdgeTemplatePanel'
import { FontTemplatePanel } from '@/components/ui/FontTemplatePanel'
import { SearchFilterPanel } from '@/components/ui/SearchFilterPanel'
import { RulesPanel } from '@/components/ui/RulesPanel'
import { LayoutPanel } from '@/components/ui/LayoutPanel'
import { GroupingPanel } from '@/components/ui/GroupingPanel'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { G6Graph } from '@/components/graph/G6Graph'
import { useUIStore } from '@/stores/uiStore'
import { useGraphStore } from '@/stores/graphStore'
import { useProjectIO } from '@/hooks/useProjectIO'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

/**
 * Graph view wrapper
 */
function GraphView() {
  return <G6Graph />
}

/**
 * RaptorGraph - Main Application Component
 * 100% offline, privacy-first DFIR graph analysis tool
 */
function App() {
  // Zustand stores
  const {
    darkMode,
    sidebarCollapsed,
    activePanel,
    toggleDarkMode,
    toggleSidebar,
    setActivePanel,
  } = useUIStore()

  const { nodes, edges } = useGraphStore()
  const { saveProject, handleLoadFile, clearProject } = useProjectIO()

  // Enable keyboard shortcuts
  useKeyboardShortcuts()

  const nodeCount = nodes.length
  const edgeCount = edges.length

  useEffect(() => {
    // Ensure dark mode is applied
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const handleSave = () => {
    if (nodeCount === 0) {
      toast.error('No data to save')
      return
    }
    saveProject()
  }

  const handleLoad = () => {
    handleLoadFile()
  }

  const handlePanelChange = (panelId: string) => {
    setActivePanel(activePanel === panelId ? null : panelId)
  }

  const hasData = nodeCount > 0

  return (
    <div className="h-screen w-screen bg-dark text-slate-100 flex flex-col overflow-hidden">
      {/* Toast Container */}
      <Toaster
        position="top-right"
        theme={darkMode ? 'dark' : 'light'}
        richColors
        closeButton
      />

      {/* Header */}
      <Header
        nodeCount={nodeCount}
        edgeCount={edgeCount}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onSave={handleSave}
        onLoad={handleLoad}
        onNew={clearProject}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebar}
          activePanel={activePanel}
          onPanelChange={handlePanelChange}
          hasData={hasData}
        />

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          {hasData ? (
            <GraphView />
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center max-w-2xl">
                <h2 className="text-4xl font-bold mb-4 text-slate-100">
                  Welcome to RaptorGraph
                </h2>
                <p className="text-lg text-slate-400 mb-8">
                  Transform your CSV data into beautiful, interactive network graphs—100% offline and private.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                  <div className="p-6 bg-dark-secondary rounded-lg border border-dark">
                    <div className="text-cyber-500 font-semibold mb-2 text-lg">
                      🔒 100% Offline
                    </div>
                    <p className="text-slate-400">
                      All processing happens in your browser. No data ever leaves your machine.
                    </p>
                  </div>
                  <div className="p-6 bg-dark-secondary rounded-lg border border-dark">
                    <div className="text-cyber-500 font-semibold mb-2 text-lg">
                      ⚡ High Performance
                    </div>
                    <p className="text-slate-400">
                      Canvas-powered rendering. Handle thousands of nodes with ease.
                    </p>
                  </div>
                  <div className="p-6 bg-dark-secondary rounded-lg border border-dark">
                    <div className="text-cyber-500 font-semibold mb-2 text-lg">
                      🎨 Fully Customizable
                    </div>
                    <p className="text-slate-400">
                      Conditional styling, templates, and advanced filtering built-in.
                    </p>
                  </div>
                </div>
                <div className="mt-8">
                  <button
                    onClick={() => handlePanelChange('upload')}
                    className="px-6 py-3 bg-cyber-500 hover:bg-cyber-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Upload CSV to Get Started
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Node Detail Panel (right sidebar) */}
        <NodeDetailPanel />
      </main>

      {/* Panels */}
      <UploadPanel />
      <ColumnMapper />
      <CardTemplatePanel />
      <EdgeTemplatePanel />
      <FontTemplatePanel />
      <SearchFilterPanel />
      <RulesPanel />
      <LayoutPanel />
      <GroupingPanel />

      {/* Global Loading Spinner */}
      <LoadingSpinner />
    </div>
  )
}

export default App
