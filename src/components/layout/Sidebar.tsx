import {
  ChevronLeft,
  ChevronRight,
  Upload,
  Layers,
  Palette,
  Search,
  Grid3x3,
  Settings,
  ArrowRightLeft,
  Layers2,
  Type,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarItem {
  id: string
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  activePanel: string | null
  onPanelChange: (panelId: string) => void
  hasData: boolean
}

/**
 * Collapsible sidebar with navigation icons
 */
export function Sidebar({
  collapsed,
  onToggleCollapse,
  activePanel,
  onPanelChange,
  hasData,
}: SidebarProps) {
  const sidebarItems: SidebarItem[] = [
    {
      id: 'upload',
      icon: <Upload className="w-5 h-5" />,
      label: 'Upload CSV',
      onClick: () => onPanelChange('upload'),
    },
    {
      id: 'templates',
      icon: <Layers className="w-5 h-5" />,
      label: 'Card Templates',
      onClick: () => onPanelChange('templates'),
      disabled: !hasData,
    },
    {
      id: 'edge-templates',
      icon: <ArrowRightLeft className="w-5 h-5" />,
      label: 'Edge Templates',
      onClick: () => onPanelChange('edge-templates'),
      disabled: !hasData,
    },
    {
      id: 'font-templates',
      icon: <Type className="w-5 h-5" />,
      label: 'Font Templates',
      onClick: () => onPanelChange('font-templates'),
      disabled: !hasData,
    },
    {
      id: 'styles',
      icon: <Palette className="w-5 h-5" />,
      label: 'Style Rules',
      onClick: () => onPanelChange('styles'),
      disabled: !hasData,
    },
    {
      id: 'search',
      icon: <Search className="w-5 h-5" />,
      label: 'Search & Filter',
      onClick: () => onPanelChange('search'),
      disabled: !hasData,
    },
    {
      id: 'layout',
      icon: <Grid3x3 className="w-5 h-5" />,
      label: 'Layout',
      onClick: () => onPanelChange('layout'),
      disabled: !hasData,
    },
    {
      id: 'grouping',
      icon: <Layers2 className="w-5 h-5" />,
      label: 'Grouping',
      onClick: () => onPanelChange('grouping'),
      disabled: !hasData,
    },
    {
      id: 'settings',
      icon: <Settings className="w-5 h-5" />,
      label: 'Settings',
      onClick: () => onPanelChange('settings'),
    },
  ]

  return (
    <aside
      className={cn(
        'bg-dark-secondary border-r border-dark flex-shrink-0 transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 w-6 h-6 bg-dark-tertiary border border-dark rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors z-10"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Navigation Items */}
      <nav className="p-3 space-y-1">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            disabled={item.disabled}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left',
              item.disabled
                ? 'text-slate-600 cursor-not-allowed'
                : activePanel === item.id
                ? 'bg-cyber-500/20 text-cyber-400'
                : 'text-slate-400 hover:bg-dark-tertiary hover:text-slate-200'
            )}
            title={collapsed ? item.label : undefined}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            {!collapsed && (
              <span className="text-sm font-medium truncate">{item.label}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer - Version */}
      {!collapsed && (
        <div className="absolute bottom-4 left-3 right-3 text-xs text-slate-600 text-center border-t border-dark pt-3">
          <p>RaptorGraph v1.2.6</p>
          <p className="mt-1">100% Offline</p>
        </div>
      )}
    </aside>
  )
}
