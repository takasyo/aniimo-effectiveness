import './style.css'
import { createIcons, RotateCcw, ArrowRight, Swords, Shield, X } from 'lucide'
import { buildResults, parseChart, stages, toggleSelection } from './type-chart'
import type { Effectiveness, Selection, TypeChart } from './type-chart'
import { typeIcons } from './data/type-icons'
import { characterKey, indexCharacters, parseCharacters } from './characters'
import type { Character } from './characters'

const app = document.querySelector<HTMLDivElement>('#app')!
let chart: TypeChart | null = null
let selection: Selection = { attack: null, defense: [] }
let viewedDefense: string[] = []
let characters: Map<string, Character[]> | null = null
let characterError = ''
let loading = true
let error = ''
const labels: Record<Effectiveness, string> = { 2.56: '重複弱点', 1.6: '弱点', 1: '等倍', 0.625: '耐性', 0.390625: '重複耐性' }
const palette = ['#ba4545', '#287ba0', '#b07d14', '#40805a', '#ad5791', '#467fa2', '#687043', '#8b649e', '#636d7d']
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const multiplierText = (value: Effectiveness) => `×${value}`

function marker(name: string): string {
  const index = chart!.names.indexOf(name)
  const url = Object.hasOwn(typeIcons, name) ? typeIcons[name] : ''
  return `<span class="type-marker" style="--type-color:${palette[index]}" aria-hidden="true"><span>${String(index + 1).padStart(2, '0')}</span>${url ? `<img src="${escape(url)}" alt="" />` : ''}</span>`
}

function typeBadge(name: string): string {
  return `${marker(name)}<span class="type-name">${escape(name)}</span>`
}

function matchingCharacters(names: string[]): Character[] {
  return characters?.get(characterKey(names, chart!.names)) ?? []
}

function characterCount(names: string[]): string {
  return characterError ? '取得不可' : characters ? `${matchingCharacters(names).length}体` : '読込み中'
}

function characterList(): string {
  const names = viewedDefense.length ? viewedDefense : selection.defense
  if (!names.length) return '<div id="character-list"></div>'
  const matches = matchingCharacters(names)
  const content = characterError ? '<p class="character-empty">キャラ情報を取得できませんでした。</p>'
    : !characters ? '<p class="character-empty">キャラ情報を読み込み中…</p>'
    : matches.length ? `<ul class="character-names">${matches.map(character => `<li>${character.icon ? `<img class="character-icon" src="${escape(character.icon)}" alt="" aria-hidden="true">` : ''}<span>${escape(character.name)}${character.form ? `（${escape(character.form)}）` : ''}</span></li>`).join('')}</ul>`
    : '<p class="character-empty">該当キャラなし</p>'
  return `<section id="character-list" class="character-list" aria-labelledby="character-title"><div class="character-heading"><h2 id="character-title">${escape(names.join('＋'))}のキャラ</h2><span class="character-total" role="status" aria-live="polite">${escape(names.join('＋'))}：${characterCount(names)}</span></div>${content}</section>`
}

function selector(side: 'attack' | 'defense'): string {
  const attack = side === 'attack'
  const chosen = attack ? (selection.attack ? [selection.attack] : []) : selection.defense
  return `<section class="selector ${side}" aria-labelledby="${side}-title">
    <div class="section-heading"><div class="side-label"><i data-lucide="${attack ? 'swords' : 'shield'}"></i><h2 id="${side}-title">${attack ? '攻撃' : '防御'}</h2><span class="capacity">${chosen.length} / ${attack ? 1 : 2}</span></div>
      <button class="icon-button" data-action="clear-${side}" data-focus="clear-${side}" title="${attack ? '攻撃' : '防御'}の選択を解除" aria-label="${attack ? '攻撃' : '防御'}の選択を解除" ${!chosen.length ? 'disabled' : ''}><i data-lucide="x"></i></button></div>
    <div class="type-grid">${chart!.names.map((name, index) => {
      const selected = chosen.includes(name)
      const disabled = !attack && !selected && chosen.length === 2
      return `<button class="type-button" data-side="${side}" data-index="${index}" data-focus="${side}-${index}" aria-pressed="${selected}" ${disabled ? 'disabled' : ''}>${typeBadge(name)}<span class="selection-dot" aria-hidden="true"></span></button>`
    }).join('')}</div>
  </section>`
}

