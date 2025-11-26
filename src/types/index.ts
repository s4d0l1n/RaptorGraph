/**
 * Core TypeScript type definitions for RaptorGraph
 * All types are strictly typed with no 'any'
 */

// ============================================================================
// NODE AND EDGE DATA MODELS
// ============================================================================

/**
 * Graph node representing an entity in the visualization
 */
export interface GraphNode {
  /** Unique identifier */
  id: string
  /** Display label */
  label: string
  /** Dynamic attributes from CSV */
  attributes: Record<string, string | string[]>
  /** Tags for categorization */
  tags: string[]
  /** Source CSV files this node came from */
  sourceFiles: string[]
  /** Whether this is a stub node (auto-created from links) */
  isStub: boolean
  /** Unix timestamp in milliseconds for timeline layout */
  timestamp?: number
  /** Applied card template ID */
  cardTemplateId?: string
  /** X position (for preset layout) */
  x?: number
  /** Y position (for preset layout) */
  y?: number
}

/**
 * Graph edge representing a connection between nodes
 */
export interface GraphEdge {
  /** Unique identifier */
  id: string
  /** Source node ID */
  source: string
  /** Target node ID */
  target: string
  /** Edge label */
  label?: string
  /** Source attribute that created this link */
  sourceAttribute?: string
  /** Target attribute that matched */
  targetAttribute?: string
  /** Applied edge template ID */
  edgeTemplateId?: string
}

/**
 * Meta-node (group) configuration
 */
export interface MetaNode {
  /** Unique identifier for the meta-node */
  id: string
  /** Display label for the group */
  label: string
  /** Attribute to group by */
  groupByAttribute: string
  /** Attribute value for this group */
  groupValue: string
  /** IDs of nodes contained in this group */
  childNodeIds: string[]
  /** IDs of meta-nodes contained in this group (for nested combinations) */
  childMetaNodeIds?: string[]
  /** Whether the group is currently collapsed */
  collapsed: boolean
  /** Layer level (0 = first layer, 1 = second layer, etc.) */
  layer: number
  /** Position (inherited from layout) */
  x?: number
  y?: number
}

/**
 * Combination layer configuration
 */
export interface CombinationLayer {
  /** Unique identifier for this layer */
  id: string
  /** Attribute to combine by */
  attribute: string
  /** Whether to auto-collapse combinations in this layer */
  autoCollapse: boolean
  /** Display order */
  order: number
}

/**
 * Grouping configuration (supports multiple layers)
 */
export interface GroupingConfig {
  /** Whether grouping is enabled */
  enabled: boolean
  /** Attribute to group by (legacy single-layer support) */
  groupByAttribute?: string
  /** Whether to auto-collapse groups on creation (legacy) */
  autoCollapse: boolean
  /** Combination layers (for multi-layer combinations) */
  layers?: CombinationLayer[]
}

// ============================================================================
// CSV IMPORT AND MAPPING
// ============================================================================

/**
 * Column role types for CSV mapping
 */
export type ColumnRole =
  | 'node_id'
  | 'attribute'
  | 'link_to'
  | 'timestamp'
  | 'ignore'

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  /** Original column name from CSV */
  columnName: string
  /** Assigned role */
  role: ColumnRole
  /** For 'attribute': custom attribute name */
  attributeName?: string
  /** For 'link_to': target attribute to match */
  linkTargetAttribute?: string
}

/**
 * Parsed CSV data with preview
 */
export interface ParsedCSV {
  /** Column headers */
  headers: string[]
  /** Parsed rows */
  rows: Record<string, string>[]
  /** Row count */
  rowCount: number
}

/**
 * CSV file with mapping configuration
 */
export interface CSVFile {
  /** Unique identifier */
  id: string
  /** Original filename */
  name: string
  /** File size in bytes */
  size: number
  /** Raw CSV content */
  rawData: string
  /** Parsed CSV data */
  parsed: ParsedCSV
  /** Column mapping configuration */
  mapping: ColumnMapping[]
  /** Upload timestamp */
  uploadedAt: number
  /** Processing status */
  processed: boolean
}

// ============================================================================
// TEMPLATES
// ============================================================================

/**
 * Node shape types
 */
export type NodeShape =
  | 'circle'
  | 'rect'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'star'
  | 'hexagon'

/**
 * Attribute display configuration in card template
 */
export interface AttributeDisplay {
  /** Attribute name (use '__id__' for node ID) */
  attributeName: string
  /** Custom display label */
  displayLabel?: string
  /** Display order */
  order: number
  /** Show this attribute */
  visible: boolean
  /** Font size override */
  fontSize?: number
  /** Color override */
  color?: string
  /** Prefix text */
  prefix?: string
  /** Suffix text */
  suffix?: string
}

