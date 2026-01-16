# Interactive Layout Splitter

A visual tool for designing multi-page document layouts with drag-and-drop image placement. Perfect for creating photo albums, portfolios, and print-ready designs.

**[Live Demo](https://s-poony.github.io/DesignRAW/)**

## Features

-   **Recursive Splitting**: Click any rectangle to split it vertically or horizontally.
-   **Edge Dragging**: Drag dividers to resize sections, or drag from the paper's edge to create new sections.
-   **Image Management**: Import images and drag them into any slot. Click an image to toggle between `cover` and `contain` fit.
-   **Multi-Page Support**: Add, switch, and delete pages via the left sidebar.
-   **Undo/Redo**: Full history support with `Ctrl+Z` / `Ctrl+Y`.
-   **Export**: Download your layouts as a multi-page PDF or a ZIP of images.

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Keyboard Shortcuts

| Action         | Shortcut           |
| :------------- | :----------------- |
| Split          | `Click`            |
| Alt Split      | `Alt + Click`      |
| Delete Section | `Ctrl + Click`     |
| Toggle Fit     | `Click` (on image) |
| Undo           | `Ctrl + Z`         |
| Redo           | `Ctrl + Y`         |

## Tech Stack

-   **Vite** - Build tool
-   **html2canvas** - DOM to canvas rendering
-   **jsPDF** - PDF generation
-   **JSZip** - ZIP archive creation
-   **marked** - Markdown parsing

## Project Structure

```
src/
├── main.js           # App initialization
├── style.css         # CSS imports
├── js/
│   ├── state.js      # App state & page management
│   ├── layout.js     # Split, delete, resize logic
│   ├── renderer.js   # DOM rendering from state
│   ├── assets.js     # Image import & drag/drop
│   ├── pages.js      # Page list & thumbnails
│   ├── export.js     # PDF & image export
│   └── history.js    # Undo/redo stack
└── css/              # Modular stylesheets
```

## License

MIT
