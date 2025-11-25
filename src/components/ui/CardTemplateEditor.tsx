import { useState, useMemo } from 'react'
import { X, Plus, Trash2, GripVertical, Image as ImageIcon, Smile, ChevronDown, ChevronRight } from 'lucide-react'
import { useGraphStore } from '@/stores/graphStore'
import type { CardTemplate, AttributeDisplay, NodeShape } from '@/types'

interface CardTemplateEditorProps {
  /** Template being edited (null for new) */
  template: CardTemplate | null
  /** Close editor */
  onClose: () => void
  /** Save callback */
  onSave: (template: CardTemplate) => void
}

const NODE_SHAPES: NodeShape[] = [
  'circle',
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'star',
  'hexagon',
]

const EMOJI_PRESETS = [
  '🔍', '🔐', '🔗', '💻', '📊', '🌐', '⚡', '🔥',
  '📁', '📄', '👤', '🏢', '🗂️', '🎯', '⚠️', '✅',
  '❌', '🚀', '🔧', '⚙️', '📡', '🖥️', '💾', '🗄️',
]

/**
 * Card template editor component
 * CRUD interface for creating/editing card templates
 */
export function CardTemplateEditor({ template, onClose, onSave }: CardTemplateEditorProps) {
  const { nodes } = useGraphStore()

  // Extract all unique attribute names from nodes
  const availableAttributes = useMemo(() => {
    const attrSet = new Set<string>()
    attrSet.add('__id__') // Special built-in attribute
    nodes.forEach((node) => {
      Object.keys(node.attributes).forEach((key) => attrSet.add(key))
    })
    return Array.from(attrSet).sort()
  }, [nodes])

  // Form state
  const [name, setName] = useState(template?.name || '')
  const [description, setDescription] = useState(template?.description || '')
  const [backgroundColor, setBackgroundColor] = useState(template?.backgroundColor || '#1e293b')
  const [borderColor, setBorderColor] = useState(template?.borderColor || '#06b6d4')
  const [borderWidth, setBorderWidth] = useState(template?.borderWidth || 2)
  const [shape, setShape] = useState<NodeShape>(template?.shape || 'rect')
  const [icon, setIcon] = useState(template?.icon || '📊')
  const [iconColor, setIconColor] = useState(template?.iconColor || '#06b6d4')
  const [size, setSize] = useState(template?.size || 1)
  const [attributeDisplays, setAttributeDisplays] = useState<AttributeDisplay[]>(
    template?.attributeDisplays || [
      {
        attributeName: '__id__',
        displayLabel: 'ID',
        order: 0,
        visible: true,
      },
    ]
  )

  // Icon picker state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  // Track which attributes have expanded styling options
  const [expandedAttributes, setExpandedAttributes] = useState<Set<number>>(new Set())

  const toggleAttributeExpanded = (index: number) => {
    const newExpanded = new Set(expandedAttributes)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedAttributes(newExpanded)
  }

  const handleSave = () => {
    if (!name.trim()) {
      return
    }

    const newTemplate: CardTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      backgroundColor,
      borderColor,
      borderWidth,
      shape,
      icon,
      iconColor,
      size,
      attributeDisplays,
      isDefault: template?.isDefault || false,
      createdAt: template?.createdAt || Date.now(),
    }

    onSave(newTemplate)
  }

  const handleAddAttribute = () => {
    if (availableAttributes.length === 0) return

    const unusedAttrs = availableAttributes.filter(
      (attr) => !attributeDisplays.some((d) => d.attributeName === attr)
    )

    if (unusedAttrs.length === 0) return

    const newDisplay: AttributeDisplay = {
      attributeName: unusedAttrs[0],
      displayLabel: unusedAttrs[0],
      order: attributeDisplays.length,
      visible: true,
    }

    setAttributeDisplays([...attributeDisplays, newDisplay])
  }

  const handleRemoveAttribute = (index: number) => {
    setAttributeDisplays(attributeDisplays.filter((_, i) => i !== index))
  }

  const handleUpdateAttribute = (index: number, updates: Partial<AttributeDisplay>) => {
    setAttributeDisplays(
      attributeDisplays.map((attr, i) => (i === index ? { ...attr, ...updates } : attr))
    )
  }

  const handleMoveAttribute = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === attributeDisplays.length - 1) return

    const newDisplays = [...attributeDisplays]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newDisplays[index], newDisplays[targetIndex]] = [
      newDisplays[targetIndex],
      newDisplays[index],
    ]

    // Update order values
    newDisplays.forEach((display, i) => {
      display.order = i
    })

    setAttributeDisplays(newDisplays)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataURL = event.target?.result as string
      setIcon(dataURL)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-secondary border border-dark rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark">
          <h2 className="text-xl font-bold text-slate-100">
            {template ? 'Edit Card Template' : 'New Card Template'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-dark rounded transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Basic Info */}
          <section>
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Basic Information</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  placeholder="e.g., Server Template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  placeholder="Optional description"
                />
              </div>
            </div>
          </section>

          {/* Visual Style */}
          <section>
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Visual Style</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Border Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Border Width (px)
                </label>
                <input
                  type="number"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  min={0}
                  max={10}
                  className="w-full px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Size Multiplier
                </label>
                <input
                  type="number"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  min={0.5}
                  max={3}
                  step={0.1}
                  className="w-full px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                />
              </div>
            </div>

            {/* Shape Selector */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">Shape</label>
              <div className="grid grid-cols-7 gap-2">
                {NODE_SHAPES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setShape(s)}
                    className={`px-3 py-2 rounded border transition-colors ${
                      shape === s
                        ? 'bg-cyber-500 border-cyber-500 text-white'
                        : 'bg-dark border-dark text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Icon */}
          <section>
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Icon</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{icon.startsWith('data:') ? '🖼️' : icon}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-3 py-2 bg-dark border border-dark rounded text-slate-300 hover:bg-dark-secondary transition-colors flex items-center gap-2"
                  >
                    <Smile className="w-4 h-4" />
                    Emoji
                  </button>
                  <label className="px-3 py-2 bg-dark border border-dark rounded text-slate-300 hover:bg-dark-secondary transition-colors flex items-center gap-2 cursor-pointer">
                    <ImageIcon className="w-4 h-4" />
                    Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="p-3 bg-dark border border-dark rounded">
                  <div className="grid grid-cols-8 gap-2">
                    {EMOJI_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setIcon(emoji)
                          setShowEmojiPicker(false)
                        }}
                        className="text-2xl p-2 hover:bg-dark-secondary rounded transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Icon Color (for SVG) */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Icon Color (for SVG icons)
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={iconColor}
                    onChange={(e) => setIconColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-dark border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Attribute Display Configuration */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-100">Attribute Display</h3>
              <button
                onClick={handleAddAttribute}
                disabled={
                  availableAttributes.length === 0 ||
                  attributeDisplays.length >= availableAttributes.length
                }
                className="px-3 py-1 bg-cyber-500 hover:bg-cyber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Attribute
              </button>
            </div>

            <div className="space-y-2">
              {attributeDisplays.map((attr, index) => (
                <div
                  key={index}
                  className="bg-dark border border-dark rounded overflow-hidden"
                >
                  {/* Main Row */}
                  <div className="p-3 flex items-center gap-3">
                    {/* Drag Handle */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => handleMoveAttribute(index, 'up')}
                        disabled={index === 0}
                        className="p-1 hover:bg-dark-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="w-4 h-4 rotate-90" />
                      </button>
                      <button
                        onClick={() => handleMoveAttribute(index, 'down')}
                        disabled={index === attributeDisplays.length - 1}
                        className="p-1 hover:bg-dark-secondary rounded disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <GripVertical className="w-4 h-4 -rotate-90" />
                      </button>
                    </div>

                    {/* Visible Toggle */}
                    <input
                      type="checkbox"
                      checked={attr.visible}
                      onChange={(e) =>
                        handleUpdateAttribute(index, { visible: e.target.checked })
                      }
                      className="w-4 h-4 cursor-pointer"
                    />

                    {/* Attribute Select */}
                    <select
                      value={attr.attributeName}
                      onChange={(e) =>
                        handleUpdateAttribute(index, { attributeName: e.target.value })
                      }
                      className="px-3 py-1 bg-dark-secondary border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                    >
                      {availableAttributes.map((attrName) => (
                        <option key={attrName} value={attrName}>
                          {attrName}
                        </option>
                      ))}
                    </select>

                    {/* Display Label */}
                    <input
                      type="text"
                      value={attr.displayLabel || ''}
                      onChange={(e) =>
                        handleUpdateAttribute(index, { displayLabel: e.target.value })
                      }
                      placeholder="Display label"
                      className="flex-1 px-3 py-1 bg-dark-secondary border border-dark rounded text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyber-500"
                    />

                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleAttributeExpanded(index)}
                      className="p-1 hover:bg-dark-secondary rounded transition-colors text-slate-400"
                      title="Advanced styling"
                    >
                      {expandedAttributes.has(index) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveAttribute(index)}
                      className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Advanced Styling Options */}
                  {expandedAttributes.has(index) && (
                    <div className="px-3 pb-3 pt-0 bg-dark-secondary/30 border-t border-dark space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Font Size */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Font Size (px)
                          </label>
                          <input
                            type="number"
                            min="8"
                            max="24"
                            value={attr.fontSize || ''}
                            onChange={(e) =>
                              handleUpdateAttribute(index, {
                                fontSize: e.target.value ? parseInt(e.target.value) : undefined,
                              })
                            }
                            placeholder="Default"
                            className="w-full px-2 py-1 bg-dark border border-dark-tertiary rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-500"
                          />
                        </div>

                        {/* Color */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Color
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="color"
                              value={attr.color || '#e2e8f0'}
                              onChange={(e) =>
                                handleUpdateAttribute(index, { color: e.target.value })
                              }
                              className="w-10 h-8 rounded cursor-pointer border border-dark-tertiary"
                            />
                            <input
                              type="text"
                              value={attr.color || ''}
                              onChange={(e) =>
                                handleUpdateAttribute(index, { color: e.target.value })
                              }
                              placeholder="Default"
                              className="flex-1 px-2 py-1 bg-dark border border-dark-tertiary rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-500"
                            />
                          </div>
                        </div>

                        {/* Prefix */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Prefix
                          </label>
                          <input
                            type="text"
                            value={attr.prefix || ''}
                            onChange={(e) =>
                              handleUpdateAttribute(index, { prefix: e.target.value })
                            }
                            placeholder="e.g., 🔍"
                            className="w-full px-2 py-1 bg-dark border border-dark-tertiary rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-500"
                          />
                        </div>

                        {/* Suffix */}
                        <div>
                          <label className="block text-xs text-slate-400 mb-1">
                            Suffix
                          </label>
                          <input
                            type="text"
                            value={attr.suffix || ''}
                            onChange={(e) =>
                              handleUpdateAttribute(index, { suffix: e.target.value })
                            }
                            placeholder="e.g., ✓"
                            className="w-full px-2 py-1 bg-dark border border-dark-tertiary rounded text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyber-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-dark">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark hover:bg-dark-secondary text-slate-300 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 bg-cyber-500 hover:bg-cyber-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Save Template
          </button>
        </div>
      </div>
    </div>
  )
}
