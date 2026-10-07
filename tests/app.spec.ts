import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import Papa from 'papaparse'

const chartCsv = readFileSync(new URL('../public/data/type-chart.csv', import.meta.url), 'utf8')
const typeButton = (page: Page, side: string, index: number) => page.locator(`[data-side="${side}"][data-index="${index}"]`)
const reset = (page: Page) => page.getByRole('button', { name: 'すべての選択を解除', exact: true })

async function load(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.type-button')).toHaveCount(18)
}

async function checkLayout(page: Page): Promise<void> {
  const violations = await page.evaluate(() => {
    const issues: string[] = []
    if (document.documentElement.scrollWidth > window.innerWidth) issues.push('page overflow')
    document.querySelectorAll<HTMLElement>('.type-button, .result-candidate, .result-label, .match-result, .header-actions').forEach(element => {
      const bounds = element.getBoundingClientRect()
      if (bounds.left < -1 || bounds.right > window.innerWidth + 1) issues.push(`viewport: ${element.className}`)
      if (element.scrollWidth > element.clientWidth + 1) issues.push(`content: ${element.className}`)
    })
    document.querySelectorAll<HTMLElement>('.type-name').forEach(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const textBounds = range.getBoundingClientRect()
      const bounds = element.getBoundingClientRect()
      if (textBounds.right > bounds.right + 1 || textBounds.left < bounds.left - 1) issues.push('type text overflow')
    })
    return issues
  })
  expect(violations).toEqual([])
}

test('攻撃のみ：9候補、36組、候補から対戦相性へ', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await load(page)
  await expect(page.locator('.empty-state')).toContainText('未選択')
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(page.locator('[data-multiplier="2"] .result-candidate')).toHaveCount(2)
  await expect(page.locator('[data-multiplier="0.5"] .result-candidate')).toHaveCount(3)
  await page.getByRole('button', { name: '2属性 36', exact: true }).click()
  await expect(page.locator('.result-candidate')).toHaveCount(36)
  for (const value of ['4', '2', '1', '0.5', '0.25']) {
    expect(await page.locator(`[data-multiplier="${value}"] .result-candidate`).count()).toBeGreaterThan(0)
  }
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('dual-candidates.png'), fullPage: true })
  await page.locator('[data-candidate="1,2"]').click()
  await expect(page.locator('.match-score')).toContainText('×4')
  await expect(page.locator('[data-side="defense"][aria-pressed="true"]')).toHaveCount(2)
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('match.png'), fullPage: true })
  expect(errors).toEqual([])
})

test('防御のみ・選択上限・解除・攻撃の置換・5段階', async ({ page }) => {
  await load(page)
  await typeButton(page, 'defense', 1).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await typeButton(page, 'defense', 2).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(typeButton(page, 'defense', 3)).toBeDisabled()
  await expect(typeButton(page, 'defense', 1)).toBeEnabled()
  await expect(page.locator('[data-multiplier="4"] .result-candidate')).toContainText(['氷'])
  await page.getByRole('button', { name: '氷を攻撃に選択', exact: true }).click()
  await expect(page.locator('.match-score')).toContainText('4倍弱点')
  await typeButton(page, 'attack', 1).click()
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(1)
  await typeButton(page, 'attack', 1).click()
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(0)
  await reset(page).click()
  await typeButton(page, 'attack', 0).click()
  for (const [defense, expected] of [
    [[1, 2], '×4'], [[1, 4], '×2'], [[1, 3], '×1'], [[3, 4], '×½'], [[3, 5], '×¼'],
  ] as const) {
    for (const index of defense) await typeButton(page, 'defense', index).click()
    await expect(page.locator('.match-score strong')).toHaveText(expected)
    await page.getByRole('button', { name: '防御の選択を解除', exact: true }).click()
  }
  await page.getByRole('button', { name: '攻撃の選択を解除', exact: true }).click()
  await expect(page.locator('.empty-state')).toBeVisible()
})