function results(): string {
  const entries = buildResults(chart!, selection)
  const exactMatch = !!selection.attack && selection.defense.length === 2
  const defenseCandidates = !!selection.attack && !exactMatch
  const heading = exactMatch ? '対戦相性' : defenseCandidates ? '防御属性との相性' : selection.defense.length ? '攻撃属性との相性' : '相性'
  let content = ''
  if (!entries.length) {
    content = '<div class="empty-state"><i data-lucide="swords"></i><span>未選択</span><span class="empty-value">—</span></div>'
  } else if (exactMatch) {
    const value = entries[0].multiplier
    content = `<div class="match-result stage-${stages.indexOf(value)}"><div class="match-types"><span class="type-chip">${typeBadge(selection.attack!)}</span><i data-lucide="arrow-right"></i><div class="defense-chips">${selection.defense.map(name => `<span class="type-chip">${typeBadge(name)}</span>`).join('<span class="plus">+</span>')}</div></div><div class="match-score"><strong>${multiplierText(value)}</strong><span>${labels[value]}</span></div></div>`
  } else {
    const candidateItems = (candidates: typeof entries): string => candidates.map(entry => {
      const key = characterKey(entry.names, chart!.names)
      const badges = entry.names.map(name => `<span class="candidate-type">${typeBadge(name)}</span>`).join('<span class="plus">+</span>')
      if (!defenseCandidates) return `<span class="result-candidate">${badges}</span>`
      const count = characterCount(entry.names)
      const selected = viewedDefense.length > 0 && characterKey(viewedDefense, chart!.names) === key
      return `<button class="result-candidate" data-candidate="${key}" data-focus="candidate-${key}" aria-label="${escape(entry.names.join('・'))}のキャラ：${count}" aria-pressed="${selected}" aria-controls="character-list">${badges}<span class="character-count">${count}</span></button>`
    }).join('') || '<span class="no-items">—</span>'
    content = `<div class="result-groups${defenseCandidates ? ' split-results' : ''}">${defenseCandidates ? '<div class="result-column-headings"><span>単属性</span><span>複合属性</span></div>' : ''}${stages.map((value, stage) => {
      const group = entries.filter(entry => entry.multiplier === value)
      const items = defenseCandidates
        ? `<div class="result-columns"><div class="result-items single-items" role="group" aria-label="単属性">${candidateItems(group.filter(entry => entry.names.length === 1))}</div><div class="result-items dual-items" role="group" aria-label="複合属性">${candidateItems(group.filter(entry => entry.names.length === 2))}</div></div>`
        : `<div class="result-items">${candidateItems(group)}</div>`
      return `<section class="result-row stage-${stage}" data-multiplier="${value}" aria-label="${labels[value]}"><div class="result-label"><strong>${multiplierText(value)}</strong><div><h3>${labels[value]}</h3><span class="group-count">${group.length}件</span></div></div>${items}</section>`
    }).join('')}</div>`
  }
  return `<section class="results" aria-labelledby="results-title"><div class="results-heading"><h2 id="results-title">${heading}</h2><span class="result-total" role="status" aria-live="polite">${exactMatch ? labels[entries[0].multiplier] : entries.length ? `${entries.length}候補` : ''}</span></div>${content}${characterList()}</section>`
}

function render(): void {
  const focus = (document.activeElement as HTMLElement | null)?.dataset.focus
  app.innerHTML = `<header class="app-header"><div class="brand"><span class="brand-symbol" aria-hidden="true">9</span><div><p class="eyebrow">ANIIMO TYPE EFFECTIVENESS</p><h1>アニモ属性相性</h1></div></div><div class="header-actions"><button class="icon-button" data-action="reset" data-focus="reset" ${!selection.attack && !selection.defense.length ? 'disabled' : ''} title="すべての選択を解除" aria-label="すべての選択を解除"><i data-lucide="rotate-ccw"></i></button></div></header>
    <div class="dataset-bar"><span class="dataset-status">相性表</span><span class="dataset-name">${chart ? escape(chart.names.join(' / ')) : ''}</span><span class="dataset-meta">9属性</span></div>
    ${error ? `<div class="error" role="alert">${escape(error)}</div>` : ''}
    ${characterError ? `<div class="error" role="alert">${escape(characterError)}</div>` : ''}
    <main>${chart ? `<div class="selectors">${selector('attack')}${selector('defense')}</div>${results()}` : `<div class="loading-state" role="status">${loading ? '相性表を読み込み中…' : '相性表を読み込めませんでした。'}</div>`}</main>
    <footer><span>TYPE MATCH / 9</span></footer>`
  createIcons({ icons: { RotateCcw, ArrowRight, Swords, Shield, X }, attrs: { 'aria-hidden': 'true', 'stroke-width': 1.7 } })
  app.querySelectorAll<HTMLImageElement>('.type-marker img, .character-icon').forEach(image => {
    image.addEventListener('error', () => image.remove(), { once: true })
  })
  if (focus) app.querySelectorAll<HTMLElement>('[data-focus]').forEach(element => {
    if (element.dataset.focus === focus) element.focus({ preventScroll: true })
  })
}

app.addEventListener('click', event => {
  const button = (event.target as Element).closest<HTMLButtonElement>('button')
  if (!button || button.disabled) return
  const action = button.dataset.action
  if (!chart) return
  if (action || button.dataset.side) viewedDefense = []
  if (action === 'reset') selection = { attack: null, defense: [] }
  if (action === 'clear-attack') selection = { ...selection, attack: null }
  if (action === 'clear-defense') selection = { ...selection, defense: [] }
  const side = button.dataset.side
  if (side === 'attack' || side === 'defense') {
    selection = toggleSelection(selection, side, chart.names[Number(button.dataset.index)])
  }
  if (button.dataset.candidate !== undefined) {
    viewedDefense = button.dataset.candidate.split(',').map(index => chart!.names[Number(index)])
  }
  render()
})

async function initialize(): Promise<void> {
  render()
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/type-chart.csv`)
    if (!response.ok) throw new Error(`相性表を取得できませんでした（${response.status}）。`)
    chart = parseChart(await response.text())
  } catch (caught) {
    error = caught instanceof Error ? caught.message : '相性表を読み込めませんでした。'
  } finally {
    loading = false
    render()
  }
  if (!chart) return
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}data/characters.json`)
    if (!response.ok) throw new Error(`キャラ情報を取得できませんでした（${response.status}）。`)
    characters = indexCharacters(parseCharacters(await response.json(), chart.names), chart.names)
  } catch (caught) {
    characterError = caught instanceof Error ? `キャラ情報の読込みエラー：${caught.message}` : 'キャラ情報を読み込めませんでした。'
  } finally {
    render()
  }
}

void initialize()