/**
 * Card template for node styling
 */
export interface CardTemplate {
  /** Unique identifier */
  id: string
  /** Template name */
  name: string
  /** Description */
  description?: string
  /** Background color */
  backgroundColor: string
  /** Border color */
  borderColor: string
  /** Border width in pixels */
  borderWidth: number
  /** Node shape */
  shape: NodeShape
  /** Icon (emoji or data URL) */
  icon?: string
  /** Icon color (for SVG icons) */
  iconColor?: string
  /** Size multiplier */
  size: number
  /** Attributes to display */
  attributeDisplays: AttributeDisplay[]
  /** Is this the default template */
  isDefault: boolean
  /** Creation timestamp */
  createdAt: number
}

/**
 * Edge template for connection styling
 */
export interface EdgeTemplate {
  /** Unique identifier */
  id: string
  /** Template name */
  name: string
  /** Description */
  description?: string
  /** Line color */
  color: string
  /** Line width */
  width: number
  /** Line style */
  style: 'solid' | 'dashed' | 'dotted'
  /** Arrow type */
  arrowType: 'default' | 'triangle' | 'circle' | 'none'
  /** Label */
  label?: string
  /** Opacity (0-1) */
  opacity: number
  /** Is this the default template */
  isDefault: boolean
  /** Creation timestamp */
  createdAt: number
}

// ============================================================================
// STYLE RULES
// ============================================================================

/**
 * Condition operators for style rules
 */
export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'regex_match'
  | 'regex_not_match'
  | 'exists'
  | 'not_exists'
  | 'empty'
  | 'not_empty'

/**
 * Style rule action types
 */
export type RuleAction =
  | 'apply_card_template'
  | 'apply_edge_template'
  | 'add_tag'

/**
 * Style rule condition
 */
export interface RuleCondition {
  /** Attribute to test */
  attribute: string
  /** Condition operator */
  operator: ConditionOperator
  /** Value to compare (for operators that need it) */
  value?: string
}

/**
 * Style rule for conditional formatting
 */
export interface StyleRule {
  /** Unique identifier */
  id: string
  /** Rule name */
  name: string
  /** Enabled state */
  enabled: boolean
  /** Display order (lower = higher priority) */
  order: number
  /** Target type */
  target: 'nodes' | 'edges'
  /** Condition to match */
  condition: RuleCondition
  /** Action to perform */
  action: RuleAction
  /** Action parameters */
  actionParams: {
    templateId?: string
    tagName?: string
  }
  /** Creation timestamp */
  createdAt: number
}

// ============================================================================
// LAYOUT
// ============================================================================

/**
 * Graph layout types
 */
export type LayoutType =
  | 'force'
  | 'tree'
  | 'radial'
  | 'fcose'
  | 'dagre'
  | 'timeline'
  | 'concentric'
  | 'circle'
  | 'grid'
  | 'preset'

/**
 * Timeline layout sort options
 */
export type TimelineSortOrder = 'alphabetical' | 'count' | 'custom'

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Layout type */
  type: LayoutType
  /** Timeline swimlane attribute (for timeline layout) */
  timelineSwimlaneAttribute?: string
  /** Vertical spacing between swimlanes (timeline) */
  timelineVerticalSpacing?: number
  /** Sort order for swimlanes (timeline) */
  timelineSwimlaneSort?: TimelineSortOrder
  /** Time range filter - start timestamp (timeline) */
  timelineStartTime?: number
  /** Time range filter - end timestamp (timeline) */
  timelineEndTime?: number
  /** Custom options */
  options?: Record<string, unknown>
}

// ============================================================================
// PROJECT STATE
// ============================================================================

/**
 * Complete project state for save/load
 */
export interface ProjectState {
  /** Format version */
  version: string
  /** Project name */
  name: string
  /** Project description */
  description?: string
  /** Creation timestamp */
  createdAt: number
  /** Last modified timestamp */
  modifiedAt: number
  /** CSV files */
  csvFiles: CSVFile[]
  /** Graph nodes */
  nodes: GraphNode[]
  /** Graph edges */
  edges: GraphEdge[]
  /** Card templates */
  cardTemplates: CardTemplate[]
  /** Edge templates */
  edgeTemplates: EdgeTemplate[]
  /** Style rules */
  styleRules: StyleRule[]
  /** Layout configuration */
  layoutConfig: LayoutConfig
  /** Grouping configuration */
  groupingConfig?: GroupingConfig
  /** Meta-nodes (groups) */
  metaNodes?: MetaNode[]
}
