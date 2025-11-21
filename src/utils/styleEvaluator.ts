/**
 * Style Evaluator
 * Evaluates style rules against nodes and edges
 * Supports regex matching and condition operators
 */

import type { StyleRule, NodeData, EdgeData, StyleProperties } from '../types'

/**
 * Evaluate a style rule against a node
 */
export function evaluateRuleForNode(
  rule: StyleRule,
  node: NodeData
): boolean {
  if (!rule.enabled) return false
  if (rule.target === 'edges') return false

  return evaluateCondition(rule, node.attributes, node.tags)
}

/**
 * Evaluate a style rule against an edge
 */
export function evaluateRuleForEdge(
  rule: StyleRule,
  edge: EdgeData
): boolean {
  if (!rule.enabled) return false
  if (rule.target === 'nodes') return false

  // For edges, we mainly check existence and basic properties
  const attributes: Record<string, string | string[]> = {
    source: edge.source,
    target: edge.target,
    sourceAttr: edge.sourceAttr || '',
    targetAttr: edge.targetAttr || '',
    label: edge.label || '',
  }

  return evaluateCondition(rule, attributes, [])
}

/**
 * Evaluate condition based on operator
 */
function evaluateCondition(
  rule: StyleRule,
  attributes: Record<string, string | string[]>,
  _tags: string[]
): boolean {
  const { operator, attribute, value } = rule

  // Get attribute value(s)
  const attrValue = attributes[attribute]

  switch (operator) {
    case 'exists':
      return attrValue !== undefined && attrValue !== null

    case 'empty':
      return (
        attrValue === undefined ||
        attrValue === null ||
        attrValue === '' ||
        (Array.isArray(attrValue) && attrValue.length === 0)
      )

    case 'equals':
      if (!value) return false
      return matchValue(attrValue, value, (a, b) => a === b)

    case 'not_equals':
      if (!value) return false
      return !matchValue(attrValue, value, (a, b) => a === b)

    case 'contains':
      if (!value) return false
      return matchValue(attrValue, value, (a, b) =>
        a.toLowerCase().includes(b.toLowerCase())
      )

    case 'regex_match':
      if (!value) return false
      try {
        const regex = new RegExp(value, 'i')
        return matchValue(attrValue, value, (a) => regex.test(a))
      } catch {
        // Invalid regex
        return false
      }

    case 'regex_no_match':
      if (!value) return false
      try {
        const regex = new RegExp(value, 'i')
        return !matchValue(attrValue, value, (a) => regex.test(a))
      } catch {
        // Invalid regex - treat as no match
        return true
      }

    default:
      return false
  }
}

/**
 * Match a value (or array of values) against a comparison function
 */
function matchValue(
  attrValue: string | string[] | undefined | null,
  compareValue: string,
  compareFn: (a: string, b: string) => boolean
): boolean {
  if (!attrValue) return false

  if (Array.isArray(attrValue)) {
    // For arrays, return true if ANY value matches
    return attrValue.some((v) => compareFn(v, compareValue))
  }

  return compareFn(attrValue, compareValue)
}

/**
 * Compute final style for a node by applying all matching rules in order
 */
export function computeNodeStyle(
  node: NodeData,
  rules: StyleRule[]
): StyleProperties {
  const style: StyleProperties = {}

  // Rules are already sorted by order (lower = higher priority)
  // Apply rules in order, later rules override earlier ones
  for (const rule of rules) {
    if (evaluateRuleForNode(rule, node)) {
      Object.assign(style, rule.style)
    }
  }

  return style
}

/**
 * Compute final style for an edge by applying all matching rules in order
 */
export function computeEdgeStyle(
  edge: EdgeData,
  rules: StyleRule[]
): StyleProperties {
  const style: StyleProperties = {}

  for (const rule of rules) {
    if (evaluateRuleForEdge(rule, edge)) {
      Object.assign(style, rule.style)
    }
  }

  return style
}

/**
 * Validate a regex pattern
 */
export function validateRegex(pattern: string): { valid: boolean; error?: string } {
  try {
    new RegExp(pattern)
    return { valid: true }
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid regex',
    }
  }
}
