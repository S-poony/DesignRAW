import { test, expect } from '@playwright/test';

test.describe('Performance Evaluation', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            const text = msg.text();
            console.log(`BROWSER: ${text}`);
        });
        await page.goto('http://localhost:5173');
        await page.waitForSelector('.splittable-rect[data-split-state="unsplit"]');
    });

    test('measure render time for complex tree', async ({ page }) => {
        const buildTree = async (targetLeafCount) => {
            console.log(`Starting buildTree to ${targetLeafCount} leaves...`);
            for (let i = 1; i < targetLeafCount; i++) {
                const unsplitNodes = page.locator('.splittable-rect[data-split-state="unsplit"]');
                const nodeToClick = unsplitNodes.first();

                // Click at offset (10, 10) to avoid the central "Import Image" button
                await nodeToClick.click({ position: { x: 10, y: 10 }, force: true });

                try {
                    await expect(page.locator('.splittable-rect[data-split-state="unsplit"]')).toHaveCount(i + 1, { timeout: 3000 });
                } catch (e) {
                    console.error(`Failed to split at step ${i}. Taking screenshot.`);
                    await page.screenshot({ path: `failure-step-${i}.png` });
                    throw e;
                }
            }
        };

        const TARGET_LEAVES = 32;
        await buildTree(TARGET_LEAVES);

        const finalCount = await page.locator('.splittable-rect[data-split-state="unsplit"]').count();
        console.log(`Final leaf nodes count: ${finalCount}`);

        await page.evaluate(() => {
            window._lastLayoutUpdate = 0;
            document.addEventListener('layoutUpdated', () => {
                window._lastLayoutUpdate = performance.now();
            });
        });

        console.log('Measuring re-render time...');
        const firstLeaf = page.locator('.splittable-rect[data-split-state="unsplit"]').first();

        const start = Date.now();
        await firstLeaf.click({ position: { x: 10, y: 10 }, force: true });

        const renderTime = await page.evaluate(async () => {
            return new Promise((resolve) => {
                const check = () => {
                    if (window._lastLayoutUpdate > 0) return resolve(window._lastLayoutUpdate);
                    setTimeout(check, 10);
                };
                check();
                setTimeout(() => resolve(performance.now()), 2000);
            });
        });

        const duration = Date.now() - start;
        console.log(`Full re-render duration (including click interaction) for 32 nodes: ${duration}ms`);
    });

    test('measure drag performance', async ({ page }) => {
        // Build a tree of 16 nodes
        for (let i = 1; i < 16; i++) {
            await page.locator('.splittable-rect[data-split-state="unsplit"]').first().click({ position: { x: 10, y: 10 }, force: true });
            await expect(page.locator('.splittable-rect[data-split-state="unsplit"]')).toHaveCount(i + 1);
        }

        const divider = page.locator('.divider').first();
        const dividerBox = await divider.boundingBox();
        if (!dividerBox) {
            await page.screenshot({ path: 'no-divider.png' });
            throw new Error('Divider not found for drag test');
        }

        await page.evaluate(() => {
            window.frameTimes = [];
            let lastTime = performance.now();
            const track = () => {
                if (!window.isDragging) return;
                window.frameTimes.push(performance.now() - lastTime);
                lastTime = performance.now();
                requestAnimationFrame(track);
            };
            window.isDragging = true;
            requestAnimationFrame(track);
        });

        console.log('Starting drag sequence...');
        await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height / 2);
        await page.mouse.down();
        // Move back and forth 30 times quickly for a better sample
        for (let i = 0; i < 30; i++) {
            await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + 100 + (i % 2 === 0 ? 50 : -50));
            await new Promise(r => setTimeout(r, 16));
        }
        await page.mouse.up();
        await page.evaluate(() => window.isDragging = false);

        const stats = await page.evaluate(() => {
            const count = window.frameTimes.length;
            const avg = count > 0 ? window.frameTimes.reduce((a, b) => a + b, 0) / count : 0;
            const max = count > 0 ? Math.max(...window.frameTimes) : 0;
            return { avg, max, count };
        });
        console.log(`Drag Performance (Baseline - 16 nodes): Avg Frame: ${stats.avg.toFixed(2)}ms, Max Frame (Jank): ${stats.max.toFixed(2)}ms, Samples: ${stats.count}`);
    });
});
