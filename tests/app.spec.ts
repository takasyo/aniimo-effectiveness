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
    document.querySelectorAll<HTMLElement>('.type-button, .result-candidate, .result-label, .result-columns, .result-items, .result-column-headings, .match-result, .header-actions, .character-heading, .character-count, .character-names li').forEach(element => {
      const bounds = element.getBoundingClientRect()
      if (bounds.left < -1 || bounds.right > window.innerWidth + 1) issues.push(`viewport: ${element.className}`)
      if (element.scrollWidth > element.clientWidth + 1) issues.push(`content: ${element.className}`)
    })
    document.querySelectorAll<HTMLElement>('.type-name, .result-label > strong, .match-score > strong, .character-heading h2, .character-names li').forEach(element => {
      const range = document.createRange()
      range.selectNodeContents(element)
      const textBounds = range.getBoundingClientRect()
      const bounds = element.getBoundingClientRect()
      if (textBounds.right > bounds.right + 1 || textBounds.left < bounds.left - 1) issues.push('text overflow')
    })
    return issues
  })
  expect(violations).toEqual([])
}

test('攻撃のみ：45候補のキャラ人数と一覧を表示し、条件は変更しない', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://example.com/**', route => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>',
  }))
  await page.route('**/data/characters.json', route => route.fulfill({ json: [
    { name: 'ステラメイジ', icon: 'https://example.com/stella.svg', types: ['闇'] },
    { name: 'ロータスドラゴン', types: ['草', '水'] },
    { name: '複合属性の集計テスト', types: ['水', '草'] },
  ] }))
  await load(page)
  await expect(page.locator('.empty-state')).toContainText('未選択')
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('.result-candidate')).toHaveCount(45)
  await expect(page.locator('.result-total')).toHaveText('45候補')
  await expect(page.locator('.result-candidate:not([data-candidate*=","])')).toHaveCount(9)
  await expect(page.locator('.result-candidate[data-candidate*=","]')).toHaveCount(36)
  await expect(page.locator('.result-column-headings')).toHaveText('単属性複合属性')
  await expect(page.locator('.single-items .result-candidate')).toHaveCount(9)
  await expect(page.locator('.dual-items .result-candidate')).toHaveCount(36)
  await expect(page.locator('.single-items .result-candidate[data-candidate*=","]')).toHaveCount(0)
  await expect(page.locator('.dual-items .result-candidate:not([data-candidate*=","])')).toHaveCount(0)
  const columnsAligned = await page.locator('.result-columns').evaluateAll(columns => columns.every(column => {
    const single = column.querySelector('.single-items')!.getBoundingClientRect()
    const dual = column.querySelector('.dual-items')!.getBoundingClientRect()
    return single.right <= dual.left + 1 && Math.abs(single.top - dual.top) < 1
  }))
  expect(columnsAligned).toBe(true)
  await expect(page.getByRole('group', { name: '防御候補の属性数' })).toHaveCount(0)
  await expect(page.locator('[data-multiplier="1.6"] .result-candidate:not([data-candidate*=","])')).toHaveCount(2)
  await expect(page.locator('[data-multiplier="0.625"] .result-candidate:not([data-candidate*=","])')).toHaveCount(3)
  for (const value of ['2.56', '1.6', '1', '0.625', '0.390625']) {
    const group = page.locator(`[data-multiplier="${value}"]`)
    const count = await group.locator('.result-candidate').count()
    expect(count).toBeGreaterThan(0)
    await expect(group.locator('.group-count')).toHaveText(`${count}件`)
  }
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('combined-candidates.png'), fullPage: true })
  await expect(page.locator('[data-candidate="7"] .character-count')).toHaveText('1体')
  await expect(page.locator('[data-candidate="1,4"] .character-count')).toHaveText('2体')
  await page.locator('[data-candidate="7"]').click()
  await expect(page.locator('.character-names li')).toHaveText(['ステラメイジ'])
  await expect(page.locator('.character-icon')).toHaveAttribute('src', 'https://example.com/stella.svg')
  await expect(page.locator('[data-candidate="7"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-candidate="1,4"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-candidate="1,4"]')).toBeFocused()
  await expect(page.locator('.character-names li')).toHaveText(['ロータスドラゴン', '複合属性の集計テスト'])
  await expect(page.locator('.character-total')).toHaveText('水＋草：2体')
  await expect(page.locator('[data-candidate="7"]')).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.press('Space')
  await expect(page.locator('.character-names li')).toHaveCount(2)
  await expect(page.locator('[data-side="defense"][aria-pressed="true"]')).toHaveCount(0)
  await expect(typeButton(page, 'attack', 0)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.match-score')).toHaveCount(0)
  await expect(page.locator('.result-candidate')).toHaveCount(45)
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('characters.png'), fullPage: true })
  await page.locator('[data-candidate="1"]').click()
  await expect(page.locator('.character-total')).toHaveText('水：0体')
  await expect(page.locator('.character-empty')).toHaveText('該当キャラなし')
  await typeButton(page, 'attack', 1).click()
  await expect(page.locator('.character-list')).toHaveCount(0)
  await page.locator('[data-candidate="7"]').click()
  await reset(page).click()
  await expect(page.locator('.character-list')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('攻撃1・防御1のフィルター：包含する9候補とキャラ閲覧・条件変更', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/characters.json', route => route.fulfill({ json: [
    { name: '氷単属性キャラ', types: ['氷'] },
    { name: '氷水複合キャラ', types: ['水', '氷'] },
    { name: '対象外キャラ', types: ['水'] },
  ] }))
  await load(page)
  await typeButton(page, 'attack', 2).click()
  await typeButton(page, 'defense', 0).click()
  await expect(page.locator('#results-title')).toHaveText('防御属性との相性')
  await expect(page.locator('.result-total')).toHaveText('9候補')
  await expect(page.locator('.match-score')).toHaveCount(0)
  await expect(page.locator('.single-items .result-candidate')).toHaveCount(1)
  await expect(page.locator('.dual-items .result-candidate')).toHaveCount(8)
  const keys = await page.locator('[data-candidate]').evaluateAll(elements => elements.map(element => element.getAttribute('data-candidate')).sort())
  expect(keys).toEqual(['0', ...Array.from({ length: 8 }, (_, index) => `0,${index + 1}`)])
  const cells = Papa.parse<string[]>(chartCsv.trim()).data
  const attackRow = cells.find(row => row[0] === '雷')!
  for (const key of keys) {
    const multiplier = Number(key!.split(',').reduce((value, index) => value * Number(attackRow[Number(index) + 1]), 1).toFixed(6))
    await expect(page.locator(`[data-multiplier="${multiplier}"] [data-candidate="${key}"]`)).toHaveCount(1)
  }
  for (const value of ['2.56', '1.6', '1', '0.625', '0.390625']) {
    const group = page.locator(`[data-multiplier="${value}"]`)
    await expect(group.locator('.group-count')).toHaveText(`${await group.locator('.result-candidate').count()}件`)
  }
  await expect(page.locator('[data-candidate="0"] .character-count')).toHaveText('1体')
  await expect(page.locator('[data-candidate="0,1"] .character-count')).toHaveText('1体')
  await expect(page.locator('.character-names li')).toHaveText(['氷単属性キャラ'])
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('filtered-candidates.png'), fullPage: true })
  await page.locator('[data-candidate="0,1"]').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-candidate="0,1"]')).toBeFocused()
  await expect(page.locator('[data-candidate="0,1"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.character-names li')).toHaveText(['氷水複合キャラ'])
  await expect(page.locator('.character-total')).toHaveText('氷＋水：1体')
  await page.keyboard.press('Space')
  await expect(page.locator('.character-names li')).toHaveText(['氷水複合キャラ'])
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(1)
  await expect(page.locator('[data-side="defense"][aria-pressed="true"]')).toHaveCount(1)
  await expect(typeButton(page, 'attack', 2)).toHaveAttribute('aria-pressed', 'true')
  await expect(typeButton(page, 'defense', 0)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('filtered-characters.png'), fullPage: true })
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(page.locator('.character-names li')).toHaveText(['氷単属性キャラ'])
  await expect(page.locator('[data-candidate][aria-pressed="true"]')).toHaveCount(0)
  await typeButton(page, 'defense', 1).click()
  await expect(page.locator('.match-score strong')).toHaveText('×1')
  await expect(page.locator('.result-candidate')).toHaveCount(0)
  await expect(page.locator('.character-names li')).toHaveText(['氷水複合キャラ'])
  await typeButton(page, 'defense', 0).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(page.locator('.single-items .type-name')).toHaveText(['水'])
  await expect(page.locator('.character-names li')).toHaveText(['対象外キャラ'])
  await page.getByRole('button', { name: '攻撃の選択を解除', exact: true }).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(page.locator('button.result-candidate')).toHaveCount(0)
  await typeButton(page, 'attack', 2).click()
  await page.locator('[data-candidate="0,1"]').click()
  await page.getByRole('button', { name: '防御の選択を解除', exact: true }).click()
  await expect(page.locator('.result-candidate')).toHaveCount(45)
  await expect(page.locator('.character-list')).toHaveCount(0)
  await typeButton(page, 'defense', 0).click()
  await page.locator('[data-candidate="0,1"]').click()
  await reset(page).click()
  await expect(page.locator('.empty-state')).toBeVisible()
  await expect(page.locator('.character-list')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('防御のみ・選択上限・解除・攻撃の置換・5段階', async ({ page }, testInfo) => {
  await load(page)
  await typeButton(page, 'defense', 1).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await typeButton(page, 'defense', 2).click()
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await expect(typeButton(page, 'defense', 3)).toBeDisabled()
  await expect(typeButton(page, 'defense', 1)).toBeEnabled()
  await expect(page.locator('[data-multiplier="2.56"] .result-candidate')).toContainText(['氷'])
  await expect(page.locator('button.result-candidate')).toHaveCount(0)
  await page.locator('[data-multiplier="2.56"] .result-candidate').click()
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(0)
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('.match-score')).toContainText('重複弱点')
  await typeButton(page, 'attack', 1).click()
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(1)
  await typeButton(page, 'attack', 1).click()
  await expect(page.locator('[data-side="attack"][aria-pressed="true"]')).toHaveCount(0)
  await reset(page).click()
  await typeButton(page, 'attack', 0).click()
  for (const [defense, expected] of [
    [[1, 2], '×2.56'], [[1, 4], '×1.6'], [[1, 3], '×1'], [[3, 4], '×0.625'], [[3, 5], '×0.390625'],
  ] as const) {
    for (const index of defense) await typeButton(page, 'defense', index).click()
    await expect(page.locator('.match-score strong')).toHaveText(expected)
    await checkLayout(page)
    if (expected === '×0.390625') await page.screenshot({ path: testInfo.outputPath('double-resistance.png'), fullPage: true })
    await page.getByRole('button', { name: '防御の選択を解除', exact: true }).click()
  }
  await page.getByRole('button', { name: '攻撃の選択を解除', exact: true }).click()
  await expect(page.locator('.empty-state')).toBeVisible()
})

