/**
 * Style Rules Panel
 * Manage conditional styling rules with regex support
 */

import { useState } from 'react'
import { X, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { useStyleStore } from '../stores/styleStore'
import { useGraphStore } from '../stores/graphStore'
import { useUIStore } from '../stores/uiStore'
import { validateRegex } from '../utils/styleEvaluator'
import type { StyleRule, StyleConditionOperator, StyleRuleTarget, NodeShape } from '../types'

const OPERATORS: { value: StyleConditionOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'not_equals', label: '≠' },
  { value: 'contains', label: 'contains' },
  { value: 'regex_match', label: '=~ regex' },
  { value: 'regex_no_match', label: '!~ regex' },
  { value: 'exists', label: 'exists' },
  { value: 'empty', label: 'empty' },
]

const SHAPES: NodeShape[] = [
  'ellipse',
  'triangle',
  'rectangle',
  'diamond',
  'pentagon',
  'hexagon',
  'octagon',
  'star',
]

export function StyleRulesPanel() {
  const { styleRules, addStyleRule, removeStyleRule, toggleStyleRule } = useStyleStore()
  const { getAllAttributeNames } = useGraphStore()
  const { closePanel } = useUIStore()
  const [showAddForm, setShowAddForm] = useState(false)

  const allAttributes = getAllAttributeNames()

  return (
    <div className="fixed inset-y-0 right-0 w-1/2 bg-white dark:bg-gray-900 shadow-2xl z-40 flex flex-col border-l border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Style Rules
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {styleRules.length} rules • {styleRules.filter((r) => r.enabled).length} enabled
          </p>
        </div>
        <button
          onClick={() => closePanel('stylePanel')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {styleRules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                No style rules yet. Create your first rule!
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-cyber-600 hover:bg-cyber-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Style Rule
              </button>
            </div>
          ) : (
            <>
              {styleRules.map((rule) => (
                <StyleRuleCard
                  key={rule.id}
                  rule={rule}
                  attributes={allAttributes}
                  onToggle={() => toggleStyleRule(rule.id)}
                  onDelete={() => removeStyleRule(rule.id)}
                />
              ))}
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-cyber-500 dark:hover:border-cyber-500 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-cyber-600 dark:hover:text-cyber-400"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Style Rule
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <StyleRuleForm
          attributes={allAttributes}
          onClose={() => setShowAddForm(false)}
          onAdd={(rule) => {
            addStyleRule(rule)
            setShowAddForm(false)
          }}
        />
      )}
    </div>
  )
}

interface StyleRuleCardProps {
  rule: StyleRule
  attributes: string[]
  onToggle: () => void
  onDelete: () => void
}

function StyleRuleCard({ rule, onToggle, onDelete }: StyleRuleCardProps) {
  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          >
            {rule.enabled ? (
              <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <EyeOff className="w-5 h-5 text-gray-400" />
            )}
          </button>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {rule.name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {rule.target} • Order: {rule.order}
            </p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">Condition:</span>
          <p className="font-mono text-xs mt-1">
            {rule.attribute} {OPERATORS.find((o) => o.value === rule.operator)?.label}{' '}
            {rule.value && `"${rule.value}"`}
          </p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400">Styles:</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {rule.style.backgroundColor && (
              <span
                className="px-2 py-0.5 rounded text-xs"
                style={{ backgroundColor: rule.style.backgroundColor, color: '#fff' }}
              >
                color
              </span>
            )}
            {rule.style.shape && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                {rule.style.shape}
              </span>
            )}
            {rule.style.size && (
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                size: {rule.style.size}x
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StyleRuleFormProps {
  attributes: string[]
  onClose: () => void
  onAdd: (rule: StyleRule) => void
}

function StyleRuleForm({ attributes, onClose, onAdd }: StyleRuleFormProps) {
  const [name, setName] = useState('')
  const [attribute, setAttribute] = useState(attributes[0] || '')
  const [operator, setOperator] = useState<StyleConditionOperator>('equals')
  const [value, setValue] = useState('')
  const [target, setTarget] = useState<StyleRuleTarget>('nodes')
  const [backgroundColor, setBackgroundColor] = useState('#0ea5e9')
  const [borderColor, setBorderColor] = useState('')
  const [shape, setShape] = useState<NodeShape>('ellipse')
  const [size, setSize] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const needsValue = !['exists', 'empty'].includes(operator)

  const handleAdd = () => {
    // Validate
    if (!name.trim()) {
      setError('Please enter a rule name')
      return
    }
    if (!attribute) {
      setError('Please select an attribute')
      return
    }
    if (needsValue && !value.trim()) {
      setError('Please enter a value')
      return
    }

    // Validate regex
    if ((operator === 'regex_match' || operator === 'regex_no_match') && value) {
      const validation = validateRegex(value)
      if (!validation.valid) {
        setError(`Invalid regex: ${validation.error}`)
        return
      }
    }

    const newRule: StyleRule = {
      id: `rule-${Date.now()}`,
      name: name.trim(),
      enabled: true,
      attribute,
      operator,
      value: needsValue ? value : undefined,
      target,
      style: {
        backgroundColor: backgroundColor || undefined,
        borderColor: borderColor || undefined,
        shape: target === 'nodes' ? shape : undefined,
        size: size !== 1 ? size : undefined,
      },
      order: Date.now(),
    }

    onAdd(newRule)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Add Style Rule</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Highlight DNS servers"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Target</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as StyleRuleTarget)}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
            >
              <option value="nodes">Nodes</option>
              <option value="edges">Edges</option>
              <option value="both">Both</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Attribute</label>
              <select
                value={attribute}
                onChange={(e) => setAttribute(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
              >
                {attributes.map((attr) => (
                  <option key={attr} value={attr}>
                    {attr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Operator</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value as StyleConditionOperator)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsValue && (
            <div>
              <label className="block text-sm font-medium mb-1">
                Value {(operator === 'regex_match' || operator === 'regex_no_match') && '(regex pattern)'}
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={operator.includes('regex') ? '^(8\\.8\\.|1\\.1\\.1\\.)' : 'value to match'}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 font-mono text-sm"
              />
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="font-medium mb-3">Styles to Apply</h4>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Background Color</label>
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-full h-10 rounded border border-gray-300 dark:border-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-1">Border Color</label>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    className="w-full h-10 rounded border border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>

              {target === 'nodes' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1">Shape</label>
                    <select
                      value={shape}
                      onChange={(e) => setShape(e.target.value as NodeShape)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                    >
                      {SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1">Size (multiplier)</label>
                    <input
                      type="number"
                      min="0.5"
                      max="3"
                      step="0.1"
                      value={size}
                      onChange={(e) => setSize(parseFloat(e.target.value))}
                      className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-cyber-600 hover:bg-cyber-700 text-white rounded transition-colors"
            >
              Add Rule
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
