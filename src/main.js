const A4_PAPER_ID = 'a4-paper';
let currentId = 1;
let activeDivider = null;
let startX = 0;
let startY = 0;
let startSizeA = 0;
let startSizeB = 0;

// --- Utility Functions ---

// Function to create a new splittable rectangle
function createRectangle(parentRect) {
    currentId++;
    const newRect = document.createElement('div');
    newRect.id = `rect-${currentId}`;

    // Set up base classes and data attributes
    newRect.className = 'splittable-rect rectangle-base flex items-center justify-center';
    newRect.setAttribute('data-split-state', 'unsplit');

    // Text to show in the box
    newRect.innerHTML = currentId;

    // Attach the click handler
    newRect.addEventListener('click', handleSplitClick);

    return newRect;
}

// --- Core Split Logic ---

function handleSplitClick(event) {
    const rectElement = event.currentTarget;

    // Handle Ctrl+Click for deletion (unsplit)
    if (event.ctrlKey) {
        event.stopPropagation();
        deleteRectangle(rectElement);
        return;
    }

    // Prevent splitting if already split or if drag event bubbles up
    if (rectElement.getAttribute('data-split-state') === 'split') {
        return;
    }

    // Mark as split
    rectElement.setAttribute('data-split-state', 'split');

    // Determine dimensions and split orientation
    const rect = rectElement.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    let orientation;

    // Heuristic: If wider than tall, split horizontally (flex-row, vertical divider)
    if (width >= height) {
        orientation = 'vertical'; // Split along the X-axis (Vertical line)
        rectElement.classList.add('flex', 'flex-row');
    } else {
        orientation = 'horizontal'; // Split along the Y-axis (Horizontal line)
        rectElement.classList.add('flex', 'flex-col');
    }

    // Create two new rectangles and the divider
    const rectA = createRectangle(rectElement);
    const rectB = createRectangle(rectElement);
    const divider = createDivider(rectElement, orientation, rectA, rectB);

    // Adjust initial size classes and add them to the container
    if (orientation === 'vertical') {
        // Flex row: width is controlled
        rectA.style.width = '50%';
        rectB.style.width = '50%';
        rectA.style.height = '100%';
        rectB.style.height = '100%';
        rectA.classList.add('h-full');
        rectB.classList.add('h-full');
        divider.classList.add('vertical-divider');
    } else {
        // Flex col: height is controlled
        rectA.style.height = '50%';
        rectB.style.height = '50%';
        rectA.style.width = '100%';
        rectB.style.width = '100%';
        rectA.classList.add('w-full');
        rectB.classList.add('w-full');
        divider.classList.add('horizontal-divider');
    }

    // Remove previous content/text
    rectElement.innerHTML = '';

    // Append children in order: Rect A, Divider, Rect B
    rectElement.appendChild(rectA);
    rectElement.appendChild(divider);
    rectElement.appendChild(rectB);
}

// --- Deletion & Collapse Logic ---

function deleteRectangle(rectElement) {
    // Cannot delete the root container
    if (rectElement.id === A4_PAPER_ID || rectElement.id === 'rect-1') {
        return;
    }

    const parent = rectElement.parentElement;
    if (!parent) return;

    // Find the sibling and the divider
    const children = Array.from(parent.children);
    const sibling = children.find(child => child.classList.contains('splittable-rect') && child !== rectElement);
    const divider = children.find(child => child.classList.contains('divider'));

    if (!sibling) return;

    // Promote sibling content/state to parent
    const isSiblingSplit = sibling.getAttribute('data-split-state') === 'split';

    // Clear parent contents
    parent.innerHTML = '';

    // Reset orientation classes on parent
    parent.classList.remove('flex-row', 'flex-col');

    if (isSiblingSplit) {
        // Move sibling's children to parent
        const siblingOrientation = sibling.classList.contains('flex-row') ? 'flex-row' : 'flex-col';
        parent.classList.add('flex', siblingOrientation);
        parent.setAttribute('data-split-state', 'split');

        // Move all children (rects and divider)
        while (sibling.firstChild) {
            const child = sibling.firstChild;
            if (child.classList && child.classList.contains('divider')) {
                // Update divider's parent reference
                child.setAttribute('data-parent-id', parent.id);
            }
            parent.appendChild(child);
        }
    } else {
        // Sibling is a leaf, parent becomes a leaf
        parent.setAttribute('data-split-state', 'unsplit');
        parent.innerHTML = sibling.innerHTML;
        // Re-attach click handler since it was removed or never there if parent was already split
        // Actually handleSplitClick is always on any .splittable-rect
    }

    // Re-ensure parent has the click handler (it should already have it, but just in case of innerHTML wipe)
    parent.addEventListener('click', handleSplitClick);
}

