import Papa from 'papaparse'

export type BaseMultiplier = 0.5 | 1 | 2
export type Effectiveness = 0.25 | BaseMultiplier | 4
export type TypeChart = {
  names: string[]
  rows: Map<string, Map<string, BaseMultiplier>>
}
export type Selection = { attack: string | null; defense: string[] }
export type Result = { names: string[]; multiplier: Effectiveness }
export const stages: Effectiveness[] = [4, 2, 1, 0.5, 0.25]

export function parseChart(csv: string): TypeChart {
  const parsed = Papa.parse<string[]>(csv.replace(/^\uFEFF/, ''), {
    skipEmptyLines: 'greedy',
  })
  if (parsed.errors.length) throw new Error('CSVの書式が不正です。引用符や区切りを確認してください。')
  const cells = parsed.data.map(row => row.map(cell => cell.trim()))
  if (cells.length !== 10 || cells.some(row => row.length !== 10)) {
    throw new Error('見出しを含めて10行×10列のCSVが必要です（相性は9×9）。')
  }
  const names = cells[0].slice(1)
  if (names.some(name => !name) || new Set(names).size !== 9) {
    throw new Error('防御の属性名は、空欄や重複のない9種類にしてください。')
  }
  const rowNames = cells.slice(1).map(row => row[0])
  if (new Set(rowNames).size !== 9 || rowNames.some(name => !names.includes(name))) {
    throw new Error('攻撃と防御には、同じ9種類の属性名を重複なく指定してください。')
  }
  const rows: TypeChart['rows'] = new Map()
  for (const row of cells.slice(1)) {
    const values = new Map<string, BaseMultiplier>()
    names.forEach((name, index) => {
      const value = row[index + 1]
      if (!['0.5', '1', '2'].includes(value)) {
        throw new Error(`${row[0]} → ${name}: 倍率は0.5・1・2のいずれかにしてください。`)
      }
      values.set(name, Number(value) as BaseMultiplier)
    })
    rows.set(row[0], values)
  }
  return { names, rows }
}

export function calculateEffectiveness(chart: TypeChart, attack: string, defense: string[]): Effectiveness {
  if (defense.length < 1 || defense.length > 2 || new Set(defense).size !== defense.length) {
    throw new Error('防御は異なる1〜2属性を指定してください。')
  }
  let product = 1
  for (const name of defense) {
    const value = chart.rows.get(attack)?.get(name)
    if (value === undefined) throw new Error('相性表にない属性です。')
    product *= value
  }
  return product as Effectiveness
}

export function enumerateDefensePairs(names: string[]): string[][] {
  return names.flatMap((name, index) => names.slice(index + 1).map(other => [name, other]))
}

export function buildResults(chart: TypeChart, selection: Selection, dual: boolean): Result[] {
  const { attack, defense } = selection
  if (attack && defense.length) {
    return [{ names: defense, multiplier: calculateEffectiveness(chart, attack, defense) }]
  }
  if (attack) {
    const candidates = dual ? enumerateDefensePairs(chart.names) : chart.names.map(name => [name])
    return candidates.map(names => ({ names, multiplier: calculateEffectiveness(chart, attack, names) }))
  }
  if (defense.length) {
    return chart.names.map(name => ({ names: [name], multiplier: calculateEffectiveness(chart, name, defense) }))
  }
  return []
}

export function toggleSelection(selection: Selection, side: 'attack' | 'defense', name: string): Selection {
  if (side === 'attack') return { ...selection, attack: selection.attack === name ? null : name }
  if (selection.defense.includes(name)) {
    return { ...selection, defense: selection.defense.filter(value => value !== name) }
  }
  if (selection.defense.length === 2) return selection
  return { ...selection, defense: [...selection.defense, name] }
}