test('手動で選択した防御属性のキャラを両モードで表示し、解除する', async ({ page }, testInfo) => {
  const longName = '<img src=x onerror=alert(1)> とても長いキャラ名の表示テスト'.repeat(3)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/data/characters.json', route => route.fulfill({ json: [
    { name: 'ステラメイジ', types: ['闇'] },
    { name: 'ロータスドラゴン', types: ['水', '草'] },
    { name: longName, types: ['草', '水'] },
  ] }))
  await load(page)
  await typeButton(page, 'defense', 7).click()
  await expect(page.locator('.character-names li')).toHaveText(['ステラメイジ'])
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('button.result-candidate')).toHaveCount(9)
  await expect(page.locator('.match-score')).toHaveCount(0)
  await expect(page.locator('.character-names li')).toHaveText(['ステラメイジ'])
  await typeButton(page, 'defense', 7).click()
  await expect(page.locator('.character-list')).toHaveCount(0)
  await page.locator('[data-candidate="7"]').click()
  await typeButton(page, 'defense', 4).click()
  await expect(page.locator('#character-title')).toHaveText('草のキャラ')
  await expect(page.locator('.character-empty')).toHaveText('該当キャラなし')
  await typeButton(page, 'defense', 1).click()
  await expect(page.locator('.character-total')).toHaveText('草＋水：2体')
  await expect(page.locator('.character-names li')).toHaveText(['ロータスドラゴン', longName])
  await expect(page.locator('#character-list img')).toHaveCount(0)
  await checkLayout(page)
  await page.getByRole('button', { name: '攻撃の選択を解除', exact: true }).click()
  await expect(page.locator('.character-names li')).toHaveCount(2)
  await expect(page.locator('.result-candidate')).toHaveCount(9)
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('manual-defense-characters.png'), fullPage: true })
  await page.getByRole('button', { name: '防御の選択を解除', exact: true }).click()
  await expect(page.locator('.character-list')).toHaveCount(0)
  await expect(page.locator('.empty-state')).toBeVisible()
  expect(errors).toEqual([])
})

