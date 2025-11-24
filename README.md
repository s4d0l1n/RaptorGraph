# 🦖 Protoceratop

**Interactive Graph Visualization & Analysis Tool for CSV Data**

Transform your CSVs into powerful, interactive network graphs—100% offline, zero backend, open source. Perfect for data exploration, threat hunting, network analysis, and more.

[![License](https://img.shields.io/badge/license-GNU-blue.svg)](LICENSE)
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

### 🎨 **Conditional Styling with Regex**
- Unlimited style rules with drag-to-reorder priority
- Full JavaScript regex support for pattern matching
- Operators: `=`, `≠`, `contains`, `=~ regex`, `!~ regex`, `exists`, `empty`
- Visual properties: colors, shapes, sizes, borders, opacity
- Auto-color by attribute with legend generation
- Special stub node styling

### 📈 **Advanced Graph Visualization**
- **G6 (AntV)** powered rendering - optimized for large datasets
- Multiple layout algorithms:
  - Force-directed (D3-Force) - default
  - Hierarchical (Dagre)
  - Circular, Grid, Radial, Concentric
- Pan, zoom, drag nodes
- Node click → detail panel
- Fit to screen, export PNG
- Excellent performance with 10,000+ nodes

### 💾 **Project Save/Load**
- Save entire project as `.protojson` file
- Includes all CSVs, mappings, nodes, edges, style rules
- Reload and continue work anytime
- Share investigations with team

### 🌙 **Beautiful UI**
- Dark mode (default) with light mode toggle
- Responsive design
- Tailwind CSS styling
- Lucide icons
- Toast notifications

---

## 🚀 Quick Start

### Prerequisites

**Option 1: Docker (Recommended)**
- Docker
- Docker Compose

**Option 2: Local Development**
- Node.js 18+
- npm or yarn

### Installation

#### 🐳 Docker Deployment (Production)

The easiest way to deploy Protoceratop to your server:

```bash
# Clone the repository
git clone https://github.com/s4d0l1n/Protoceratop.git
cd Protoceratop

# Build and start with Docker Compose
docker-compose up -d

# Or build manually
docker build -t protoceratop .
docker run -d -p 8080:80 --name protoceratop protoceratop
```

Access the application at `http://localhost:8080` (or your server's IP)

**Docker Commands:**
```bash
# View logs
docker-compose logs -f

# Stop the container
docker-compose down

# Rebuild after changes
docker-compose up -d --build

# Check health status
docker ps
```

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

1. **Upload CSV**: Click "Upload CSV" button or drag & drop files
2. **Map Columns**: Assign roles to each column:
   - **Node ID**: Unique identifier (required, one per file)
   - **Label**: Display text for nodes
   - **Attribute**: Store as node attribute
   - **Tag**: Add as searchable tags
   - **Link→Attribute**: Create edges by matching values
   - **Ignore**: Skip column
3. **View Graph**: Explore your data visually
4. **Style Rules**: Add conditional formatting with regex
5. **Save Project**: Export as `.protojson` for later

---

## 📖 Example Use Case

### Threat Hunting Scenario

Upload `hosts.csv`:
```csv
FQDN,IP,Gateway,Tags
web-01.corp.com,10.0.1.10,10.0.1.1,"production,web"
db-01.corp.com,10.0.2.20,10.0.2.1,"production,database"
```

**Column Mapping**:
- `FQDN` → Node ID
- `IP` → Attribute "ip"
- `Gateway` → Link MY "gateway" TO OTHER NODES' "ip"
- `Tags` → Tag

**Result**:
- Nodes for each host
- Edges connecting hosts to their gateways
- Stub nodes auto-created for gateways not in CSV

**Style Rule Example**:
```
Name: Highlight Public DNS
Attribute: ip
Operator: =~ regex
Value: ^(8\.8\.|1\.1\.1\.)
Style: Shape=triangle, Color=red, Size=150%
```

---

## 🏗️ Architecture

```
src/
├── components/         # React components
│   ├── FileUpload.tsx       # CSV drag & drop
│   ├── ColumnMapper.tsx     # Column role mapping wizard
│   ├── GraphView.tsx        # Cytoscape visualization
│   ├── NodeDetailPanel.tsx  # Node info slide-out
│   ├── StyleRulesPanel.tsx  # Conditional styling
│   └── ProjectIO.tsx        # Save/load functionality
├── stores/            # Zustand state management
│   ├── graphStore.ts        # Nodes & edges
│   ├── csvStore.ts          # Uploaded files
│   ├── styleStore.ts        # Style rules
│   ├── uiStore.ts           # UI state
│   └── layoutStore.ts       # Layout config
├── types/             # TypeScript definitions
│   └── index.ts             # All type interfaces
├── utils/             # Business logic
│   ├── csvParser.ts         # PapaParse integration
│   ├── multiValueParser.ts  # Smart value splitting
│   ├── dataProcessor.ts     # CSV→nodes/edges
│   ├── styleEvaluator.ts    # Rule evaluation
│   └── projectIO.ts         # .protojson format
└── App.tsx            # Main application
```

### Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode)
- **Build**: Vite 6
- **Styling**: Tailwind CSS 3 (dark mode)
- **State**: Zustand 5
- **Graph**: G6 (AntV) v5 - WebGL accelerated
- **CSV**: PapaParse
- **Icons**: Lucide React

---

## 🎯 Key Features Deep Dive

### Multi-Value Parsing Logic

Protoceratop intelligently splits cell values:

1. **JSON Array**: `["value1", "value2"]` → parsed as array
2. **Delimiters**: Splits on `,` `;` `|` `\n` → chooses best
3. **Brackets**: Strips surrounding `[ ]`
4. **Deduplication**: Case-insensitive, keeps original case

### Link→Attribute Matching

When you set a column as "Link→Attribute":
- Specify **source attribute** (e.g., "gateway")
- Specify **target attribute** (e.g., "ip")
- Protoceratop searches all nodes for matching values
- Creates edges to **all** matching nodes
- Auto-creates **stub nodes** for unmatched values

Stub nodes can be "promoted" when a later CSV provides full data.

### Style Rule Evaluation

Rules are evaluated **top-to-bottom** (order matters):
- Later rules override earlier rules
- Regex uses JavaScript `RegExp` syntax
- Multi-value arrays: match if **any** value matches
- Stub nodes can be auto-styled with dashed borders

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
- Performance optimized for 1000+ nodes

---

## 📝 .protojson Format

```json
{
  "version": "1.0",
  "metadata": {
    "name": "My Investigation",
    "createdAt": "2025-01-01T00:00:00Z",
    "modifiedAt": "2025-01-01T12:00:00Z"
  },
  "csvFiles": [
    {
      "name": "hosts.csv",
      "rawData": "...",
      "mapping": [...]
    }
  ],
  "nodes": [...],
  "edges": [...],
  "styleRules": [...],
  "layoutConfig": {...},
  "nodePositions": [...]
}
```

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

- **G6 (AntV)** - High-performance graph visualization
- **PapaParse** - CSV parsing
- **Zustand** - State management
- **Tailwind CSS** - Styling
- **Lucide** - Icons

---

## 🐛 Known Issues / Future Enhancements

- [ ] Add graph search/filter functionality
- [ ] Export to other formats (GraphML, GEXF)
- [ ] Keyboard shortcuts
- [ ] Node grouping/clustering
- [ ] Time-based playback for temporal data
- [ ] Custom icon support beyond Lucide

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/s4d0l1n/Protoceratop/issues)
- **Discussions**: [GitHub Discussions](https://github.com/s4d0l1n/Protoceratop/discussions)

---

**Built with ❤️ for DFIR and security professionals**
