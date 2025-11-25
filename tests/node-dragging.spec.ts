import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('can drag nodes on the graph', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h2:has-text("Welcome to RaptorGraph")')).toBeVisible()

  // Upload CSV
  await page.locator('aside nav button').first().click()
  await expect(page.locator('h2:has-text("Upload CSV")')).toBeVisible()

  const filePath = path.join(__dirname, 'fixtures', 'sample-nodes.csv')
  await page.locator('input[type="file"]').setInputFiles(filePath)

  await page.waitForTimeout(1000)
  await expect(page.locator('text=sample-nodes.csv').first()).toBeVisible()

  // Configure mapping
  await page.locator('button:has-text("Configure Mapping")').click()
  await page.waitForTimeout(1000)
  await expect(page.locator('text=Column Mapping Wizard')).toBeVisible()

  // Confirm mapping
  const confirmButton = page.locator('button:has-text("Confirm Mapping")')
  await expect(confirmButton).toBeVisible()
  await confirmButton.click()

  // Wait for processing
  await page.waitForTimeout(3000)

  // Verify canvas is visible
  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()

  // Verify nodes were created
  const nodeCountElement = page.locator('span:has-text("nodes")').first()
  await expect(nodeCountElement).toBeVisible()

  // Get canvas bounding box
  const box = await canvas.boundingBox()
  if (!box) {
    throw new Error('Canvas not found')
  }

  // Calculate center of canvas where nodes are likely to be
  const centerX = box.x + box.width / 2
  const centerY = box.y + box.height / 2

  console.log('Canvas center:', centerX, centerY)

  // Try dragging from center
  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 100, centerY + 50, { steps: 10 })
  await page.mouse.up()

  console.log('Drag operation completed')

  // Take screenshot after drag
  await page.screenshot({ path: 'test-results/after-drag.png' })

  // Verify cursor changes to grab/grabbing (check computed style)
  const cursorStyle = await canvas.evaluate((el) => {
    return window.getComputedStyle(el).cursor
  })
  console.log('Canvas cursor style:', cursorStyle)
  expect(cursorStyle).toMatch(/grab/)
})
