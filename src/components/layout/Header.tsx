import { Moon, Sun, Save, FolderOpen, FilePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  nodeCount: number
  edgeCount: number
  darkMode: boolean
  onToggleDarkMode: () => void
  onSave: () => void
  onLoad: () => void
  onNew: () => void
}

/**
 * Header component with title, stats, and controls
 */
export function Header({
  nodeCount,
  edgeCount,
  darkMode,
  onToggleDarkMode,
  onSave,
  onLoad,
  onNew,
}: HeaderProps) {
  return (
    <header className="h-16 bg-dark-secondary border-b border-dark flex items-center justify-between px-6 flex-shrink-0">
      {/* Left: Title and Stats */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-cyber-500">🦖 RaptorGraph</h1>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Privacy-First DFIR Analysis
          </span>
        </div>

      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {/* New Button */}
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-dark-tertiary hover:bg-slate-700 text-slate-300 transition-colors"
          title="New project (clear all data)"
        >
          <FilePlus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Save Button */}
        <button
          onClick={onSave}
          disabled={nodeCount === 0}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            nodeCount > 0
              ? 'bg-cyber-500 hover:bg-cyber-600 text-white'
              : 'bg-dark-tertiary text-slate-500 cursor-not-allowed'
          )}
          title="Save project"
        >
          <Save className="w-4 h-4" />
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Load Button */}
        <button
          onClick={onLoad}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-dark-tertiary hover:bg-slate-700 text-slate-300 transition-colors"
          title="Load project"
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Load</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          onClick={onToggleDarkMode}
          className="p-2 rounded-lg bg-dark-tertiary hover:bg-slate-700 text-slate-300 transition-colors"
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  )
}
