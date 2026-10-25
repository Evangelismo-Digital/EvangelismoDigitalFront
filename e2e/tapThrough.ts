import type { Locator, Page } from '@playwright/test'

/**
 * Taps the centre of an element that sits under an overlay (the stretched map
 * link covers each stop), as a finger would. `click({ force: true })` skips the
 * stability check, so a late font swap or scroll could move the stop and send
 * the tap to its neighbour; this waits for the box to stop moving first.
 */
export async function tapThrough(page: Page, target: Locator): Promise<void> {
  await page.evaluate(() => document.fonts.ready)
  await target.scrollIntoViewIfNeeded()

  let box = await target.boundingBox()
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    const next = await target.boundingBox()
    if (box && next && next.x === box.x && next.y === box.y && next.width === box.width && next.height === box.height) {
      break
    }
    box = next
  }
  if (!box) {
    throw new Error('tapThrough: the target has no bounding box')
  }

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}
