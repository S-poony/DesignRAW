import { A4_PAPER_ID, SNAP_POINTS, SNAP_THRESHOLD } from './constants.js';
import { state, getCurrentPage } from './state.js';
import { saveState } from './history.js';
import { renderLayout } from './renderer.js';

// Helper to restore focus after render
export function renderAndRestoreFocus(page, explicitFocusId = null) {
    // If explicit ID provided, use it. Otherwise try to preserve current active element.
    const focusedId = explicitFocusId || (document.activeElement ? document.activeElement.id : null);

    renderLayout(document.getElementById(A4_PAPER_ID), page);

    let focusRestored = false;

    // 1. Try explicit ID (e.g. key button)
    if (explicitFocusId) {
        const el = document.getElementById(explicitFocusId);
        if (el) {
            el.focus({ preventScroll: true });
            focusRestored = true;
        } else {
            // Fallback: if button is gone (e.g. text removed), try the rect itself
            // ID format: align-btn-rect-X -> rect-X
            if (explicitFocusId.startsWith('align-btn-') || explicitFocusId.startsWith('remove-text-btn-')) {
                const rectId = explicitFocusId.replace('align-btn-', '').replace('remove-text-btn-', '');
                const rect = document.getElementById(rectId);
                if (rect) {
                    rect.focus({ preventScroll: true });
                    focusRestored = true;
                }
            }
        }
    }

    // 2. If no explicit focus restored (or not provided), try previously focused ID
    if (!focusRestored && focusedId) {
        const el = document.getElementById(focusedId);
        if (el) {
            el.focus({ preventScroll: true });
        }
    }

    document.dispatchEvent(new CustomEvent('layoutUpdated'));
}

// Helper to find node in the layout tree
export function findNodeById(root, id) {
    if (root.id === id) return root;
    if (root.children) {
        for (const child of root.children) {
            const found = findNodeById(child, id);
            if (found) return found;
        }
    }
    return null;
}

// Helper to find parent node in the layout tree
export function findParentNode(root, childId) {
    if (root.children) {
        if (root.children.some(c => c.id === childId)) return root;
        for (const child of root.children) {
            const found = findParentNode(child, childId);
            if (found) return found;
        }
    }
    return null;
}

export function handleSplitClick(event) {
    // If we just finished editing text, clicking elsewhere should only exit edit mode
    if (window._justFinishedEditing) {
        return;
    }

    // If click was on the remove button, don't do anything here
    if (event.target.closest('.remove-image-btn')) {
        return;
    }

    const rectElement = event.target.closest('.splittable-rect');
    const node = findNodeById(getCurrentPage(), rectElement.id);
    if (!node || node.splitState === 'split') return;

    // Stop propagation so clicking a leaf doesn't trigger parent split handlers
    event.stopPropagation();

    // Ctrl + Click (without Shift) = Delete content or rectangle
    if (event.ctrlKey && !event.shiftKey) {
        saveState();
        if (node.image || node.text !== null) {
            node.image = null;
            node.text = null;
            // Explicitly restore focus to this rect after clearing content
            renderAndRestoreFocus(getCurrentPage(), rectElement.id);
        } else {
            deleteRectangle(rectElement);
        }
        return;
    }

    // Image logic: Toggle object-fit if clicking image without Shift or Alt
    if (node.image && !event.shiftKey && !event.altKey) {
        saveState();
        node.image.fit = node.image.fit === 'cover' ? 'contain' : 'cover';
        // Explicitly restore focus to this rect
        renderAndRestoreFocus(getCurrentPage(), rectElement.id);
        return;
    }

    // Image logic: Toggle flip if Alt + Click on image (or handle via button, but keeping shortcut optional)
    // Actually, let's keep click behavior simple and use the new button for flip. 
    // But we need to ensure flip state is preserved during split below.

    // Text logic: Don't split if clicking text without Shift or Alt (one is required to split)
    if ((node.text !== null && node.text !== undefined) && !event.shiftKey && !event.altKey) {
        // Do nothing - clicking text area should focus editor, not split
        return;
    }

    // Split logic
    saveState();
    node.splitState = 'split';

    const rect = rectElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const defaultIsVertical = width >= height;
    node.orientation = event.altKey ? (defaultIsVertical ? 'horizontal' : 'vertical') : (defaultIsVertical ? 'vertical' : 'horizontal');

    // Create children in state
    const childA = { id: `rect-${++state.currentId}`, splitState: 'unsplit', image: null, text: null, size: '50%' };
    const childB = { id: `rect-${++state.currentId}`, splitState: 'unsplit', image: null, text: null, size: '50%' };
    node.children = [childA, childB];

    // If there was an image, migrate it in state
    if (node.image) {
        const targetNode = event.ctrlKey ? childB : childA;
        targetNode.image = { ...node.image }; // This copies fit and flip properties
        node.image = null;
    }

    // If there was text, migrate it in state
    if (node.text !== null && node.text !== undefined) {
        const targetNode = event.ctrlKey ? childB : childA;
        targetNode.text = node.text;
        targetNode.textAlign = node.textAlign;
        node.text = null;
        node.textAlign = null;
    }

    // When splitting, the original rect (rectElement.id) is now a container (hidden/replaced).
    // The visual equivalent of "staying selected" is presumably focusing the first child (or the one preserving content).
    // If it's a mouse click (has coordinates), we focus whatever is under the mouse after split.
    // If it's a keyboard split (Spacebar), we default to childA.

    renderLayout(document.getElementById(A4_PAPER_ID), getCurrentPage());

    const isMouseClick = event.clientX > 0 || event.clientY > 0;
    let focused = false;

    if (isMouseClick) {
        const elUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
        const newRect = elUnderMouse ? elUnderMouse.closest('.splittable-rect[data-split-state="unsplit"]') : null;
        if (newRect) {
            newRect.focus({ preventScroll: true });
            focused = true;
        }
    }

    if (!focused) {
        // Fallback for keyboard or if elementFromPoint failed
        const newFocus = document.getElementById(childA.id);
        if (newFocus) newFocus.focus({ preventScroll: true });
    }

    document.dispatchEvent(new CustomEvent('layoutUpdated'));
}

