# React Hierarchical Force-Directed Tree 🌳

A modern, interactive hierarchical tree visualization built with React, D3.js, and Framer Motion.

## ✨ Features

- **🎯 Interactive Nodes**: Hover to expand nodes and reveal full descriptions
- **🌊 Smooth Animations**: Powered by Framer Motion for buttery-smooth transitions
- **🎪 Physics Simulation**: D3.js force-directed layout with hierarchical constraints
- **🖱️ Drag & Drop**: Fully draggable nodes with physics simulation
- **📱 Responsive**: Adapts to any screen size
- **⚡ Modern React**: Uses hooks, functional components, and modern patterns

## 🚀 Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm start
   ```

3. **Open your browser** to `http://localhost:3000`

## 🛠️ Tech Stack

- **React 18** - Modern React with hooks
- **D3.js v7** - Force simulation and data manipulation
- **Framer Motion** - Smooth, spring-based animations
- **Modern JavaScript** - ES6+ features throughout

## 📁 Project Structure

```
src/
├── components/
│   ├── HierarchicalForceTree.js  # Main tree component
│   └── TreeNode.js               # Individual node component
├── data/
│   └── treeData.js               # Tree data structure
├── hooks/
│   └── useD3Force.js             # Custom D3 force simulation hook
├── App.js                        # Main App component
└── index.js                      # React entry point
```

## 🎨 Key Components

### TreeNode Component
- Handles individual node rendering and animations
- Manages hover states and text expansion
- Smooth transitions between keyword and full text

### HierarchicalForceTree Component
- Manages D3 force simulation
- Handles drag interactions
- Renders links with arrows
- Orchestrates the entire tree layout

### useD3Force Hook
- Encapsulates D3 force simulation logic
- Provides drag behavior
- Manages node positioning

## 🎯 Animation Features

- **Spring Physics**: Natural, bouncy animations
- **Staggered Entrance**: Nodes appear with sequential delays
- **Hover Expansion**: Circles expand to show full text
- **Smooth Transitions**: All state changes are animated

## 📊 Data Structure

```javascript
{
  nodes: [
    {
      id: "CEO",
      keyword: "CEO",
      fullText: "Chief Executive Officer...",
      level: 0,
      size: 20
    }
  ],
  links: [
    { source: "CEO", target: "CTO", value: 3 }
  ]
}
```

## 🎛️ Customization

- **Colors**: Modify `colorScheme` in HierarchicalForceTree.js
- **Animation**: Adjust Framer Motion transition properties
- **Physics**: Tune D3 force parameters (charge, distance, etc.)
- **Data**: Update treeData.js with your own hierarchy

## 🚀 Performance

- **Optimized Rendering**: React's virtual DOM minimizes updates
- **Efficient Physics**: D3's optimized force simulation
- **Smooth 60fps**: Framer Motion's hardware-accelerated animations
- **Memory Efficient**: Proper cleanup and effect management

## 🔧 Development

- `npm start` - Development server with hot reload
- `npm build` - Production build
- `npm test` - Run tests
- `npm eject` - Eject from Create React App (⚠️ irreversible)

Enjoy building beautiful, interactive tree visualizations! 🎉