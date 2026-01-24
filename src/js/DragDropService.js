import { GHOST_SIZE } from './constants.js';

/**
 * @typedef {Object} DragData
 * @property {import('./AssetManager.js').Asset} [asset]
 * @property {string} [text]
 * @property {number} [pageIndex]
 * @property {HTMLElement} [sourceRect]
 * @property {Object} [sourceTextNode]
 */

export class DragDropService {
    constructor() {
        /** @type {import('./AssetManager.js').Asset|null} */
        this.draggedAsset = null;
        /** @type {string|undefined} */
        this.draggedText = undefined;
        /** @type {number|undefined} */
        this.draggedPageIndex = undefined;
        /** @type {HTMLElement|null} */
        this.sourceRect = null;
        /** @type {Object|null} */
        this.sourceTextNode = null;
        /** @type {string|undefined} */
        this.draggedTextAlign = undefined;
        /** @type {Touch|null} Current active touch if any */
        this.activeTouch = null;
        /** @type {boolean} Whether we are currently in a drag operation */
        this.dragging = false;

        // Global mouse handlers for immediate drag
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);

        // Cleanup on page visibility change to prevent ghost leaks
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isDragging()) {
                this.endDrag();
            }
        });
    }

    /**
     * @param {DragData} data 
     * @param {MouseEvent|Touch} event
     */
    startDrag(data, event) {
        this.draggedAsset = data.asset || null;
        this.draggedText = data.text !== undefined ? data.text : undefined;
        this.draggedPageIndex = data.pageIndex !== undefined ? data.pageIndex : undefined;
        this.sourceRect = data.sourceRect || null;
        this.sourceTextNode = data.sourceTextNode || null;
        this.draggedTextAlign = data.textAlign || undefined;

        this.dragging = true;

        if (this.sourceRect) {
            this.sourceRect.classList.add(this.draggedAsset ? 'moving-image' : 'moving-text');
        }

        // Create ghost immediately
        this.createGhost(event, data);

        // Add document-level listeners for mouse if no touch
        if (!(window.Touch && event instanceof Touch)) {
            document.addEventListener('mousemove', this.onMouseMove);
            document.addEventListener('mouseup', this.onMouseUp);
        }
    }

    /**
     * @param {TouchEvent} e 
     * @param {DragData} data 
     */
    startTouchDrag(e, data) {
        if (e.touches && e.touches.length > 0) {
            this.activeTouch = e.touches[0];
            this.startDrag(data, this.activeTouch);
        }
    }

    onMouseMove(e) {
        if (!this.dragging) return;
        this.updateGhostPosition(e.clientX, e.clientY);

        const target = document.elementFromPoint(e.clientX, e.clientY);
        document.dispatchEvent(new CustomEvent('custom-drag-move', {
            detail: { target, x: e.clientX, y: e.clientY }
        }));
    }

    onMouseUp(e) {
        if (!this.dragging) return;

        // Find target element before ending drag
        const target = document.elementFromPoint(e.clientX, e.clientY);

        // We'll need a way to trigger the drop logic. 
        // Typically assets.js or main.js will call endDrag() and then handle the result.
        // But for mouse up to work globally, we might need a custom event or a callback.
        // For now, let's dispatch a custom drop event that other services can listen to.
        const dropEvent = new CustomEvent('custom-drop', {
            detail: { target, clientX: e.clientX, clientY: e.clientY }
        });
        document.dispatchEvent(dropEvent);

        this.endDrag();
    }

    /**
     * @param {MouseEvent|Touch} e 
     * @param {DragData} data 
     */
    createGhost(e, data) {
        if (this.touchGhost) this.touchGhost.remove();

        const ghost = document.createElement('div');
        ghost.id = 'drag-ghost';
        ghost.style.position = 'fixed';
        ghost.style.width = `${GHOST_SIZE}px`;
        ghost.style.height = `${GHOST_SIZE}px`;
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '100000'; // Even higher
        ghost.style.opacity = '0.8';
        ghost.style.borderRadius = '8px';
        ghost.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
        ghost.style.border = '2px solid var(--color-primary, #4f46e5)';
        ghost.style.display = 'flex';
        ghost.style.alignItems = 'center';
        ghost.style.justifyContent = 'center';
        ghost.style.backgroundColor = 'white';
        ghost.style.transition = 'transform 0.05s linear'; // Smoother movement

        if (data.asset) {
            const img = document.createElement('img');
            img.src = data.asset.lowResData;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.style.borderRadius = '6px';
            ghost.appendChild(img);
        } else if (data.text !== undefined) {
            ghost.innerHTML = '📝';
            ghost.style.fontSize = '24px';
        } else if (data.pageIndex !== undefined) {
            ghost.innerHTML = '📄';
            ghost.style.fontSize = '24px';
        }

        this.updateGhostPosition(e.clientX, e.clientY, ghost);

        document.body.appendChild(ghost);
        this.touchGhost = ghost;
    }

    updateGhostPosition(x, y, ghost = this.touchGhost) {
        if (!ghost) return;
        ghost.style.left = `${x - GHOST_SIZE / 2}px`;
        ghost.style.top = `${y - GHOST_SIZE / 2}px`;
    }

    /**
     * @param {TouchEvent} e 
     */
    handleTouchMove(e) {
        if (!this.dragging || !this.touchGhost) return;

        const touch = e.touches && e.touches.length > 0 ? e.touches[0] : null;
        if (!touch) return;

        if (e.cancelable) e.preventDefault();

        this.updateGhostPosition(touch.clientX, touch.clientY);

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        document.dispatchEvent(new CustomEvent('custom-drag-move', {
            detail: { target, x: touch.clientX, y: touch.clientY }
        }));

        return {
            x: touch.clientX,
            y: touch.clientY,
            target: target
        };
    }

    endDrag() {
        this.dragging = false;

        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);

        if (this.sourceRect) {
            this.sourceRect.classList.remove('moving-image', 'moving-text');
        }
        if (this.touchGhost) {
            this.touchGhost.remove();
            this.touchGhost = null;
        }

        const finalData = {
            asset: this.draggedAsset,
            text: this.draggedText,
            pageIndex: this.draggedPageIndex,
            sourceRect: this.sourceRect,
            sourceTextNode: this.sourceTextNode
        };

        this.draggedAsset = null;
        this.draggedText = undefined;
        this.draggedPageIndex = undefined;
        this.sourceRect = null;
        this.sourceTextNode = null;

        return finalData;
    }

    isDragging() {
        return this.dragging;
    }
}

export const dragDropService = new DragDropService();
