import { describe, it, expect } from 'vitest';
import { deleteNodeFromTree } from '../../src/js/layout/internal/treeUtils.js';

describe('treeUtils.js - deleteNodeFromTree', () => {
    it('should delete a node and merge its sibling into the parent', () => {
        const root = {
            id: 'parent',
            splitState: 'split',
            orientation: 'vertical',
            children: [
                { id: 'nodeA', splitState: 'unsplit', image: null, text: 'Text A' },
                { id: 'nodeB', splitState: 'unsplit', image: 'Image B', text: null }
            ]
        };

        const result = deleteNodeFromTree(root, 'nodeA');

        expect(result.id).toBe('parent');
        expect(root.splitState).toBe('unsplit');
        expect(root.children).toBe(null);
        expect(root.text).toBe(null);
        expect(root.image).toBe('Image B');
    });

    it('should handle nested deletions correctly', () => {
        const root = {
            id: 'root',
            splitState: 'split',
            orientation: 'horizontal',
            children: [
                { id: 'top', splitState: 'unsplit' },
                {
                    id: 'bottom',
                    splitState: 'split',
                    orientation: 'vertical',
                    children: [
                        { id: 'left', splitState: 'unsplit' },
                        { id: 'right', splitState: 'unsplit' }
                    ]
                }
            ]
        };

        const result = deleteNodeFromTree(root, 'left');

        expect(result.id).toBe('bottom');
        expect(root.children[1].id).toBe('bottom');
        expect(root.children[1].splitState).toBe('unsplit');
        expect(root.children[1].children).toBe(null);
    });

    it('should return null if node is not found', () => {
        const root = { id: 'root', splitState: 'unsplit' };
        const result = deleteNodeFromTree(root, 'nonexistent');
        expect(result).toBe(null);
    });
});
