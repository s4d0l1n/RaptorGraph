/**
 * Core data model types for Protoceratop
 * All types are designed for multi-value support and flexible attribute handling
 */

// ============================================================================
// NODE AND EDGE DATA MODELS
// ============================================================================

/**
 * Node data structure - supports multi-value attributes and tags
 */
export interface NodeData {
  /** Unique identifier for the node */
  id: string
  /** Display label (optional, defaults to id if not provided) */
  label?: string
  /** Dynamic attributes - can be string or string array for multi-value support */
  attributes: Record<string, string | string[]>
  /** Tags for categorization and filtering */
  tags: string[]
  /** Indicates if this is a stub node (auto-created from links) */
  isStub?: boolean
  /** Source CSV filename(s) this node came from */
  _sources?: string[]
}

/**
 * Edge data structure - connects two nodes
 */
export interface EdgeData {
  /** Unique edge identifier (auto-generated) */
  id?: string
  /** Source node ID */
  source: string
  /** Target node ID */
  target: string
  /** Source attribute name (for link mapping) */
  sourceAttr?: string
  /** Target attribute name (for link mapping) */
  targetAttr?: string
  /** Edge label (optional) */
  label?: string
}

// ============================================================================
// CSV IMPORT AND MAPPING
// ============================================================================

/**
 * Column role types for CSV mapping wizard
 */
export type ColumnRole =
  | 'node_id'           // Unique identifier column
  | 'label'             // Display label column
  | 'attribute'         // Generic attribute column
  | 'tag'               // Tag column
  | 'link_to_attribute' // Links to other nodes via attribute matching
  | 'ignore'            // Skip this column

/**
 * Column mapping configuration
 */
export interface ColumnMapping {
  /** Original column name from CSV */
  columnName: string
  /** Assigned role */
  role: ColumnRole
  /** For 'attribute' and 'tag' roles: the attribute/tag name to use */
  attributeName?: string
  /** For 'link_to_attribute': source attribute to match from */
  linkSourceAttr?: string
  /** For 'link_to_attribute': target attribute to match to */
  linkTargetAttr?: string
}

/**
 * CSV file metadata and mapping
 */
export interface CSVFile {
  /** Original filename */
  name: string
  /** Raw CSV content (for save/load) */
  rawData: string
  /** Column mapping configuration */
  mapping: ColumnMapping[]
  /** Parsed rows count */
  rowCount?: number
  /** Upload timestamp */
  uploadedAt?: string
}

// ============================================================================
// STYLE RULES
// ============================================================================

/**
 * Condition operators for style rules
 */
export type StyleConditionOperator =
  | 'equals'              // Exact match
  | 'not_equals'          // Not equal
  | 'contains'            // Contains substring
  | 'regex_match'         // Matches regex pattern
  | 'regex_no_match'      // Does not match regex
  | 'exists'              // Attribute exists
  | 'empty'               // Attribute is empty or doesn't exist

/**
 * Target types for style rules
 */
export type StyleRuleTarget = 'nodes' | 'edges' | 'both'

/**
 * Node shapes supported by Cytoscape
 */
export type NodeShape =
  | 'ellipse'
  | 'triangle'
  | 'rectangle'
  | 'roundrectangle'
  | 'bottomroundrectangle'
  | 'cutrectangle'
  | 'barrel'
  | 'rhomboid'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'heptagon'
  | 'octagon'
  | 'star'
  | 'tag'
  | 'vee'

/**
 * Style properties that can be modified
 */
export interface StyleProperties {
  /** Background/fill color */
  backgroundColor?: string
  /** Border color */
  borderColor?: string
  /** Border width in pixels */
  borderWidth?: number
  /** Node shape (nodes only) */
  shape?: NodeShape
  /** Size multiplier (e.g., 1.5 = 150%) */
  size?: number
  /** Lucide icon name (nodes only) */
  icon?: string
  /** Label badge text */
  labelBadge?: string
  /** Opacity (0-1) */
  opacity?: number
  /** Line style for borders/edges */
  lineStyle?: 'solid' | 'dotted' | 'dashed'
}

/**
 * Style rule definition
 */
export interface StyleRule {
  /** Unique identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Enabled state */
  enabled: boolean
  /** Attribute to test (or 'any' for existence checks) */
  attribute: string
  /** Condition operator */
  operator: StyleConditionOperator
  /** Value to compare against (for operators that need it) */
  value?: string
  /** Apply to nodes, edges, or both */
  target: StyleRuleTarget
  /** Style properties to apply when condition matches */
  style: StyleProperties
  /** Order/priority (lower numbers = higher priority) */
  order: number
}

// ============================================================================
// GRAPH LAYOUT
// ============================================================================

/**
 * Supported layout algorithms
 */
export type LayoutType =
  | 'cose-bilkent'  // Force-directed (default)
  | 'cola'          // Constraint-based
  | 'circle'        // Circular layout
  | 'grid'          // Grid layout
  | 'preset'        // Use saved positions

/**
 * Layout configuration
 */
export interface LayoutConfig {
  /** Layout algorithm */
  type: LayoutType
  /** Algorithm-specific options */
  options?: Record<string, unknown>
}

/**
 * Saved node positions (for preset layout)
 */
export interface NodePosition {
  /** Node ID */
  id: string
  /** X coordinate */
  x: number
  /** Y coordinate */
  y: number
}

// ============================================================================
// PROJECT STATE (for .protojson)
// ============================================================================

/**
 * Complete project state for save/load
 */
export interface ProjectState {
  /** Format version */
  version: string
  /** Project metadata */
  metadata?: {
    name?: string
    description?: string
    createdAt?: string
    modifiedAt?: string
  }
  /** Imported CSV files */
  csvFiles: CSVFile[]
  /** All nodes in the graph */
  nodes: NodeData[]
  /** All edges in the graph */
  edges: EdgeData[]
  /** Style rules */
  styleRules: StyleRule[]
  /** Layout configuration */
  layoutConfig: LayoutConfig
  /** Saved node positions */
  nodePositions?: NodePosition[]
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Selected node for detail panel
 */
export interface SelectedNode {
  /** Node ID */
  id: string
  /** Node data */
  data: NodeData
  /** Connected edge count */
  connectedEdges: number
}

/**
 * UI panel visibility state
 */
export interface UIPanelState {
  /** CSV upload wizard visible */
  uploadWizard: boolean
  /** Column mapping wizard visible */
  columnMapper: boolean
  /** Style rules panel visible */
  stylePanel: boolean
  /** Node detail panel visible */
  detailPanel: boolean
  /** Layout controls visible */
  layoutPanel: boolean
}

/**
 * Global UI state
 */
export interface UIState {
  /** Panel visibility */
  panels: UIPanelState
  /** Currently selected node */
  selectedNode: SelectedNode | null
  /** Dark mode enabled */
  darkMode: boolean
  /** Loading state */
  loading: boolean
  /** Error message (if any) */
  error: string | null
  /** Success message (if any) */
  success: string | null
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * CSV parsing result
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
 * Validation result
 */
export interface ValidationResult {
  /** Is valid */
  valid: boolean
  /** Error message (if invalid) */
  error?: string
}
