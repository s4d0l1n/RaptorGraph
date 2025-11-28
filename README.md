# 🦖 RaptorGraph

**Privacy-First, 100% Offline Graph Visualization Tool**

Transform your CSV data into powerful, interactive network graphs—completely offline, zero backend, open source. Perfect for data analysis, network visualization, relationship mapping, and research projects of any kind.

[![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.0-purple)](https://vitejs.dev/)

---

## ✨ Features

### 🔒 **100% Client-Side & Offline**
- All processing happens in your browser
- No data ever leaves your machine
- Works completely offline after initial load
- Perfect for sensitive or private data analysis

### 📊 **Powerful CSV Import**
- Drag & drop multiple CSV files
- Smart multi-value parsing (JSON arrays, comma/semicolon/pipe delimited)
- Manual column mapping wizard with full control
- Support for merging multiple CSVs into one graph

### 🔗 **Intelligent Link Creation**
- **Link→Attribute** mapping: Automatically create edges by matching attribute values
- Auto-creates stub nodes for missing references
- Stub promotion when full node data becomes available
- Multi-value array matching support

### 🎨 **Rich Node Visualization**
- Card-style nodes with customizable icons and colors
- Custom card templates with emoji/image icons
- Attribute count indicators
- Stub node highlighting
- Multiple layout algorithms (circle, grid, concentric, timeline, random)
- Node selection and detail view

### 📈 **Advanced Graph Features**
- Canvas-accelerated rendering for high performance
- Zoom, pan, and node selection
- Click nodes to view detailed information
- Connection statistics (in/out degree)
- Navigate between connected nodes
- Timeline layout with optional swimlanes

### 🔍 **Search & Filter**
- Fuzzy search across node IDs, labels, and attributes
- Filter by tags with toggle buttons
- Degree filtering (in/out/total connections)
- Attribute-based filtering with dynamic values
- Real-time filter results

### 🎭 **Conditional Styling**
- Rules engine with 10 operators (equals, contains, regex, exists, etc.)
- Drag-to-reorder priority
- Apply templates or add tags based on conditions
- Real-time rule evaluation
- Enable/disable individual rules

### 💾 **Project Save/Load**
- Save entire project as `.raptorjson` file
- Includes all CSVs, mappings, nodes, edges, templates, style rules
- Reload and continue work anytime
- Share investigations with team
- Version control friendly JSON format

### 📸 **Export Functionality**
- Export graph as high-resolution PNG (2x scale by default)
- Configurable dimensions for custom resolution
- Client-side export - no backend required
- One-click download with automatic filename
- Export button integrated in graph view

### ⌨️ **Keyboard Shortcuts**
- Esc, Delete, Ctrl+S, Ctrl+O, Ctrl+F
- Efficient navigation and control
- Smart detection of input fields

### 🐳 **Docker Deployment**
- Multi-stage build for minimal image size
- Nginx server with gzip compression and caching
- Health checks and security headers
- One-command deployment

### 🌙 **Beautiful Dark-Mode UI**
- Dark mode by default with light mode toggle
- Responsive design
- Tailwind CSS styling
- Lucide icons
- Toast notifications and loading states

---

## 🚀 Quick Start

### Prerequisites

**Option 1: Local Development**
- Node.js 18+
- npm or yarn

**Option 2: Docker**
- Docker
- Docker Compose (optional)

### Installation

#### 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/s4d0l1n/RaptorGraph.git
cd RaptorGraph

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

#### 🐳 Docker Deployment

```bash
# Clone the repository
git clone https://github.com/s4d0l1n/RaptorGraph.git
cd RaptorGraph

# Option 1: Using Docker Compose (Recommended)
docker-compose up -d

# Option 2: Using Docker directly
docker build -t raptorgraph .
docker run -d -p 8080:80 --name raptorgraph raptorgraph

# Access the application
open http://localhost:8080
```

**Docker Features:**
- Multi-stage build for minimal image size
- Nginx server with gzip compression
- Security headers configured
- Health check endpoint at `/health`
- SPA routing support
- Static asset caching

### Usage

1. **Upload CSV**: Click "Upload CSV" in sidebar or drag & drop files
2. **Map Columns**: Assign roles to each column:
   - **Node ID**: Unique identifier (required, one per file)
   - **Attribute**: Store as node attribute with custom name
   - **Link→Attribute**: Create edges by matching attribute values
   - **Timestamp**: For timeline positioning
   - **Ignore**: Skip column
3. **View Graph**: Explore your data visually in the main canvas
4. **Click Nodes**: Select nodes to view detailed information in the side panel
5. **Navigate**: Click connected nodes in the detail panel to explore relationships

---

## 📖 Example Use Cases

### Network Devices Scenario

Upload `devices.csv`:
```csv
Hostname,IP,Gateway,Type,Tags
server-01,10.0.1.10,10.0.1.1,webserver,"production,frontend"
database-01,10.0.2.20,10.0.2.1,database,"production,backend"
router-01,10.0.1.1,10.0.0.1,router,"infrastructure,core"
```

**Column Mapping**:
- `Hostname` → Node ID
- `IP` → Attribute "ip"
- `Gateway` → Link MY "gateway" TO OTHER NODES' "ip"
- `Type` → Attribute "type"
- `Tags` → Attribute "tags"

**Result**:
- Nodes for each device
- Edges connecting devices to their gateways
- Stub nodes auto-created for gateways not in CSV
- Rich detail view showing all attributes and connections

### Other Use Cases

- **Organizational Charts**: Map employees, departments, and reporting structures
- **Project Dependencies**: Visualize task dependencies and project relationships
- **Social Networks**: Analyze connections between people or entities
- **Supply Chain**: Track product flow and vendor relationships
- **Knowledge Graphs**: Map concepts and their relationships
- **Citation Networks**: Visualize research paper citations
- **Infrastructure Mapping**: Document system dependencies and data flows

---

## 🏗️ Architecture

```
src/
├── assets/
├── components/
│   ├── ui/              # Reusable UI components
│   │   ├── FileUploadZone.tsx    # Drag & drop CSV upload
│   │   ├── ColumnMapper.tsx       # Column role mapping wizard
│   │   ├── NodeDetailPanel.tsx    # Node detail slide-out
│   │   ├── UploadPanel.tsx        # Upload modal
│   │   └── Toast.tsx              # Toast notifications
│   ├── graph/           # Graph visualization
│   │   └── G6Graph.tsx            # Canvas-based graph renderer
│   └── layout/          # Layout components
│       ├── Header.tsx             # App header with stats
│       └── Sidebar.tsx            # Collapsible navigation
├── lib/                 # Business logic
│   ├── utils.ts                   # Utility functions
│   ├── multiValueParser.ts        # Smart CSV value parsing
│   ├── dataProcessor.ts           # CSV → nodes/edges conversion
│   ├── styleEvaluator.ts          # Style rules evaluation
│   └── projectIO.ts               # Project save/load
├── stores/              # Zustand state management
│   ├── uiStore.ts                 # UI state
│   ├── csvStore.ts                # CSV file management
│   ├── graphStore.ts              # Nodes & edges
│   ├── templateStore.ts           # Card/edge templates
│   ├── rulesStore.ts              # Style rules
│   └── projectStore.ts            # Project metadata
├── types/               # TypeScript definitions
│   └── index.ts                   # All type interfaces
├── hooks/               # Custom React hooks
│   └── useDataProcessor.ts        # Data processing hook
├── App.tsx              # Main application
└── main.tsx             # Entry point
```

### Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite 6
- **Styling**: Tailwind CSS 3 (dark mode)
- **State**: Zustand 5
- **Graph**: Canvas API (G6 v5 integration pending)
- **CSV**: PapaParse
- **Icons**: Lucide React
- **Dates**: date-fns
- **Toasts**: Sonner

---

## 🎯 Key Features Deep Dive

### Multi-Value Parsing Logic

RaptorGraph intelligently splits cell values:

1. **JSON Array**: `["value1", "value2"]` → parsed as array
2. **Delimiters**: Splits on `,` `;` `|` `\n` → chooses best
3. **Brackets**: Strips surrounding `[ ]`
4. **Deduplication**: Case-insensitive, keeps original case

### Link→Attribute Matching

When you set a column as "Link→Attribute":
- Specify **source attribute** (e.g., "gateway")
- Specify **target attribute** (e.g., "ip")
- RaptorGraph searches all nodes for matching values
- Creates edges to **all** matching nodes
- Auto-creates **stub nodes** for unmatched values

Stub nodes can be "promoted" when a later CSV provides full data.

---

## ⌨️ Keyboard Shortcuts

RaptorGraph supports keyboard shortcuts for efficient navigation:

| Shortcut | Action |
|----------|--------|
| `Esc` | Close active panel or clear node selection |
| `Delete` / `Backspace` | Delete selected node (with confirmation) |
| `Ctrl/Cmd + S` | Save project as .raptorjson |
| `Ctrl/Cmd + O` | Open project file |
| `Ctrl/Cmd + F` | Open search & filter panel |

**Note**: Keyboard shortcuts are disabled when typing in input fields.

---

## 📦 Project File Format (.raptorjson)

RaptorGraph projects are saved in a JSON format with the following structure:

```json
{
  "version": "1.0.0",
  "name": "Project Name",
  "description": "Optional description",
  "createdAt": 1234567890,
  "modifiedAt": 1234567890,
  "csvFiles": [...],          // Original CSV files with mappings
  "nodes": [...],             // All graph nodes
  "edges": [...],             // All graph edges
  "cardTemplates": [...],     // Custom card templates
  "edgeTemplates": [...],     // Custom edge templates
  "styleRules": [...],        // Conditional styling rules
  "layoutConfig": {...}       // Layout settings
}
```

**Benefits**:
- Complete state restoration
- Share investigations with team
- Version control friendly
- Human-readable JSON format

---

## 🛠️ Development

### Project Scripts

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Lint code
```

### Code Quality

- **TypeScript strict mode** enabled
- **No `any` types** allowed
- Heavy inline documentation
- Proper error handling throughout
- Performance optimized for large datasets

---

## 📝 Current Status

### ✅ All Features Completed (Tasks 1-24)

- ✅ **Task 1**: Initial project structure with TypeScript + Vite + Tailwind
- ✅ **Task 2**: Global layout (header, sidebar, toast system)
- ✅ **Task 3**: Complete Zustand store architecture
- ✅ **Task 4**: Drag & drop CSV upload with multi-file support
- ✅ **Task 5**: Column mapping wizard with auto-detection
- ✅ **Task 6**: Data processor with stub node creation
- ✅ **Task 7**: Canvas-based graph visualization
- ✅ **Task 8**: Rich card-style nodes with icons
- ✅ **Task 9**: Node detail panel with full information display
- ✅ **Task 10**: Timeline layout with swimlanes
- ✅ **Task 11**: Full project save/load (.raptorjson format)
- ✅ **Task 12**: Card template editor with CRUD interface, emoji/image picker, attribute display configuration
- ✅ **Task 13**: Global search & filter with fuzzy search, tag filtering, degree filtering, attribute filtering
- ✅ **Task 14**: Group-by meta-nodes with collapse/expand functionality, centroid positioning
- ✅ **Task 15**: Conditional styling rules engine with 10 operators, drag-to-reorder, template/tag application
- ✅ **Task 16**: Edge templates and styling (line styles, arrow types, colors, opacity, labels)
- ✅ **Task 17**: Per-attribute styling overrides (font size, color, prefix, suffix)
- ✅ **Task 18**: Full layout selector with circle, grid, concentric, timeline, and random layouts
- ✅ **Task 19**: Export graph as high-resolution PNG with configurable scale
- ✅ **Task 20**: Performance optimization with memoization and on-demand rendering
- ✅ **Task 21**: Keyboard shortcuts (Esc, Delete, Ctrl+S, Ctrl+O, Ctrl+F) and loading spinner
- ✅ **Task 22**: Enhanced timeline layout with configurable spacing, swimlane sorting, time filtering
- ✅ **Task 23**: Docker deployment with multi-stage build, nginx, health checks
- ✅ **Task 24**: Comprehensive documentation with keyboard shortcuts and file format specs

**Project Status: 24 of 24 tasks completed (100%)** 🎉

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 📜 License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **G6 (AntV)** - High-performance graph visualization (pending full integration)
- **PapaParse** - CSV parsing
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Lucide** - Icons

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/s4d0l1n/RaptorGraph/issues)
- **Discussions**: [GitHub Discussions](https://github.com/s4d0l1n/RaptorGraph/discussions)

---

**Built with ❤️ for data analysts, researchers, and anyone who needs to visualize complex relationships**
