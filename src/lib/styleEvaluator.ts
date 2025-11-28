/**
 * Style evaluator for applying conditional styling rules to nodes and edges
 */

import type { StyleRule, RuleCondition, GraphNode, GraphEdge, ConditionOperator, FontTemplateScope } from '@/types'

/**
 * Result of evaluating a condition, including which values matched
 */
interface ConditionEvaluationResult {
  /** Whether the condition matched */
  matches: boolean
  /** The attribute that was tested */
  attribute: string
  /** For multi-value attributes, which specific values matched */
  matchingValues?: string[]
}

/**
 * Evaluate a single condition against a node or edge
 * Returns detailed information about what matched
 */
function evaluateConditionDetailed(
  condition: RuleCondition,
  attributes: Record<string, string | string[]>
): ConditionEvaluationResult {
  const { attribute, operator, value } = condition
  const attrValue = attributes[attribute]

  const result: ConditionEvaluationResult = {
    matches: false,
    attribute,
  }

  // Handle attribute existence operators
  if (operator === 'exists') {
    result.matches = attrValue !== undefined
    return result
  }
  if (operator === 'not_exists') {
    result.matches = attrValue === undefined
    return result
  }

  // If attribute doesn't exist, fail all other operators
  if (attrValue === undefined) {
    return result
  }

  // Handle empty/not_empty operators
  if (operator === 'empty') {
    if (Array.isArray(attrValue)) {
      result.matches = attrValue.length === 0
    } else {
      result.matches = String(attrValue).trim() === ''
    }
    return result
  }
  if (operator === 'not_empty') {
    if (Array.isArray(attrValue)) {
      result.matches = attrValue.length > 0
    } else {
      result.matches = String(attrValue).trim() !== ''
    }
    return result
  }

  // Get original values (preserve case) and lowercase versions for comparison
  const originalValues = Array.isArray(attrValue) ? attrValue : [attrValue]
  const attrValueStr = originalValues.map((v) => String(v).toLowerCase())
  const compareValue = value ? String(value).toLowerCase() : ''
  const matchingIndices: number[] = []

  // Evaluate operator and track which values matched
  switch (operator) {
    case 'equals':
      attrValueStr.forEach((v, i) => {
        if (v === compareValue) matchingIndices.push(i)
      })
      result.matches = matchingIndices.length > 0
      break

    case 'not_equals':
      attrValueStr.forEach((v, i) => {
        if (v !== compareValue) matchingIndices.push(i)
      })
      result.matches = matchingIndices.length > 0
      break

    case 'contains':
      attrValueStr.forEach((v, i) => {
        if (v.includes(compareValue)) matchingIndices.push(i)
      })
      result.matches = matchingIndices.length > 0
      break

    case 'not_contains':
      attrValueStr.forEach((v, i) => {
        if (!v.includes(compareValue)) matchingIndices.push(i)
      })
      result.matches = matchingIndices.length > 0
      break

    case 'regex_match':
      try {
        const regex = new RegExp(compareValue, 'i')
        attrValueStr.forEach((v, i) => {
          if (regex.test(v)) matchingIndices.push(i)
        })
        result.matches = matchingIndices.length > 0
      } catch {
        result.matches = false
      }
      break

    case 'regex_not_match':
      try {
        const regex = new RegExp(compareValue, 'i')
        attrValueStr.forEach((v, i) => {
          if (!regex.test(v)) matchingIndices.push(i)
        })
        result.matches = matchingIndices.length > 0
      } catch {
        result.matches = false
      }
      break

    default:
      result.matches = false
  }

  // Store the original matching values (preserve case)
  if (matchingIndices.length > 0) {
    result.matchingValues = matchingIndices.map((i) => String(originalValues[i]))
  }

  return result
}

/**
 * Simple boolean evaluation (backward compatibility)
 */
function evaluateCondition(
  condition: RuleCondition,
  attributes: Record<string, string | string[]>
): boolean {
  return evaluateConditionDetailed(condition, attributes).matches
}

/**
 * Font template application with scope information
 */
