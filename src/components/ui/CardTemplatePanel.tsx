import { useState } from 'react'
import { X, Plus, Edit, Trash2, Star, Copy } from 'lucide-react'
import { useTemplateStore } from '@/stores/templateStore'
import { useGraphStore } from '@/stores/graphStore'
import { useUIStore } from '@/stores/uiStore'
import { CardTemplateEditor } from './CardTemplateEditor'
import { toast } from './Toast'
import type { CardTemplate } from '@/types'

/**
 * Card template management panel
 * List view with CRUD operations
 */
export function CardTemplatePanel() {
  const { activePanel, setActivePanel, selectedNodeId } = useUIStore()
  const {
    cardTemplates,
    addCardTemplate,
    updateCardTemplate,
    removeCardTemplate,
    setDefaultCardTemplate,
  } = useTemplateStore()
  const { nodes } = useGraphStore()

  const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const isOpen = activePanel === 'templates'

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  const handleNewTemplate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEditTemplate = (template: CardTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleDuplicateTemplate = (template: CardTemplate) => {
    const newTemplate: CardTemplate = {
      ...template,
      id: `template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
    }
    addCardTemplate(newTemplate)
    toast.success('Template duplicated')
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      removeCardTemplate(templateId)
      toast.success('Template deleted')
    }
  }

  const handleSetDefault = (templateId: string) => {
    setDefaultCardTemplate(templateId)
    toast.success('Default template updated')
  }

  const handleSaveTemplate = (template: CardTemplate) => {
    if (editingTemplate) {
      updateCardTemplate(template.id, template)
      toast.success('Template updated')
    } else {
      addCardTemplate(template)
      toast.success('Template created')
    }
    setShowEditor(false)
    setEditingTemplate(null)
  }

  const handleApplyToSelected = (template: CardTemplate) => {
    if (!selectedNodeId) {
      toast.error('No node selected')
      return
    }

    // Store the template ID in node metadata
    // This will be used by the graph renderer to apply the template
    const selectedNode = nodes.find((n) => n.id === selectedNodeId)
    if (!selectedNode) {
      toast.error('Selected node not found')
      return
    }

    // Add templateId to node attributes
    selectedNode.attributes.__templateId = template.id

    toast.success(`Template applied to ${selectedNode.label}`)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
        <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Card Templates</h2>
              <p className="text-sm text-slate-400 mt-1">
                Create and manage visual styles for your nodes
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
            {/* New Template Button */}
            <button
              onClick={handleNewTemplate}
              className="w-full p-4 bg-dark hover:bg-dark-secondary border-2 border-dashed border-dark hover:border-cyber-500 rounded-lg transition-colors flex items-center justify-center gap-2 text-slate-400 hover:text-cyber-500 mb-4"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Create New Template</span>
            </button>

            {/* Template List */}
            {cardTemplates.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-2">No templates yet</div>
                <div className="text-sm text-slate-500">
                  Create your first template to customize node appearance
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cardTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-dark border border-dark rounded-lg hover:border-slate-600 transition-colors"
                  >
                    {/* Template Preview */}
                    <div className="flex items-start gap-4 mb-3">
                      <div
                        className="w-16 h-16 rounded flex items-center justify-center text-2xl"
                        style={{
                          backgroundColor: template.backgroundColor,
                          borderColor: template.borderColor,
                          borderWidth: `${template.borderWidth}px`,
                          borderStyle: 'solid',
                        }}
                      >
                        {template.icon?.startsWith('data:') ? '🖼️' : template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-100 truncate">
                            {template.name}
                          </h3>
                          {template.isDefault && (
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-slate-400 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        <div className="text-xs text-slate-500 mt-1">
                          Shape: {template.shape} • Size: {template.size}x •{' '}
                          {template.attributeDisplays.filter((a) => a.visible).length} attributes
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="flex-1 px-3 py-1.5 bg-dark-secondary hover:bg-dark text-slate-300 rounded text-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicateTemplate(template)}
                        className="flex-1 px-3 py-1.5 bg-dark-secondary hover:bg-dark text-slate-300 rounded text-sm transition-colors flex items-center justify-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                      {!template.isDefault && (
                        <button
                          onClick={() => handleSetDefault(template.id)}
                          className="px-3 py-1.5 bg-dark-secondary hover:bg-dark text-slate-300 rounded text-sm transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="px-3 py-1.5 bg-dark-secondary hover:bg-red-500/20 text-red-400 rounded text-sm transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Apply to Selected Node */}
                    {selectedNodeId && (
                      <button
                        onClick={() => handleApplyToSelected(template)}
                        className="w-full mt-2 px-3 py-1.5 bg-cyber-500 hover:bg-cyber-600 text-white rounded text-sm transition-colors"
                      >
                        Apply to Selected Node
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-dark bg-dark">
            <div className="text-sm text-slate-400">
              <span className="font-medium">{cardTemplates.length}</span> template
              {cardTemplates.length !== 1 ? 's' : ''} •{' '}
              {selectedNodeId ? 'Select a template to apply' : 'Select a node to apply templates'}
            </div>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <CardTemplateEditor
          template={editingTemplate}
          onClose={() => {
            setShowEditor(false)
            setEditingTemplate(null)
          }}
          onSave={handleSaveTemplate}
        />
      )}
    </>
  )
}
