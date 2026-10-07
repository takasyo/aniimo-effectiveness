import { describe, expect, it } from 'vitest'
import Papa from 'papaparse'
import chartCsv from '../public/data/type-chart.csv?raw'
import { buildResults, calculateEffectiveness, enumerateDefensePairs, parseChart, stages, toggleSelection } from './type-chart'

const chart = parseChart(chartCsv)
const attack = '氷'

describe('相性計算', () => {
  it.each([
    [['水'], 1.6], [['火'], 0.625], [['草'], 1],
    [['水', '雷'], 2.56], [['水', '草'], 1.6],
    [['水', '火'], 1], [['火', '草'], 0.625],
    [['火', '土'], 0.390625],
  ])('%j → %s', (defense, expected) => {
    expect(calculateEffectiveness(chart, attack, defense as string[])).toBe(expected)
  })
  it('攻撃を行、防御を列として計算する', () => {
    expect(calculateEffectiveness(chart, '水', ['氷'])).toBe(0.625)
    expect(calculateEffectiveness(chart, '氷', ['水'])).toBe(1.6)
  })
  it('全9攻撃×36組で積と一致し、誤差なく5段階に収まる', () => {
    for (const name of chart.names) {
      for (const defense of enumerateDefensePairs(chart.names)) {
        const product = defense.reduce((value, target) => value * chart.rows.get(name)!.get(target)!, 1)
        const result = calculateEffectiveness(chart, name, defense)
        expect(result).toBe(Number(product.toFixed(6)))
        expect(stages).toContain(result)
      }
    }
  })
  it.each([[], ['水', '水'], ['氷', '水', '雷'], ['未知']])('不正な防御 %j を拒否', (...defense) => {
    expect(() => calculateEffectiveness(chart, attack, defense)).toThrow()
  })
})

describe('CSV検証', () => {
  it('9種類を読み込む', () => expect(chart.names).toHaveLength(9))
  it('BOM・CRLF・引用符・行順の変更に対応', () => {
    const cells = Papa.parse<string[]>(chartCsv.trim()).data
    const text = '\uFEFF' + Papa.unparse([cells[0], ...cells.slice(1).reverse()], { quotes: true, newline: '\r\n' })
    expect(parseChart(text)).toEqual(chart)
  })
  it.each(['0', '0.5', '2', '4', '', 'NaN', '16'])('不正な倍率 %s を拒否', value => {
    const cells = Papa.parse<string[]>(chartCsv.trim()).data
    cells[1][1] = value
    expect(() => parseChart(Papa.unparse(cells))).toThrow('倍率')
  })
  it.each(['duplicate-column', 'empty-column', 'unknown-row', 'duplicate-row', 'missing-row', 'extra-column'])('%s を拒否', defect => {
    const cells = Papa.parse<string[]>(chartCsv.trim()).data
    if (defect === 'duplicate-column') cells[0][1] = cells[0][2]
    if (defect === 'empty-column') cells[0][1] = ''
    if (defect === 'unknown-row') cells[1][0] = '未知'
    if (defect === 'duplicate-row') cells[1][0] = cells[2][0]
    if (defect === 'missing-row') cells.pop()
    if (defect === 'extra-column') cells[1].push('1')
    expect(() => parseChart(Papa.unparse(cells))).toThrow()
  })
})

describe('候補一覧', () => {
  it('異なる2属性の36組、順序も重複なし', () => {
    const pairs = enumerateDefensePairs(chart.names)
    expect(pairs).toHaveLength(36)
    expect(new Set(pairs.map(pair => pair.join('|'))).size).toBe(36)
    expect(pairs.every(pair => chart.names.indexOf(pair[0]) < chart.names.indexOf(pair[1]))).toBe(true)
  })
  it('未選択・攻撃のみ・防御のみ・双方選択', () => {
    expect(buildResults(chart, { attack: null, defense: [] })).toEqual([])
    const results = buildResults(chart, { attack, defense: [] })
    expect(results).toHaveLength(45)
    expect(new Set(results.map(result => result.multiplier))).toEqual(new Set(stages))
    expect(buildResults(chart, { attack: null, defense: ['水', '雷'] })).toHaveLength(9)
    expect(buildResults(chart, { attack, defense: ['水', '雷'] })[0].multiplier).toBe(2.56)
  })
  it('全9攻撃で単属性9件と複合属性36組を順序・重複・倍率を保って統合する', () => {
    const candidates = [...chart.names.map(name => [name]), ...enumerateDefensePairs(chart.names)]
    for (const name of chart.names) {
      const results = buildResults(chart, { attack: name, defense: [] })
      expect(results.filter(result => result.names.length === 1)).toHaveLength(9)
      expect(results.filter(result => result.names.length === 2)).toHaveLength(36)
      expect(results.map(result => result.names)).toEqual(candidates)
      expect(new Set(results.map(result => result.names.join('|'))).size).toBe(45)
      for (const result of results) {
        expect(result.multiplier).toBe(calculateEffectiveness(chart, name, result.names))
      }
    }
  })
})

describe('属性選択', () => {
  it('攻撃は置換・再クリックで解除', () => {
    const initial = { attack: null, defense: [] }
    const selected = toggleSelection(initial, 'attack', '属性1')
    expect(toggleSelection(selected, 'attack', '属性2').attack).toBe('属性2')
    expect(toggleSelection(selected, 'attack', '属性1').attack).toBeNull()
  })
  it('防御は最大2つ、解除してから追加可能', () => {
    let selection = toggleSelection({ attack: null, defense: [] }, 'defense', '属性1')
    selection = toggleSelection(selection, 'defense', '属性2')
    expect(toggleSelection(selection, 'defense', '属性3')).toEqual(selection)
    selection = toggleSelection(selection, 'defense', '属性1')
    expect(selection.defense).toEqual(['属性2'])
    expect(toggleSelection(selection, 'defense', '属性3').defense).toEqual(['属性2', '属性3'])
  })
})