export interface FontTemplateApplication {
  /** Template ID to apply */
  templateId: string
  /** Scope of application */
  scope: FontTemplateScope
  /** Attribute name (for 'attribute' and 'value' scopes) */
  attribute?: string
  /** Specific values to style (for 'value' scope) */
  values?: string[]
}

/**
 * Apply style rules to a node
 * Returns the IDs of templates/tags to apply with granular scoping
 */
export function evaluateNodeRules(
  node: GraphNode,
  rules: StyleRule[]
): {
  cardTemplateId?: string
  fontTemplates: FontTemplateApplication[]
  additionalTags: string[]
} {
  const result: {
    cardTemplateId?: string
    fontTemplates: FontTemplateApplication[]
    additionalTags: string[]
  } = {
    fontTemplates: [],
    additionalTags: [],
  }

  // Rules are already sorted by order (lower = higher priority)
  // We process them in order and first match wins for templates
  for (const rule of rules) {
    if (!rule.enabled || rule.target !== 'nodes') {
      continue
    }

    // Evaluate condition with detailed results
    const evaluation = evaluateConditionDetailed(rule.condition, node.attributes)

    if (evaluation.matches) {
      // Apply action
      if (rule.action === 'apply_card_template' && rule.actionParams.templateId) {
        // First matching template wins
        if (!result.cardTemplateId) {
          result.cardTemplateId = rule.actionParams.templateId
        }
      } else if (rule.action === 'apply_font_template' && rule.actionParams.templateId) {
        // Determine scope (default to 'attribute' for backward compatibility)
        const scope = rule.actionParams.fontTemplateScope || 'attribute'

        const application: FontTemplateApplication = {
          templateId: rule.actionParams.templateId,
          scope,
        }

        // Add attribute and value information based on scope
        if (scope === 'attribute' || scope === 'value') {
          application.attribute = evaluation.attribute
        }
        if (scope === 'value' && evaluation.matchingValues) {
          application.values = evaluation.matchingValues
        }

        result.fontTemplates.push(application)
      } else if (rule.action === 'add_tag' && rule.actionParams.tagName) {
        result.additionalTags.push(rule.actionParams.tagName)
      }
    }
  }

  return result
}

/**
 * Apply style rules to an edge
 * Returns the ID of template to apply
 */
export function evaluateEdgeRules(
  edge: GraphEdge,
  rules: StyleRule[]
): {
  edgeTemplateId?: string
} {
  const result: {
    edgeTemplateId?: string
  } = {}

  // Rules are already sorted by order (lower = higher priority)
  // We process them in order and first match wins
  for (const rule of rules) {
    if (!rule.enabled || rule.target !== 'edges') {
      continue
    }

    // Edges don't have attributes in current schema, but we prepare for future
    const edgeAttrs: Record<string, string | string[]> = {
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
    }

    // Evaluate condition
    if (evaluateCondition(rule.condition, edgeAttrs)) {
      // Apply action
      if (rule.action === 'apply_edge_template' && rule.actionParams.templateId) {
        // First matching template wins
        if (!result.edgeTemplateId) {
          result.edgeTemplateId = rule.actionParams.templateId
        }
      }
    }
  }

  return result
}

/**
 * Get all available condition operators
 */
export function getConditionOperators(): Array<{
  value: ConditionOperator
  label: string
  requiresValue: boolean
}> {
  return [
    { value: 'equals', label: 'Equals', requiresValue: true },
    { value: 'not_equals', label: 'Not Equals', requiresValue: true },
    { value: 'contains', label: 'Contains', requiresValue: true },
    { value: 'not_contains', label: 'Not Contains', requiresValue: true },
    { value: 'regex_match', label: 'Regex Match', requiresValue: true },
    { value: 'regex_not_match', label: 'Regex Not Match', requiresValue: true },
    { value: 'exists', label: 'Exists', requiresValue: false },
    { value: 'not_exists', label: 'Not Exists', requiresValue: false },
    { value: 'empty', label: 'Is Empty', requiresValue: false },
    { value: 'not_empty', label: 'Is Not Empty', requiresValue: false },
  ]
}
