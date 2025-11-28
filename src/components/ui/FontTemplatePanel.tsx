import { useState } from 'react'
import { X, Plus, Edit, Trash2, Star, Copy } from 'lucide-react'
import { useTemplateStore } from '@/stores/templateStore'
import { useUIStore } from '@/stores/uiStore'
import { FontTemplateEditor } from './FontTemplateEditor'
import { toast } from './Toast'
import type { FontTemplate } from '@/types'

/**
 * Font template management panel
 * List, create, edit, delete font templates
 */
export function FontTemplatePanel() {
  const { activePanel, setActivePanel } = useUIStore()
  const {
    fontTemplates,
    addFontTemplate,
    updateFontTemplate,
    removeFontTemplate,
    setDefaultFontTemplate,
  } = useTemplateStore()

  const [editingTemplate, setEditingTemplate] = useState<FontTemplate | null>(null)
  const [showEditor, setShowEditor] = useState(false)

  const isOpen = activePanel === 'font-templates'

  if (!isOpen) return null

  const handleClose = () => {
    setActivePanel(null)
  }

  const handleNewTemplate = () => {
    setEditingTemplate(null)
    setShowEditor(true)
  }

  const handleEditTemplate = (template: FontTemplate) => {
    setEditingTemplate(template)
    setShowEditor(true)
  }

  const handleDuplicateTemplate = (template: FontTemplate) => {
    const newTemplate: FontTemplate = {
      ...template,
      id: `font-template-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isDefault: false,
      createdAt: Date.now(),
    }
    addFontTemplate(newTemplate)
    toast.success('Template duplicated')
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      removeFontTemplate(templateId)
      toast.success('Template deleted')
    }
  }

  const handleSetDefault = (templateId: string) => {
    setDefaultFontTemplate(templateId)
    toast.success('Default template updated')
  }

  const handleSaveTemplate = (template: FontTemplate) => {
    if (editingTemplate) {
      updateFontTemplate(template.id, template)
      toast.success('Template updated')
    } else {
      addFontTemplate(template)
      toast.success('Template created')
    }
    setShowEditor(false)
    setEditingTemplate(null)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
        <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-dark">
            <div>
              <h2 className="text-xl font-bold text-slate-100">Font Templates</h2>
              <p className="text-sm text-slate-400 mt-1">
                Style text with custom fonts and effects
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
            {fontTemplates.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400 mb-2">No templates yet</div>
                <div className="text-sm text-slate-500">
                  Create your first template to customize text styling
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fontTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="p-4 bg-dark border border-dark rounded-lg hover:border-slate-600 transition-colors"
                  >
                    {/* Template Info and Preview */}
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-100 truncate flex-1">
                          {template.name}
                        </h3>
                        {template.isDefault && (
                          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                        )}
                      </div>
                      {template.description && (
                        <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                          {template.description}
                        </p>
                      )}

                      {/* Preview */}
                      <div className="p-3 bg-dark rounded mb-2">
                        <div
                          style={{
                            fontFamily: template.fontFamily,
                            fontSize: `${template.fontSize}rem`,
                            fontWeight: template.fontWeight,
                            fontStyle: template.fontStyle,
                            color: template.color,
                            backgroundColor: template.backgroundColor || 'transparent',
                            textDecoration: template.textDecoration,
                            textTransform: template.textTransform,
                            textShadow: template.textShadow?.enabled
                              ? `${template.textShadow.offsetX}px ${template.textShadow.offsetY}px ${template.textShadow.blur}px ${template.textShadow.color}`
                              : 'none',
                            padding: template.backgroundColor ? '0.25rem 0.5rem' : '0',
                            borderRadius: template.backgroundColor ? '0.25rem' : '0',
                            display: 'inline-block',
                          }}
                        >
                          Sample Text
                        </div>
                      </div>

                      {/* Properties Summary */}
                      <div className="text-xs text-slate-500">
                        {template.fontFamily} • {template.fontSize}x • {template.fontWeight}
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
                          className="p-1.5 bg-dark-secondary hover:bg-dark text-yellow-400 rounded transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <FontTemplateEditor
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
