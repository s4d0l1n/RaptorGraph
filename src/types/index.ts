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
  /** Transparent shape (only show icon/image) */
  transparentShape?: boolean
  /** Icon (emoji or data URL) */
  icon?: string
  /** Icon color (for SVG icons) */
  iconColor?: string
  /** Show icon (if false, icon is hidden) */
  showIcon?: boolean
  /** Icon size multiplier */
  iconSize?: number
  /** Size multiplier */
  size: number
  /** Auto-fit size to content (prevents label overflow) */
  autoFit?: boolean
  /** Attributes to display */
  attributeDisplays: AttributeDisplay[]
  /** Is this the default template */
  isDefault: boolean
  /** Creation timestamp */
  createdAt: number
  /** Visual effects */
  effects?: {
    /** Shadow effect */
    shadow?: {
      enabled: boolean
      color: string
      blur: number
      offsetX: number
      offsetY: number
    }
    /** Glow effect */
    glow?: {
      enabled: boolean
      color: string
      blur: number
      intensity: number
    }
    /** Pulse animation */
    pulse?: {
      enabled: boolean
      speed: number // 0.5 = slow, 1 = normal, 2 = fast
    }
    /** RGB color cycle animation */
    rgbCycle?: {
      enabled: boolean
      speed: number
      target: 'border' | 'glow' | 'both'
    }
  }
}

/**
 * Edge line type (how the edge is drawn)
 */
export type EdgeLineType = 'straight' | 'curved' | 'orthogonal'

/**
 * Arrow position on edge
 */
export type ArrowPosition = 'none' | 'end' | 'start' | 'both'

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
  /** Line type (straight, curved, orthogonal) */
  lineType: EdgeLineType
  /** Arrow type */
  arrowType: 'default' | 'triangle' | 'circle' | 'none'
  /** Arrow position (start, end, both, none) */
  arrowPosition: ArrowPosition
  /** Label */
  label?: string
  /** Opacity (0-1) */
  opacity: number
  /** Is this the default template */
  isDefault: boolean
  /** Creation timestamp */
  createdAt: number
}

/**
 * Font/text template for text styling
 */
export interface FontTemplate {
  /** Unique identifier */
  id: string
  /** Template name */
  name: string
  /** Description */
  description?: string
  /** Font family */
  fontFamily: string
  /** Font size (multiplier) */
  fontSize: number
  /** Font weight */
  fontWeight: 'normal' | 'bold' | 'lighter' | 'bolder'
  /** Font style */
  fontStyle: 'normal' | 'italic' | 'oblique'
  /** Text color */
  color: string
  /** Background color (highlight) */
  backgroundColor?: string
  /** Text decoration */
  textDecoration: 'none' | 'underline' | 'line-through' | 'overline'
  /** Text transform */
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  /** Text shadow */
  textShadow?: {
    enabled: boolean
    color: string
    blur: number
    offsetX: number
    offsetY: number
  }
  /** Text effects */
  effects?: {
    /** Glow effect */
    glow?: {
      enabled: boolean
      color: string
      intensity: number
    }
    /** Gradient text */
    gradient?: {
      enabled: boolean
      startColor: string
      endColor: string
      direction: 'horizontal' | 'vertical'
    }
  }
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
  | 'apply_font_template'
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
 * Scope for font template application
 */
export type FontTemplateScope =
  | 'node'           // Apply to all content in node detail
  | 'attribute'      // Apply only to the matched attribute
  | 'value'          // Apply only to the matched value(s) within attribute

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
    /** Scope for font template application (only used with apply_font_template) */
    fontTemplateScope?: FontTemplateScope
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
  | 'force'          // Force-directed physics simulation
  | 'hierarchical'   // Hierarchical tree layout (formerly 'tree')
  | 'radial'         // Radial layout from center
  | 'fcose'          // Fast compound spring embedder
  | 'dagre'          // Directed acyclic graph layout
  | 'timeline'       // Timeline with swimlanes
  | 'concentric'     // Concentric circles
  | 'circle'         // Simple circle layout
  | 'grid'           // Regular grid layout
  | 'preset'         // Use preset X/Y positions
  | 'fruchterman'    // Fruchterman-Reingold algorithm
  | 'kamada-kawai'   // Kamada-Kawai algorithm
  | 'spectral'       // Spectral layout
  | 'sugiyama'       // Sugiyama layered layout (minimizes edge crossings)

/**
 * Timeline layout sort options
 */
export type TimelineSortOrder = 'alphabetical' | 'count' | 'custom'

/**
 * Timeline spacing mode
 */
export type TimelineSpacingMode = 'relative' | 'equal'

/**
 * Hierarchical layout orientation
 */
export type HierarchicalOrientation = 'vertical' | 'horizontal'

/**
 * Hierarchical layout direction
 */
export type HierarchicalDirection = 'top-bottom' | 'bottom-top' | 'left-right' | 'right-left'

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Layout type */
  type: LayoutType

  // Timeline layout options
  /** Timeline swimlane attribute (for timeline layout) */
  timelineSwimlaneAttribute?: string
  /** Vertical spacing between swimlanes (timeline) */
  timelineVerticalSpacing?: number
  /** X-axis spacing multiplier (timeline) - affects horizontal time spacing */
  timelineXSpacingMultiplier?: number
  /** Y-axis spacing multiplier (timeline) - affects vertical node spacing within swimlanes */
  timelineYSpacingMultiplier?: number
  /** Sort order for swimlanes (timeline) */
  timelineSwimlaneSort?: TimelineSortOrder
  /** Spacing mode (timeline) - relative to time or equal spacing */
  timelineSpacingMode?: TimelineSpacingMode
  /** Time range filter - start timestamp (timeline) */
  timelineStartTime?: number
  /** Time range filter - end timestamp (timeline) */
  timelineEndTime?: number

  // Hierarchical layout options
  /** Hierarchical layout direction */
  hierarchicalDirection?: HierarchicalDirection
  /** Level separation (spacing between levels) */
  hierarchicalLevelSeparation?: number
  /** Node separation (spacing between nodes on same level) */
  hierarchicalNodeSeparation?: number

  // General options
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
  /** Font templates */
  fontTemplates: FontTemplate[]
  /** Style rules */
  styleRules: StyleRule[]
  /** Layout configuration */
  layoutConfig: LayoutConfig
  /** Grouping configuration */
  groupingConfig?: GroupingConfig
  /** Meta-nodes (groups) */
  metaNodes?: MetaNode[]
}