test('固定相性表を表示し、CSVのアップロード・ダウンロード操作を表示しない', async ({ page }) => {
  await load(page)
  await expect(page.locator('.attack .type-name')).toHaveText(['氷', '水', '雷', '火', '草', '土', '風', '闇', '光'])
  await expect(page.locator('input[type="file"], [download], [data-action="import"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /CSV/ })).toHaveCount(0)
  await expect(page.locator('#app')).not.toContainText('サンプル')
  await expect(page.locator('#app')).not.toContainText('仮の属性名')
  await typeButton(page, 'attack', 0).click()
  await reset(page).click()
  await expect(page.locator('.empty-state')).toBeVisible()
  await expect(page.locator('input[type="file"], [download], [data-action="import"]')).toHaveCount(0)
})

test('長い属性名・特殊文字・特殊キーを安全に表示', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const names = ['__proto__', 'constructor', 'とても長い名前の防御属性テスト', '<img src=x onerror=alert(1)>', '属性5', '属性6', '属性7', '属性8', '属性9']
  const cells = Papa.parse<string[]>(chartCsv.trim()).data
  cells[0] = ['攻撃/防御', ...names]
  cells.slice(1).forEach((row, index) => { row[0] = names[index] })
  await page.route('**/data/type-chart.csv', route => route.fulfill({ contentType: 'text/csv', body: Papa.unparse(cells) }))
  await load(page)
  await expect(page.locator('.type-button')).toHaveCount(18)
  await expect(page.locator('.type-button img')).toHaveCount(0)
  await typeButton(page, 'attack', 0).click()
  await page.getByRole('button', { name: '2属性 36', exact: true }).click()
  await checkLayout(page)
  await typeButton(page, 'defense', 2).click()
  await typeButton(page, 'defense', 3).click()
  await checkLayout(page)
  expect(errors).toEqual([])
})

test('キーボード操作でフォーカスを維持', async ({ page }) => {
  await load(page)
  await typeButton(page, 'attack', 0).focus()
  await page.keyboard.press('Space')
  await expect(typeButton(page, 'attack', 0)).toBeFocused()
  await expect(typeButton(page, 'attack', 0)).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Space')
  await expect(typeButton(page, 'attack', 0)).toHaveAttribute('aria-pressed', 'false')
  await typeButton(page, 'defense', 0).focus()
  await page.keyboard.press('Enter')
  await expect(typeButton(page, 'defense', 0)).toHaveAttribute('aria-pressed', 'true')
  await expect(typeButton(page, 'defense', 0)).toBeFocused()
})

test('固定相性表の取得失敗を表示し、架空の相性を表示しない', async ({ page }) => {
  await page.route('**/data/type-chart.csv', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('503')
  await expect(page.locator('.type-button')).toHaveCount(0)
  await expect(page.locator('.loading-state')).toContainText('相性表を読み込めませんでした。')
  await expect(page.locator('input[type="file"], [download], [data-action="import"]')).toHaveCount(0)
  await expect(page.locator('.result-candidate, .match-result')).toHaveCount(0)
})

test('設定済みアイコンと画像エラー時の番号フォールバック', async ({ page }) => {
  await page.route('**/src/data/type-icons.ts*', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'export const typeIcons = { "氷": "icons/missing.png", "水": "icons/test.svg" };',
  }))
  await page.route('**/icons/missing.png', route => route.fulfill({ status: 404, body: '' }))
  await page.route('**/icons/test.svg', route => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><rect width="28" height="28" fill="#287ba0"/></svg>',
  }))
  await load(page)
  await expect(typeButton(page, 'attack', 0).locator('img')).toHaveCount(0)
  await expect(typeButton(page, 'attack', 0)).toContainText('01')
  const image = typeButton(page, 'attack', 1).locator('img')
  await expect(image).toBeVisible()
  expect(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
})