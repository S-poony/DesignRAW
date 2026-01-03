import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { importedAssets } from './assets.js';
import { A4_PAPER_ID } from './constants.js';

export function setupExportHandlers() {
    const exportBtn = document.getElementById('export-layout-btn');
    const modal = document.getElementById('export-modal');
    const cancelBtn = document.getElementById('cancel-export');
    const confirmBtn = document.getElementById('confirm-export');

    if (!exportBtn || !modal) return;

    exportBtn.addEventListener('click', () => {
        modal.classList.add('active');
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    // Close on click outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    confirmBtn.addEventListener('click', async () => {
        const format = document.querySelector('input[name="export-format"]:checked').value;
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Generating...';

        try {
            await performExport(format);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Download';
            modal.classList.remove('active');
        }
    });
}

async function performExport(format) {
    const paper = document.getElementById(A4_PAPER_ID);
    if (!paper) return;

    // 1. Create a clone to manipulate for export without affecting the UI
    const clone = paper.cloneNode(true);

    // Position the clone off-screen but visible enough for html2canvas
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '0';
    clone.style.width = paper.offsetWidth + 'px';
    clone.style.height = paper.offsetHeight + 'px';
    document.body.appendChild(clone);

    // 2. Swap low-res images for high-res ones in the clone
    const imageElements = clone.querySelectorAll('img[data-asset-id]');
    const swapPromises = Array.from(imageElements).map(img => {
        const assetId = img.getAttribute('data-asset-id');
        const asset = importedAssets.find(a => a.id === assetId);
        if (asset && asset.fullResData) {
            return new Promise((resolve) => {
                const tempImg = new Image();
                tempImg.onload = () => {
                    // Workaround for html2canvas object-fit: cover
                    // We use background-image on the parent rectangle
                    const parent = img.parentElement;
                    if (parent) {
                        parent.style.backgroundImage = `url(${asset.fullResData})`;
                        parent.style.backgroundSize = 'cover';
                        parent.style.backgroundPosition = 'center';
                        parent.style.backgroundRepeat = 'no-repeat';
                        img.style.display = 'none'; // Hide the original img tag
                    }
                    resolve();
                };
                tempImg.onerror = resolve; // Continue even if one fails
                tempImg.src = asset.fullResData;
            });
        }
        return Promise.resolve();
    });

    await Promise.all(swapPromises);

    // 3. Render the clone to canvas
    // Use a higher scale for better quality (retina-like)
    const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
    });

    // 4. Clean up the clone
    document.body.removeChild(clone);

    // 5. Trigger download based on format
    const fileName = `layout-export-${new Date().getTime()}`;

    if (format === 'png') {
        downloadImage(canvas.toDataURL('image/png'), `${fileName}.png`);
    } else if (format === 'jpeg') {
        downloadImage(canvas.toDataURL('image/jpeg', 0.9), `${fileName}.jpg`);
    } else if (format === 'pdf') {
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF({
            orientation: paper.offsetWidth > paper.offsetHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width / 2, canvas.height / 2] // match the scaled canvas size back to original pixels
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${fileName}.pdf`);
    }
}

function downloadImage(dataUrl, filename) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
