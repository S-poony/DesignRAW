import { A4_PAPER_ID, MAX_HISTORY } from './constants.js';
import { state, updateCurrentId } from './state.js';

let undoStack = [];
let redoStack = [];

export function saveState() {
    undoStack.push({
        layout: JSON.parse(JSON.stringify(state.layout)),
        currentId: state.currentId
    });
    if (undoStack.length > MAX_HISTORY) {
        undoStack.shift();
    }
    redoStack = [];
}

export function undo(rebindCallback) {
    if (undoStack.length === 0) return;

    redoStack.push({
        layout: JSON.parse(JSON.stringify(state.layout)),
        currentId: state.currentId
    });

    const prevState = undoStack.pop();
    restoreState(prevState, rebindCallback);
}

export function redo(rebindCallback) {
    if (redoStack.length === 0) return;

    undoStack.push({
        layout: JSON.parse(JSON.stringify(state.layout)),
        currentId: state.currentId
    });

    const nextState = redoStack.pop();
    restoreState(nextState, rebindCallback);
}

function restoreState(snapshot, rebindCallback) {
    state.layout = snapshot.layout;
    updateCurrentId(snapshot.currentId);
    if (rebindCallback) rebindCallback();
}
