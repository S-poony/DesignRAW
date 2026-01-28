import { SNAP_POINTS, SNAP_THRESHOLD, MIN_AREA_PERCENT } from '../../core/constants.js';
import { state, getCurrentPage } from '../../core/state.js';
import { saveState } from '../../io/history.js';
import { findNodeById, findParentNode, countParallelLeaves } from './treeUtils.js';

/**
 * Snaps the divider adjacent to the focused rectangle in the given direction.
 * This function handles both calculating snap points and updating state.
 * @param {HTMLElement} focusedRect 
 * @param {string} direction 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'
 * @param {Function} deleteCallback (node) => void
 * @param {Function} renderCallback (page, focusId) => void
 */
export function snapDivider(focusedRect, direction, deleteCallback, renderCallback) {
    const page = getCurrentPage();
    let currentNodeId = focusedRect.id;
    let targetParent = null;
    let targetDividerOrientation = (direction === 'ArrowLeft' || direction === 'ArrowRight') ? 'vertical' : 'horizontal';

    // Find the first ancestor that is split in the relevant orientation
    // AND where the current node (or its branch) is adjacent to the divider in that direction
    let searchNodeId = currentNodeId;
    while (searchNodeId) {
        const parent = findParentNode(page, searchNodeId);
        if (!parent) break;

        if (parent.orientation === targetDividerOrientation) {
            const isFirstChild = parent.children[0].id === searchNodeId ||
                (parent.children[0].children && findNodeById(parent.children[0], searchNodeId));

            const isSecondChild = parent.children[1].id === searchNodeId ||
                (parent.children[1].children && findNodeById(parent.children[1], searchNodeId));

            if ((isFirstChild && (direction === 'ArrowRight' || direction === 'ArrowDown')) ||
                (isSecondChild && (direction === 'ArrowLeft' || direction === 'ArrowUp'))) {
                targetParent = parent;
                break;
            }
        }
        searchNodeId = parent.id;
    }

    if (!targetParent) return;

    // We found a divider to move!
    const nodeA = targetParent.children[0];
    const nodeB = targetParent.children[1];

    // Get current percentage of nodeA
    const currentPct = parseFloat(nodeA.size);
    if (isNaN(currentPct)) return;

    // Use a Set of rounded strings to ensure clean deduplication during construction
    const candidatesSet = new Set();
    const addCandidate = (val) => {
        if (val >= 1 && val <= 99) {
            candidatesSet.add(Math.round(val * 10) / 10); // Round to 1 decimal place (e.g. 33.3)
        }
    };

    // 1. Dynamic Snap Points (Leaf Count)
    const totalCount = countParallelLeaves(nodeA, targetDividerOrientation) + countParallelLeaves(nodeB, targetDividerOrientation);
    if (totalCount > 1) {
        // Base 50%
        addCandidate(50);

        // Dynamic fractions
        for (let i = 1; i < totalCount; i++) {
            addCandidate((i / totalCount) * 100);
        }
    } else {
        // Fallback
        addCandidate(50);
    }

    // 2. Boundary Snaps (Allow full collapse/expansion)
    addCandidate(1);
    addCandidate(99);

    // 3. Recursive Gap Subdivision
    const MIN_GAP_FOR_RECURSION = 10;
    const remainingForward = 100 - currentPct;
    if (remainingForward > MIN_GAP_FOR_RECURSION) {
        SNAP_POINTS.forEach(p => addCandidate(currentPct + (remainingForward * p / 100)));
    }
    const remainingBackward = currentPct;
    if (remainingBackward > MIN_GAP_FOR_RECURSION) {
        SNAP_POINTS.forEach(p => addCandidate(remainingBackward * p / 100));
    }

    // 4. Global Alignment Snaps
    const otherDividers = Array.from(document.querySelectorAll(`.divider[data-orientation="${targetDividerOrientation}"]`));
    const parentEl = document.getElementById(targetParent.id) || document.getElementById('a4-paper'); // Hardcoded ID fallback to avoid circular dependency
    const parentRect = parentEl.getBoundingClientRect();
    const parentStyle = window.getComputedStyle(parentEl);

    const movingDivider = document.querySelector(`.divider[data-parent-id="${targetParent.id}"][data-rect-a-id="${nodeA.id}"]`);
    const movingDivSize = movingDivider ? (targetDividerOrientation === 'vertical' ? movingDivider.offsetWidth : movingDivider.offsetHeight) : 0;

    const parentStart = (targetDividerOrientation === 'vertical' ? parentRect.left : parentRect.top);
    const parentSize = (targetDividerOrientation === 'vertical' ? parentRect.width : parentRect.height);
    const startBorder = (targetDividerOrientation === 'vertical' ? parseFloat(parentStyle.borderLeftWidth) : parseFloat(parentStyle.borderTopWidth)) || 0;
    const endBorder = (targetDividerOrientation === 'vertical' ? parseFloat(parentStyle.borderRightWidth) : parseFloat(parentStyle.borderBottomWidth)) || 0;

    const availableFlexSpace = parentSize - startBorder - endBorder - movingDivSize;

    if (availableFlexSpace > 0) {
        otherDividers.forEach(div => {
            if (div === movingDivider) return;
            const divRect = div.getBoundingClientRect();
            const divCenter = (targetDividerOrientation === 'vertical' ? divRect.left + divRect.width / 2 : divRect.top + divRect.height / 2);

            const relCenter = divCenter - parentStart;
            const flexPos = relCenter - startBorder - (movingDivSize / 2);
            const relPct = (flexPos / availableFlexSpace) * 100;

            addCandidate(relPct);
        });
    }

    const sortedCandidates = Array.from(candidatesSet).map(Number).sort((a, b) => a - b);

    const MIN_JUMP = 1.2;
    let targetPct = null;

    if (direction === 'ArrowRight' || direction === 'ArrowDown') {
        targetPct = sortedCandidates.find(c => c >= currentPct + MIN_JUMP);
        if (targetPct === undefined && currentPct < 99) targetPct = 99;
    } else {
        targetPct = [...sortedCandidates].reverse().find(c => c <= currentPct - MIN_JUMP);
        if (targetPct === undefined && currentPct > 1) targetPct = 1;
    }

    if (targetPct !== undefined && targetPct !== null) {
        saveState();

        if (targetPct <= MIN_AREA_PERCENT) {
            deleteCallback(document.getElementById(nodeA.id));
        } else if ((100 - targetPct) <= MIN_AREA_PERCENT) {
            deleteCallback(document.getElementById(nodeB.id));
        } else {
            nodeA.size = `${targetPct}%`;
            nodeB.size = `${100 - targetPct}%`;
            renderCallback(page, focusedRect.id);
        }
    }
}

/**
 * Calculates dynamic snap points based on parallel leaf counts.
 * Useful for both onDrag and snapDivider logic.
 */
export function calculateDynamicSnaps(divider, orientation) {
    const dynamicSnaps = [50];
    const parentNode = findNodeById(getCurrentPage(), divider.getAttribute('data-parent-id'));

    if (parentNode) {
        const nodeA = findNodeById(parentNode, divider.getAttribute('data-rect-a-id'));
        const nodeB = findNodeById(parentNode, divider.getAttribute('data-rect-b-id'));

        if (nodeA && nodeB) {
            const leftCount = countParallelLeaves(nodeA, orientation);
            const rightCount = countParallelLeaves(nodeB, orientation);
            const totalCount = leftCount + rightCount;

            if (totalCount > 1) {
                for (let i = 1; i < totalCount; i++) {
                    dynamicSnaps.push((i / totalCount) * 100);
                }
            }
        }
    }
    return [...new Set(dynamicSnaps)];
}
