import { saveState } from './history.js';
import { state, getCurrentPage } from './state.js';
import { findNodeById } from './layout.js';
import { renderLayout } from './renderer.js';
import { A4_PAPER_ID } from './constants.js';

export let importedAssets = []; // This will act as our asset registry

export function setupAssetHandlers() {
    const importBtn = document.getElementById('import-assets-btn');
    if (!importBtn) return;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    importBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const asset = await processFile(file);
            if (asset) {
                importedAssets.push(asset);
            }
        }
        renderAssetList();
        fileInput.value = ''; // Reset for next import
    });
}

async function processFile(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const fullResData = e.target.result;
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) {
                        height *= maxDim / width;
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width *= maxDim / height;
                        height = maxDim;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const lowResData = canvas.toDataURL('image/jpeg', 0.6);

                resolve({
                    id: `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: file.name,
                    lowResData: lowResData,
                    fullResData: fullResData
                });
            };
            img.src = fullResData;
        };
        reader.readAsDataURL(file);
    });
}

function renderAssetList() {
    const assetList = document.getElementById('asset-list');
    if (!assetList) return;

    assetList.innerHTML = '';
    importedAssets.forEach(asset => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.draggable = true;
        item.innerHTML = `<img src="${asset.lowResData}" alt="${asset.name}" title="${asset.name}">`;

        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', asset.id);
            window._draggedAsset = asset;
            window._sourceRect = null;
        });

        assetList.appendChild(item);
    });
}

export function attachImageDragHandlers(img, asset, hostRectElement) {
    img.draggable = true;
    img.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', asset.id);
        window._draggedAsset = asset;
        window._sourceRect = hostRectElement;
        hostRectElement.classList.add('moving-image');
    });

    img.addEventListener('dragend', () => {
        hostRectElement.classList.remove('moving-image');
    });
}

export function setupDropHandlers() {
    const paper = document.getElementById(A4_PAPER_ID);
    if (!paper) return;

    paper.addEventListener('dragover', (e) => {
        const targetElement = e.target.closest('.splittable-rect');
        if (targetElement) {
            const node = findNodeById(getCurrentPage(), targetElement.id);
            if (node && node.splitState === 'unsplit') {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        }
    });

    paper.addEventListener('drop', (e) => {
        const targetElement = e.target.closest('.splittable-rect');
        const asset = window._draggedAsset;

        if (targetElement && asset) {
            const targetNode = findNodeById(getCurrentPage(), targetElement.id);
            if (!targetNode || targetNode.splitState === 'split') return;

            e.preventDefault();
            saveState();

            let fit = 'cover';
            if (window._sourceRect) {
                const sourceNode = findNodeById(getCurrentPage(), window._sourceRect.id);
                if (sourceNode && sourceNode.image) {
                    fit = sourceNode.image.fit;
                    sourceNode.image = null;
                }
            }

            targetNode.image = {
                assetId: asset.id,
                fit: fit
            };

            window._draggedAsset = null;
            window._sourceRect = null;

            renderLayout(document.getElementById(A4_PAPER_ID), getCurrentPage());
            document.dispatchEvent(new CustomEvent('layoutUpdated'));
        }
    });
}
