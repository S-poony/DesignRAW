import { undo, redo } from './js/history.js';
import { handleSplitClick, rebindEvents } from './js/layout.js';
import { setupAssetHandlers, setupDropHandlers } from './js/assets.js';
import { setupExportHandlers } from './js/export.js';

function setupGlobalHandlers() {
    window.addEventListener('keydown', (e) => {
        // Ctrl Key for Cursor (only if Shift is not held)
        if (e.ctrlKey && !e.shiftKey) {
            document.body.classList.add('ctrl-pressed');
        } else if (e.shiftKey) {
            document.body.classList.remove('ctrl-pressed');
        }

        // Undo: Ctrl + Z
        if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undo(rebindEvents);
        }

        // Redo: Ctrl + Y or Ctrl + Shift + Z
        if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            redo(rebindEvents);
        }
    });

    window.addEventListener('keyup', (e) => {
        if (e.key === 'Control' || e.key === 'Shift') {
            // Update cursor based on final state of modifiers
            if (e.ctrlKey && !e.shiftKey) {
                document.body.classList.add('ctrl-pressed');
            } else {
                document.body.classList.remove('ctrl-pressed');
            }
        }
    });

    window.addEventListener('blur', () => {
        document.body.classList.remove('ctrl-pressed');
    });
}

function initialize() {
    const initialRect = document.getElementById('rect-1');
    if (initialRect) {
        initialRect.addEventListener('click', handleSplitClick);
    }

    setupAssetHandlers();
    setupDropHandlers();
    setupExportHandlers();
    setupGlobalHandlers();
    loadShortcuts();
}

import { marked } from 'marked';

async function loadShortcuts() {
    const container = document.getElementById('shortcuts-content');
    if (!container) return;

    try {
        const response = await fetch('/assets/shortcuts.md');
        if (!response.ok) throw new Error('Failed to load shortcuts');
        const text = await response.text();

        // Use marked for true markdown support with GFM line breaks enabled
        const html = marked.parse(text, { breaks: true });

        container.className = 'shortcuts-content';
        container.innerHTML = html;
    } catch (error) {
        console.error('Error loading shortcuts:', error);
        container.innerHTML = '<p>Shortcuts list currently unavailable.</p>';
    }
}

document.addEventListener('DOMContentLoaded', initialize);