test('キャラのフォームを表示し、同名のフォーム違いを別々に集計する', async ({ page }, testInfo) => {
  const longForm = 'とても長いフォーム名の表示テスト<img src=x onerror=alert(1)>'.repeat(3)
  await page.route('**/data/characters.json', route => route.fulfill({ json: [
    { name: 'ステラメイジ', form: [{ form_name: '基本', types: ['闇'] }] },
    { name: 'ロータウス', form: [
      { form_name: '基本', types: ['水', '草'] },
      { form_name: '虹色', types: ['水', '光'] },
      { form_name: longForm, types: ['草', '水'] },
    ] },
  ] }))
  await load(page)
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('[data-candidate="7"] .character-count')).toHaveText('1体')
  await expect(page.locator('[data-candidate="1,4"] .character-count')).toHaveText('2体')
  await expect(page.locator('[data-candidate="1,8"] .character-count')).toHaveText('1体')
  await page.locator('[data-candidate="7"]').click()
  await expect(page.locator('.character-names li')).toHaveText(['ステラメイジ（基本）'])
  await page.locator('[data-candidate="1,8"]').click()
  await expect(page.locator('.character-names li')).toHaveText(['ロータウス（虹色）'])
  await page.locator('[data-candidate="1,4"]').click()
  await expect(page.locator('.character-names li')).toHaveText(['ロータウス（基本）', `ロータウス（${longForm}）`])
  await expect(page.locator('#character-list img')).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  await checkLayout(page)
  await page.screenshot({ path: testInfo.outputPath('character-forms.png'), fullPage: true })
  await typeButton(page, 'defense', 8).click()
  await typeButton(page, 'defense', 1).click()
  await expect(page.locator('.character-names li')).toHaveText(['ロータウス（虹色）'])
})

