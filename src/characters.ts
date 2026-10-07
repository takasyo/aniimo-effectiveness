export type Character = { name: string; form?: string; types: string[] }

export function parseCharacters(data: unknown, typeNames: string[]): Character[] {
  if (!Array.isArray(data)) throw new Error('キャラデータはJSON配列で指定してください。')
  const names = new Set<string>()
  return data.flatMap((record: unknown, index) => {
    const prefix = `キャラデータの${index + 1}件目: `
    if (!record || typeof record !== 'object' || !('name' in record) || typeof record.name !== 'string' || !record.name.trim()) {
      throw new Error(`${prefix}nameには空欄でないキャラ名が必要です。`)
    }
    const name = record.name.trim()
    const addCharacter = (form: unknown, rawTypes: unknown): Character => {
      let normalizedForm: string | undefined
      if (form !== undefined) {
        if (typeof form !== 'string' || !form.trim()) {
          throw new Error(`${prefix}formには空欄でないフォーム名が必要です。`)
        }
        normalizedForm = form.trim()
      }
      const identity = JSON.stringify([name, normalizedForm ?? null])
      if (names.has(identity)) throw new Error(`${prefix}キャラ「${name}${normalizedForm ? `（${normalizedForm}）` : ''}」が重複しています。`)
      if (!Array.isArray(rawTypes) || rawTypes.length < 1 || rawTypes.length > 2) {
        throw new Error(`${prefix}typesには異なる1〜2属性が必要です。`)
      }
      const types = rawTypes.map((value: unknown) => {
        if (typeof value !== 'string' || !typeNames.includes(value.trim())) {
          throw new Error(`${prefix}相性表にない属性です。`)
        }
        return value.trim()
      })
      if (new Set(types).size !== types.length) throw new Error(`${prefix}属性が重複しています。`)
      names.add(identity)
      return { name, ...(normalizedForm ? { form: normalizedForm } : {}), types }
    }

    if ('form' in record && Array.isArray(record.form)) {
      if (!record.form.length) throw new Error(`${prefix}formには1件以上のフォームが必要です。`)
      return record.form.map((form: unknown) => {
        if (!form || typeof form !== 'object' || !('form_name' in form) || !('types' in form)) {
          throw new Error(`${prefix}formにはform_nameとtypesが必要です。`)
        }
        return addCharacter(form.form_name, form.types)
      })
    }

    const form = 'form' in record ? record.form : undefined
    const types = 'types' in record ? record.types : undefined
    return [addCharacter(form, types)]
  })
}

export function characterKey(types: string[], typeNames: string[]): string {
  return types.map(name => typeNames.indexOf(name)).sort((left, right) => left - right).join(',')
}

export function indexCharacters(characters: Character[], typeNames: string[]): Map<string, Character[]> {
  const index = new Map<string, Character[]>()
  for (const character of characters) {
    const key = characterKey(character.types, typeNames)
    const group = index.get(key) ?? []
    group.push(character)
    index.set(key, group)
  }
  return index
}