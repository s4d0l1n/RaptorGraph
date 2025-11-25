# 🦖 RaptorGraph

**Privacy-First, 100% Offline DFIR Graph Analysis Tool**

Transform your CSV data into powerful, interactive network graphs—completely offline, zero backend, open source. Perfect for DFIR investigations, threat hunting, network analysis, and security research.

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
- Perfect for sensitive security investigations

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
- Card-style nodes with icons and labels
- Attribute count indicators
- Stub node highlighting
- Circular layout algorithm
- Node selection and detail view

### 📈 **Advanced Graph Features**
- Canvas-accelerated rendering
- Zoom, pan, and node selection
- Click nodes to view detailed information
- Connection statistics (in/out degree)
- Navigate between connected nodes

### 💾 **Project Save/Load** (Coming Soon)
- Save entire project as `.raptorjson` file
- Includes all CSVs, mappings, nodes, edges, style rules
- Reload and continue work anytime
- Share investigations with team

### 🌙 **Beautiful Dark-Mode UI**
- Dark mode by default with light mode toggle
- Responsive design
- Tailwind CSS styling
- Lucide icons
- Toast notifications

---

## 🚀 Quick Start

### Prerequisites

**Option 1: Local Development**
- Node.js 18+
- npm or yarn

### Installation

#### 💻 Local Development

```bash
# Clone the repository
git clone https://github.com/s4d0l1n/Protoceratop.git
cd Protoceratop

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

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

## 📖 Example Use Case

### Network Investigation Scenario

Upload `network_devices.csv`:
```csv
Hostname,IP,Gateway,Type,Tags
web-01,10.0.1.10,10.0.1.1,webserver,"production,dmz"
db-01,10.0.2.20,10.0.2.1,database,"production,sensitive"
fw-01,10.0.1.1,10.0.0.1,firewall,"infrastructure"
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

### ✅ Completed Features (Tasks 1-9)

- ✅ Initial project structure with TypeScript + Vite + Tailwind
- ✅ Global layout (header, sidebar, toast system)
- ✅ Complete Zustand store architecture
- ✅ Drag & drop CSV upload with multi-file support
- ✅ Column mapping wizard with auto-detection
- ✅ Data processor with stub node creation
- ✅ Canvas-based graph visualization
- ✅ Rich card-style nodes with icons
- ✅ Node detail panel with full information display

### 🚧 Pending Features (Tasks 10-24)

- ⏳ Timeline layout with swimlanes
- ⏳ Full project save/load (.raptorjson format)
- ⏳ Card template editor (CRUD panel)
- ⏳ Global search & filter
- ⏳ Group-by meta-nodes with collapse/expand
- ⏳ Conditional styling rules engine
- ⏳ Edge templates and styling
- ⏳ Per-attribute styling overrides
- ⏳ Full layout selector (dagre, timeline, grid, etc.)
- ⏳ Export as high-resolution PNG
- ⏳ Performance optimization with caching
- ⏳ Keyboard shortcuts
- ⏳ Docker deployment configuration

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

- **Issues**: [GitHub Issues](https://github.com/s4d0l1n/Protoceratop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/s4d0l1n/Protoceratop/discussions)

---

**Built for DFIR and security professionals with ❤️ by the open source community**
