export let state = {
    currentId: 1,
    activeDivider: null,
    startX: 0,
    startY: 0,
    startSizeA: 0,
    startSizeB: 0,
    layout: {
        id: 'rect-1',
        splitState: 'unsplit',
        image: null // { assetId: '...', fit: 'cover' }
    }
};

export function updateCurrentId(val) {
    state.currentId = val;
}

export function updateLayout(newLayout) {
    state.layout = newLayout;
}