// --- Divider & Drag Logic ---

function createDivider(parentRect, orientation, rectA, rectB) {
    const divider = document.createElement('div');
    divider.className = 'divider no-select flex-shrink-0';

    // Store data for drag operation
    divider.setAttribute('data-orientation', orientation);
    divider.setAttribute('data-rect-a-id', rectA.id);
    divider.setAttribute('data-rect-b-id', rectB.id);
    divider.setAttribute('data-parent-id', parentRect.id);

    // Attach drag start handler
    divider.addEventListener('mousedown', startDrag);
    divider.addEventListener('touchstart', startDrag, { passive: false });

    return divider;
}

function startDrag(event) {
    event.preventDefault();
    // Store the currently dragged divider
    activeDivider = event.currentTarget;

    // Get the adjacent rectangles
    const rectA = document.getElementById(activeDivider.getAttribute('data-rect-a-id'));
    const rectB = document.getElementById(activeDivider.getAttribute('data-rect-b-id'));
    const parent = document.getElementById(activeDivider.getAttribute('data-parent-id'));

    const orientation = activeDivider.getAttribute('data-orientation');

    // Set up initial positions and sizes
    startX = event.clientX || event.touches[0].clientX;
    startY = event.clientY || event.touches[0].clientY;

    // Use getBoundingClientRect for absolute pixel measurements
    const parentRect = parent.getBoundingClientRect();
    const rectARect = rectA.getBoundingClientRect();
    const rectBRect = rectB.getBoundingClientRect();

    // Calculate current total size (width or height)
    if (orientation === 'vertical') {
        startSizeA = rectARect.width;
        startSizeB = rectBRect.width;
        activeDivider.totalSize = parentRect.width;
    } else {
        startSizeA = rectARect.height;
        startSizeB = rectBRect.height;
        activeDivider.totalSize = parentRect.height;
    }

    // Store references to the elements being resized
    activeDivider.rectA = rectA;
    activeDivider.rectB = rectB;

    // Attach document-wide handlers for dragging and stopping
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);

    // Apply dragging styles
    document.body.classList.add('no-select');
}

function onDrag(event) {
    if (!activeDivider) return;
    event.preventDefault();

    const orientation = activeDivider.getAttribute('data-orientation');
    const rectA = activeDivider.rectA;
    const rectB = activeDivider.rectB;

    const clientX = event.clientX || event.touches[0].clientX;
    const clientY = event.clientY || event.touches[0].clientY;

    let delta;

    if (orientation === 'vertical') {
        // Vertical divider (adjusting width)
        delta = clientX - startX;
    } else {
        // Horizontal divider (adjusting height)
        delta = clientY - startY;
    }

    // Calculate new sizes in pixels
    let newSizeA = startSizeA + delta;
    let newSizeB = startSizeB - delta;

    // Minimum size constraint (e.g., 5% of parent's original size)
    const minSize = 0;

    if (newSizeA < minSize) {
        newSizeA = minSize;
        newSizeB = activeDivider.totalSize - newSizeA;
    } else if (newSizeB < minSize) {
        newSizeB = minSize;
        newSizeA = activeDivider.totalSize - newSizeB;
    }

    // Calculate new percentage sizes
    const percentA = (newSizeA / activeDivider.totalSize) * 100;
    const percentB = (newSizeB / activeDivider.totalSize) * 100;

    if (orientation === 'vertical') {
        rectA.style.width = `${percentA}%`;
        rectB.style.width = `${percentB}%`;
    } else {
        rectA.style.height = `${percentA}%`;
        rectB.style.height = `${percentB}%`;
    }
}

function stopDrag() {
    if (!activeDivider) return;

    // Clean up global handlers and state
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);

    document.body.classList.remove('no-select');
    activeDivider = null;
}


// --- Initialization ---

function initialize() {
    const initialRect = document.getElementById('rect-1');
    // Attach the click handler to the initial rectangle
    initialRect.addEventListener('click', handleSplitClick);
}

// Run initialization when the document is ready
document.addEventListener('DOMContentLoaded', initialize);
