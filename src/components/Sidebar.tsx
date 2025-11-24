/**
 * Sidebar Component
 * Collapsible navigation menu with hamburger
 */

import { useState } from 'react'
import { Menu, Download, Upload, Palette, Layers, Type, ArrowRightLeft, X, ChevronRight, Network } from 'lucide-react'
import { useUIStore } from '../stores/uiStore'
import { useCardTemplateStore } from '../stores/cardTemplateStore'
import { useAttributeTemplateStore } from '../stores/attributeTemplateStore'
import { useEdgeTemplateStore } from '../stores/edgeTemplateStore'
import { useStyleStore } from '../stores/styleStore'
import { useLayoutStore } from '../stores/layoutStore'

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const { openPanel } = useUIStore()
  const { exportCardTemplates, importCardTemplates } = useCardTemplateStore()
  const { exportAttributeTemplates, importAttributeTemplates } = useAttributeTemplateStore()
  const { exportEdgeTemplates, importEdgeTemplates } = useEdgeTemplateStore()
  const { getEnabledRules, importStyleRules } = useStyleStore()
  const { layoutConfig, setLayoutType } = useLayoutStore()

  const handleMenuClick = (panel: keyof typeof useUIStore.prototype) => {
    openPanel(panel as any)
    setIsOpen(false) // Close sidebar after selection
  }

  // Export all templates and style rules
  const handleExportAll = () => {
    const allData = {
      cardTemplates: exportCardTemplates(),
      attributeTemplates: exportAttributeTemplates(),
      edgeTemplates: exportEdgeTemplates(),
      styleRules: getEnabledRules(),
    }

    const dataStr = JSON.stringify(allData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `protoceratop-templates-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Import all templates and style rules
  const handleImportAll = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string)

          if (data.cardTemplates) {
            importCardTemplates(data.cardTemplates, true)
          }
          if (data.attributeTemplates) {
            importAttributeTemplates(data.attributeTemplates, true)
          }
          if (data.edgeTemplates) {
            importEdgeTemplates(data.edgeTemplates, true)
          }
          if (data.styleRules) {
            importStyleRules(data.styleRules, true)
          }

          alert('Successfully imported all templates and style rules!')
        } catch (error) {
          alert('Error importing file: ' + (error instanceof Error ? error.message : 'Invalid file format'))
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-20 left-4 z-50 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700"
        title="Menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-gray-900 shadow-2xl border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">🦖</div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Protoceratop
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Threat Hunting Visualization
                </p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {/* Data Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Data
                </div>
                <MenuItem
                  icon={<Download className="w-5 h-5" />}
                  label="Upload CSV"
                  description="Import data files"
                  color="bg-cyber-600 hover:bg-cyber-700"
                  onClick={() => handleMenuClick('uploadWizard')}
                />
              </div>

              {/* Styling Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Styling
                </div>
                <MenuItem
                  icon={<Palette className="w-5 h-5" />}
                  label="Style Rules"
                  description="Conditional formatting"
                  color="bg-purple-600 hover:bg-purple-700"
                  onClick={() => handleMenuClick('stylePanel')}
                />
              </div>

              {/* Templates Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Templates
                </div>
                <MenuItem
                  icon={<Layers className="w-5 h-5" />}
                  label="Card Templates"
                  description="Node appearance"
                  color="bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => handleMenuClick('cardTemplatePanel')}
                />
                <MenuItem
                  icon={<Type className="w-5 h-5" />}
                  label="Attribute Templates"
                  description="Text styling"
                  color="bg-pink-600 hover:bg-pink-700"
                  onClick={() => handleMenuClick('attributeTemplatePanel')}
                />
                <MenuItem
                  icon={<ArrowRightLeft className="w-5 h-5" />}
                  label="Edge Templates"
                  description="Line styling"
                  color="bg-teal-600 hover:bg-teal-700"
                  onClick={() => handleMenuClick('edgeTemplatePanel')}
                />
              </div>

              {/* Layout Section */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
                  Graph Layout
                </div>
                <div className="px-3 space-y-2">
                  <select
                    value={layoutConfig.type}
                    onChange={(e) => setLayoutType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-400"
                  >
                    <option value="force">Force Directed</option>
                    <option value="dagre">Hierarchical (Dagre)</option>
                    <option value="circular">Circular</option>
                    <option value="grid">Grid</option>
                    <option value="concentric">Concentric</option>
                    <option value="radial">Radial</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <Network className="w-3 h-3 inline mr-1" />
                    Choose how nodes are arranged
                  </p>
                </div>
              </div>
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
            <button
              onClick={handleExportAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Export All Templates & Rules
            </button>
            <button
              onClick={handleImportAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Download className="w-4 h-4" />
              Import All Templates & Rules
            </button>
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center pt-2">
              100% Client-Side • No Data Leaves Your Machine
            </div>
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}

// ============================================================================
// MENU ITEM COMPONENT
// ============================================================================

interface MenuItemProps {
  icon: React.ReactNode
  label: string
  description: string
  color: string
  onClick: () => void
}

function MenuItem({ icon, label, description, color, onClick }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
    >
      <div className={`flex-shrink-0 p-2 ${color} text-white rounded-lg transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {label}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {description}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}