export function createTextInRect(rectId, initialText = null) {
    const node = findNodeById(getCurrentPage(), rectId);
    if (!node || node.splitState === 'split' || node.image) return;

    saveState();

    // If initialText is provided (string), overwrite key
    // If initialText is null/undefined, keep existing text (enter edit mode) or init empty
    if (initialText !== null) {
        node.text = initialText;
    } else if (node.text === null || node.text === undefined) {
        node.text = '';
    }
    // If node.text already existed and initialText is null, we just leave it alone to edit it.
    // Mark that we want edit mode
    node._startInEditMode = true;
    renderLayout(document.getElementById(A4_PAPER_ID), getCurrentPage());
    document.dispatchEvent(new CustomEvent('layoutUpdated'));
}

export function deleteRectangle(rectElement) {
    if (rectElement.id === A4_PAPER_ID) {
        return;
    }

    const parentNode = findParentNode(getCurrentPage(), rectElement.id);
    if (!parentNode) return;

    const siblingNode = parentNode.children.find(c => c.id !== rectElement.id);

    // Merge sibling into parent
    parentNode.splitState = siblingNode.splitState;
    if (siblingNode.splitState === 'split') {
        parentNode.children = siblingNode.children;
        parentNode.orientation = siblingNode.orientation;
    } else {
        parentNode.children = null;
        parentNode.image = siblingNode.image;
        parentNode.text = siblingNode.text;
        parentNode.textAlign = siblingNode.textAlign;
        parentNode.orientation = null;
    }

    renderLayout(document.getElementById(A4_PAPER_ID), getCurrentPage());
    document.dispatchEvent(new CustomEvent('layoutUpdated'));
}

export function toggleTextAlignment(rectId) {
    const node = findNodeById(getCurrentPage(), rectId);
    if (!node || (node.text === null && node.text === undefined)) return;

    saveState();
    node.textAlign = node.textAlign === 'center' ? 'left' : 'center';

    renderAndRestoreFocus(getCurrentPage(), `align-btn-${rectId}`);
}

export function toggleImageFlip(rectId) {
    const node = findNodeById(getCurrentPage(), rectId);
    if (!node || !node.image) return;

    saveState();
    // Toggle flip state (undefined/false -> true -> false)
    node.image.flip = !node.image.flip;

    // Restore focus to flip button
    renderAndRestoreFocus(getCurrentPage(), `flip-btn-${rectId}`);
}

export function startDrag(event, dividerElement = null) {
    event.preventDefault();
    if (!dividerElement) saveState();

    const divider = dividerElement || event.currentTarget;
    if (!divider) return;

    state.activeDivider = divider;

    const rectAId = divider.getAttribute('data-rect-a-id');
    const rectBId = divider.getAttribute('data-rect-b-id');
    const parentId = divider.getAttribute('data-parent-id');

    const rectA = document.getElementById(rectAId);
    const rectB = document.getElementById(rectBId);
    const parent = document.getElementById(parentId);

    const orientation = divider.getAttribute('data-orientation');
    const isTouch = event.touches && event.touches.length > 0;
    state.startX = isTouch ? event.touches[0].clientX : event.clientX;
    state.startY = isTouch ? event.touches[0].clientY : event.clientY;

    const parentRect = parent.getBoundingClientRect();
    const rectARect = rectA.getBoundingClientRect();
    const rectBRect = rectB.getBoundingClientRect();

    if (orientation === 'vertical') {
        state.startSizeA = rectARect.width;
        state.startSizeB = rectBRect.width;
        divider.totalSize = parentRect.width;
    } else {
        state.startSizeA = rectARect.height;
        state.startSizeB = rectBRect.height;
        divider.totalSize = parentRect.height;
    }

    divider.rectA = rectA;
    divider.rectB = rectB;
    divider.parentId = parentId;
    divider.rectAId = rectAId;
    divider.rectBId = rectBId;

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
    document.body.classList.add('no-select');
}

