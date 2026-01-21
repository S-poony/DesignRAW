
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveLayout, openLayout } from '../../src/js/fileIO.js';
import { state, updateCurrentId } from '../../src/js/state.js';
import { assetManager } from '../../src/js/AssetManager.js';
import { exportSettings, loadSettings } from '../../src/js/settings.js';
import * as rendererModule from '../../src/js/renderer.js';
import { A4_PAPER_ID } from '../../src/js/constants.js';

// Mock dependencies
vi.mock('../../src/js/renderer.js', () => ({
    renderLayout: vi.fn(),
    renderCoverImage: vi.fn()
}));

vi.mock('../../src/js/pages.js', () => ({
    renderPageList: vi.fn()
}));

vi.mock('../../src/js/utils.js', () => ({
    showAlert: vi.fn()
}));

vi.mock('../../src/js/history.js', () => ({
    saveState: vi.fn()
}));

// Mock settings module
vi.mock('../../src/js/settings.js', () => ({
    exportSettings: vi.fn(),
    loadSettings: vi.fn(),
    getSettings: vi.fn(() => ({ paper: { backgroundColor: '#fff' } }))
}));

describe('fileIO.js', () => {
    let mockAnchor;
    let mockUrlCreate;
    let mockUrlRevoke;
    let mockFileReader;
    let originalCreateElement;
    let createdInput; // Capture reference

    beforeEach(() => {
        // Reset state
        state.pages = [];
        state.currentPageIndex = 0;
        updateCurrentId(1);

        // Mock DOM elements
        document.body.appendChild = vi.fn();
        document.body.removeChild = vi.fn();
        const paper = document.createElement('div');
        paper.id = A4_PAPER_ID;
        document.body.appendChild(paper);

        mockAnchor = {
            click: vi.fn(),
            href: '',
            download: ''
        };

        // Capture original createElement to avoid recursion
        originalCreateElement = document.createElement.bind(document);

        vi.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') return mockAnchor;
            if (tag === 'input') {
                createdInput = {
                    type: '',
                    accept: '',
                    click: vi.fn(),
                    onchange: null
                };
                return createdInput;
            }
            return originalCreateElement(tag);
        });

        // Expose createdInput to tests if needed, but we can capture it above

        // Mock URL
        mockUrlCreate = vi.fn(() => 'blob:url');
        mockUrlRevoke = vi.fn();
        global.URL.createObjectURL = mockUrlCreate;
        global.URL.revokeObjectURL = mockUrlRevoke;

        // Mock FileReader as a class/constructor
        mockFileReader = {
            readAsText: vi.fn(),
            onload: null
        };

        global.FileReader = vi.fn();
        global.FileReader.prototype.readAsText = mockFileReader.readAsText;
        global.FileReader.prototype.onload = null;
        global.FileReader.mockImplementation(() => mockFileReader);

        // Clear mock calls
        vi.clearAllMocks();
        createdInput = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    describe('saveLayout', () => {
        it('should save current state and settings to a JSON file', () => {
            // ... save logic
            state.pages = [{ id: 'rect-1' }];
            const mockSettings = { test: 'settings' };
            exportSettings.mockReturnValue(mockSettings);

            saveLayout();

            expect(exportSettings).toHaveBeenCalled();
            expect(mockUrlCreate).toHaveBeenCalled();
            expect(mockAnchor.download).toMatch(/layout-.*\.layout\.json/);
            expect(mockAnchor.click).toHaveBeenCalled();
        });
    });

    describe('openLayout', () => {
        it('should restore state and settings from JSON file', async () => {
            // Setup initial state
            const mockFile = new File(['{"pages": [], "settings": {"foo": "bar"}}'], 'test.json', { type: 'application/json' });

            // Trigger open
            openLayout();

            // Verify input was created
            expect(createdInput).toBeTruthy();

            // Simulate user selecting file
            const event = { target: { files: [mockFile] } };
            // Manually invoke the handler set by the code
            createdInput.onchange(event);

            // Wait for FileReader
            expect(mockFileReader.readAsText).toHaveBeenCalledWith(mockFile);

            // Simulate file read completion
            const loadedData = {
                pages: [{ id: 'rect-loaded' }],
                currentPageIndex: 0,
                currentId: 5,
                assets: [],
                settings: { paper: { showPageNumbers: true } }
            };

            // Manually trigger the onload
            if (mockFileReader.onload) {
                mockFileReader.onload({ target: { result: JSON.stringify(loadedData) } });
            } else {
                throw new Error('onload handler was not set on FileReader mock');
            }

            // ASSERTIONS
            expect(loadSettings).toHaveBeenCalledWith(loadedData.settings);
            expect(rendererModule.renderLayout).toHaveBeenCalled();

            const loadSettingsOrder = loadSettings.mock.invocationCallOrder[0];
            const renderLayoutOrder = rendererModule.renderLayout.mock.invocationCallOrder[0];

            expect(loadSettingsOrder).toBeLessThan(renderLayoutOrder);
        });
    });
});
