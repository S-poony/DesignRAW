import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isDividerMergeable } from '../../src/js/layout/internal/treeUtils.js';

describe('Merge Logic (isDividerMergeable)', () => {
    it('should return true for a parent with two leaf children', () => {
        const parent = {
            id: 'parent',
            splitState: 'split',
            children: [
                { id: 'childA', splitState: 'unsplit' },
                { id: 'childB', splitState: 'unsplit' }
            ]
        };
        expect(isDividerMergeable(parent)).toBe(true);
    });

    it('should return false if one child is split orthogonally', () => {
        const parent = {
            id: 'parent',
            splitState: 'split',
            orientation: 'vertical',
            children: [
                {
                    id: 'childA',
                    splitState: 'split',
                    orientation: 'horizontal',
                    children: [
                        { id: 'childA1', splitState: 'unsplit' },
                        { id: 'childA2', splitState: 'unsplit' }
                    ]
                },
                { id: 'childB', splitState: 'unsplit' }
            ]
        };
        // Divider is vertical. Child A is split horizontally.
        // Child A touches the divider with 2 leaves. -> Cannot merge.
        expect(isDividerMergeable(parent)).toBe(false);
    });

    it('should return true if one child is split parallelly', () => {
        const parent = {
            id: 'parent',
            splitState: 'split',
            orientation: 'vertical',
            children: [
                {
                    id: 'childA',
                    splitState: 'split',
                    orientation: 'vertical',
                    children: [
                        { id: 'childA1', splitState: 'unsplit' },
                        { id: 'childA2', splitState: 'unsplit' }
                    ]
                },
                { id: 'childB', splitState: 'unsplit' }
            ]
        };
        // Divider is vertical (x=c). Child A split is vertical (x=d).
        // Only Child A2 touches the divider. -> Exactly 2 nodes. -> Mergeable.
        expect(isDividerMergeable(parent)).toBe(true);
    });

    it('should return false if parent is not split', () => {
        const parent = {
            id: 'parent',
            splitState: 'unsplit'
        };
        expect(isDividerMergeable(parent)).toBe(false);
    });

    it('should return true for complex but valid parallel splits', () => {
        // Parent split vertically (Divider is Vertical)
        // Child A is split vertically -> Children A1, A2. Only A2 touches the divider.
        // Child B is unsplit.
        // This divider should be mergeable because Child A only contributes 1 leaf (A2) to that specific boundary.
        const parent = {
            id: 'parent',
            splitState: 'split',
            orientation: 'vertical',
            children: [
                {
                    id: 'childA',
                    splitState: 'split',
                    orientation: 'vertical',
                    children: [
                        { id: 'childA1', splitState: 'unsplit' },
                        { id: 'childA2', splitState: 'unsplit' }
                    ]
                },
                { id: 'childB', splitState: 'unsplit' }
            ]
        };
        expect(isDividerMergeable(parent)).toBe(true);
    });

    it('should return false if a sibling contributes 2+ nodes to the shared boundary', () => {
        // Parent split vertically (Divider is Vertical)
        // Child A is split HORIZONTALLY (orthogonal to divider). Both A1 and A2 touch the divider.
        // This should NOT be mergeable because Child A contributes 2 leaves to the boundary.
        const parent = {
            id: 'parent',
            splitState: 'split',
            orientation: 'vertical',
            children: [
                {
                    id: 'childA',
                    splitState: 'split',
                    orientation: 'horizontal',
                    children: [
                        { id: 'childA1', splitState: 'unsplit' },
                        { id: 'childA2', splitState: 'unsplit' }
                    ]
                },
                { id: 'childB', splitState: 'unsplit' }
            ]
        };
        expect(isDividerMergeable(parent)).toBe(false);
    });
});