export function startEdgeDrag(event, edge) {
    event.preventDefault();
    event.stopPropagation();
    saveState();

    const isTouch = event.touches && event.touches.length > 0;
    const clientX = isTouch ? event.touches[0].clientX : event.clientX;
    const clientY = isTouch ? event.touches[0].clientY : event.clientY;

    const oldLayout = getCurrentPage();
    const orientation = (edge === 'left' || edge === 'right') ? 'vertical' : 'horizontal';

    // Create the new split node that will wrap the current layout
    const newRoot = {
        id: `rect-${++state.currentId}`,
        splitState: 'split',
        orientation: orientation,
        children: []
    };

    // Start with minimum 5% size to prevent accidental tiny splits on mobile
    const MIN_EDGE_SIZE = 2;
    const newRect = {
        id: `rect-${++state.currentId}`,
        splitState: 'unsplit',
        image: null,
        text: null,
        size: `${MIN_EDGE_SIZE}%`
    };

    // Old layout wrapped - gets remaining space
    const oldLayoutNode = { ...oldLayout };
    oldLayoutNode.size = `${100 - MIN_EDGE_SIZE}%`;

    if (edge === 'left' || edge === 'top') {
        newRoot.children = [newRect, oldLayoutNode];
    } else {
        newRoot.children = [oldLayoutNode, newRect];
    }

    state.pages[state.currentPageIndex] = newRoot;
    renderLayout(document.getElementById(A4_PAPER_ID), getCurrentPage());
    document.dispatchEvent(new CustomEvent('layoutUpdated'));

    // Now trigger the normal drag on the newly created divider
    const divider = document.querySelector(`.divider[data-parent-id="${newRoot.id}"]`);
    if (divider) {
        startDrag(event, divider);
    }
}

function onDrag(event) {
    if (!state.activeDivider) return;
    event.preventDefault();

    const divider = state.activeDivider;
    const orientation = divider.getAttribute('data-orientation');
    const rectA = divider.rectA;
    const rectB = divider.rectB;

    const isTouch = event.touches && event.touches.length > 0;
    const clientX = isTouch ? event.touches[0].clientX : event.clientX;
    const clientY = isTouch ? event.touches[0].clientY : event.clientY;

    let delta = (orientation === 'vertical') ? (clientX - state.startX) : (clientY - state.startY);

    let newSizeA = state.startSizeA + delta;
    let newSizeB = state.startSizeB - delta;
    const minSize = 0;

    if (newSizeA < minSize) {
        newSizeA = minSize;
        newSizeB = divider.totalSize;
    } else if (newSizeB < minSize) {
        newSizeB = minSize;
        newSizeA = divider.totalSize;
    }

    let growA = (newSizeA / divider.totalSize) * 100;
    let growB = (newSizeB / divider.totalSize) * 100;

    // Apply snapping if Shift key is held
    if (event.shiftKey) {
        for (const snapPoint of SNAP_POINTS) {
            const snapPx = (snapPoint / 100) * divider.totalSize;
            if (Math.abs(newSizeA - snapPx) < SNAP_THRESHOLD) {
                growA = snapPoint;
                growB = 100 - snapPoint;
                break;
            }
        }
    }

    rectA.style.flexGrow = growA;
    rectB.style.flexGrow = growB;
}

function stopDrag() {
    if (!state.activeDivider) return;

    const divider = state.activeDivider;
    const rectA = divider.rectA;
    const rectB = divider.rectB;
    const orientation = divider.getAttribute('data-orientation');

    const pA = parseFloat(rectA.style.flexGrow);
    const pB = parseFloat(rectB.style.flexGrow);

    // Sync back to state
    const parentNode = findNodeById(getCurrentPage(), divider.parentId);
    if (parentNode && parentNode.children) {
        const nodeA = findNodeById(parentNode, divider.rectAId);
        const nodeB = findNodeById(parentNode, divider.rectBId);
        if (nodeA) nodeA.size = `${pA}%`;
        if (nodeB) nodeB.size = `${pB}%`;
    }

    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
    document.body.classList.remove('no-select');
    state.activeDivider = null;

    // Delete rectangles that have very small or negative area
    const MIN_AREA_PERCENT = 1;
    if (pA <= MIN_AREA_PERCENT) {
        deleteRectangle(rectA);
    } else if (pB <= MIN_AREA_PERCENT) {
        deleteRectangle(rectB);
    }
}