test('キャラ情報の読込み中も相性計算を利用できる', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>(resolve => { release = resolve })
  await page.route('**/data/characters.json', async route => {
    await pending
    await route.fulfill({ json: [{ name: 'ステラメイジ', types: ['闇'] }] })
  })
  try {
    await load(page)
    await typeButton(page, 'attack', 0).click()
    await expect(page.locator('[data-candidate="7"] .character-count')).toHaveText('読込み中')
    await page.locator('[data-candidate="7"]').click()
    await expect(page.locator('.character-empty')).toContainText('読み込み中')
    release()
    await expect(page.locator('.character-names li')).toHaveText(['ステラメイジ'])
    await expect(page.locator('[data-candidate="7"]')).toBeFocused()
    await expect(page.locator('[data-side="defense"][aria-pressed="true"]')).toHaveCount(0)
  } finally {
    release()
  }
})

for (const failure of [
  { name: '503', status: 503, body: 'Unavailable' },
  { name: '404', status: 404, body: 'Not found' },
  { name: 'JSON構文不正', status: 200, body: '{' },
  { name: '未知属性', status: 200, body: JSON.stringify([{ name: 'キャラ', types: ['未知'] }]) },
]) {
  test(`キャラ情報の${failure.name}を0体と区別し、相性計算を維持`, async ({ page }) => {
    await page.route('**/data/characters.json', route => route.fulfill({ status: failure.status, body: failure.body, contentType: 'application/json' }))
    await load(page)
    await expect(page.getByRole('alert')).toContainText('キャラ情報')
    await typeButton(page, 'attack', 0).click()
    await expect(page.locator('.result-candidate')).toHaveCount(45)
    await expect(page.locator('[data-candidate="7"] .character-count')).toHaveText('取得不可')
    await page.locator('[data-candidate="7"]').click()
    await expect(page.locator('.character-empty')).toContainText('取得できませんでした')
    await expect(page.locator('.character-total')).not.toContainText('0体')
    await typeButton(page, 'defense', 1).click()
    await expect(page.locator('.result-candidate')).toHaveCount(9)
    await expect(page.locator('[data-multiplier="1.6"] [data-candidate="1"]')).toHaveCount(1)
    await expect(page.locator('[data-candidate="1"] .character-count')).toHaveText('取得不可')
    await expect(page.locator('.character-total')).toHaveText('水：取得不可')
  })
}

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
  await page.route('**/data/characters.json', route => route.fulfill({ json: [] }))
  await page.route('**/data/type-chart.csv', route => route.fulfill({ contentType: 'text/csv', body: Papa.unparse(cells) }))
  await load(page)
  await expect(page.locator('.type-button')).toHaveCount(18)
  await expect(page.locator('.type-button img')).toHaveCount(0)
  await typeButton(page, 'attack', 0).click()
  await expect(page.locator('.result-candidate')).toHaveCount(45)
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