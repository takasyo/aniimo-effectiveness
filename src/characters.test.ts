import { describe, expect, it } from 'vitest'
import { characterKey, indexCharacters, parseCharacters } from './characters'

const types = ['氷', '水', '雷', '火', '草', '土', '風', '闇', '光']

describe('キャラデータ', () => {
  it('単属性と複合属性を順序不問の完全一致で集計し、記載順を維持する', () => {
    const characters = parseCharacters([
      { name: 'ステラメイジ', types: ['闇'] },
      { name: 'ロータスドラゴン', types: ['草', '水'] },
      { name: '複合属性テスト', types: ['水', '草'] },
    ], types)
    const index = indexCharacters(characters, types)
    expect(index.get(characterKey(['闇'], types))?.map(character => character.name)).toEqual(['ステラメイジ'])
    expect(index.get(characterKey(['水', '草'], types))?.map(character => character.name)).toEqual(['ロータスドラゴン', '複合属性テスト'])
    expect(characterKey(['水', '草'], types)).toBe(characterKey(['草', '水'], types))
    expect(index.get(characterKey(['水'], types)) ?? []).toEqual([])
    expect(index.get(characterKey(['草'], types)) ?? []).toEqual([])
    expect(index.get(characterKey(['闇', '光'], types)) ?? []).toEqual([])
  })
  it('空配列と前後の空白に対応する', () => {
    expect(indexCharacters(parseCharacters([], types), types).size).toBe(0)
    expect(parseCharacters([{ name: ' ステラメイジ ', types: [' 闇 '] }], types)).toEqual([{ name: 'ステラメイジ', types: ['闇'] }])
  })
  it('同名の異なるフォームを個別に集計する', () => {
    const characters = parseCharacters([
      { name: 'ロータウス', form: [
        { form_name: ' 基本 ', types: ['水', '草'] },
        { form_name: '虹色', types: ['水', '光'] },
      ] },
      { name: 'ロータウス', form: '集計テスト', types: ['草', '水'] },
    ], types)
    const index = indexCharacters(characters, types)
    expect(index.get(characterKey(['水', '草'], types))?.map(character => character.form)).toEqual(['基本', '集計テスト'])
    expect(index.get(characterKey(['光', '水'], types))?.map(character => character.form)).toEqual(['虹色'])
    expect(characters[0]).toEqual({ name: 'ロータウス', form: '基本', types: ['水', '草'] })
  })
  it('新しいフォーム配列形式の各フォームを順番どおりに展開する', () => {
    expect(parseCharacters([
      { name: 'ステラメイジ', form: [{ form_name: '基本', types: ['闇'] }] },
      { name: 'ロータウス', form: [
        { form_name: '基本', types: ['水', '草'] },
        { form_name: '虹色', types: ['水', '光'] },
      ] },
    ], types)).toEqual([
      { name: 'ステラメイジ', form: '基本', types: ['闇'] },
      { name: 'ロータウス', form: '基本', types: ['水', '草'] },
      { name: 'ロータウス', form: '虹色', types: ['水', '光'] },
    ])
  })
  it('属性名の区切り記号や特殊キーを安全に扱う', () => {
    const names = ['__proto__', '水,草', '水', '草']
    const index = indexCharacters(parseCharacters([{ name: '<キャラ>', types: ['水,草'] }], names), names)
    expect(index.get(characterKey(['水,草'], names))).toHaveLength(1)
    expect(index.get(characterKey(['水', '草'], names))).toBeUndefined()
  })
  it.each([
    null, {}, 'invalid', [null], [{ types: ['闇'] }], [{ name: 1, types: ['闇'] }],
    [{ name: ' ', types: ['闇'] }], [{ name: 'キャラ' }], [{ name: 'キャラ', types: '闇' }],
    [{ name: 'キャラ', types: [] }], [{ name: 'キャラ', types: ['水', '草', '闇'] }],
    [{ name: 'キャラ', types: ['水', ' 水 '] }], [{ name: 'キャラ', types: ['未知'] }],
    [{ name: 'キャラ', types: [1] }],
    [{ name: 'キャラ', types: ['闇'] }, { name: ' キャラ ', types: ['水'] }],
    [{ name: 'キャラ', form: '', types: ['闇'] }],
    [{ name: 'キャラ', form: ' ', types: ['闇'] }],
    [{ name: 'キャラ', form: 1, types: ['闇'] }],
    [{ name: 'キャラ', form: null, types: ['闇'] }],
    [{ name: 'キャラ', form: [] }],
    [{ name: 'キャラ', form: [{ form_name: '基本', types: [] }] }],
    [{ name: 'キャラ', form: [{ form_name: '', types: ['闇'] }] }],
    [{ name: 'キャラ', form: '基本', types: ['闇'] }, { name: ' キャラ ', form: ' 基本 ', types: ['水'] }],
    [{ name: 'キャラ', form: [{ form_name: '基本', types: ['闇'] }, { form_name: ' 基本 ', types: ['水'] }] }],
  ].map(data => ({ data })))('不正なデータ %# を拒否する', ({ data }) => {
    expect(() => parseCharacters(data, types)).toThrow()
  })
})