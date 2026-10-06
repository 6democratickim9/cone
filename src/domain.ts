import type { Calculation, Ingredient, ResultRow } from './types'

export const MIN_ADDITIVE_PERCENT = 0.005
export const MAX_ADDITIVE_PERCENT = 40

export function validateCalculation(target: number, ingredients: Ingredient[]): string | null {
  if (!Number.isFinite(target) || target <= 0) return '목표 총량은 0보다 커야 합니다.'
  if (!ingredients.some((item) => item.kind === 'base' && item.amount > 0)) return '기본 재료를 한 개 이상 입력해 주세요.'
  for (const item of ingredients) {
    if (!item.name.trim()) return '모든 재료의 이름을 입력해 주세요.'
    if (!Number.isFinite(item.amount) || item.amount <= 0) return `${item.name}의 양은 0보다 커야 합니다.`
    if (item.kind === 'additive' && (item.amount < MIN_ADDITIVE_PERCENT || item.amount > MAX_ADDITIVE_PERCENT)) {
      return `Additive는 ${MIN_ADDITIVE_PERCENT}%부터 ${MAX_ADDITIVE_PERCENT}%까지만 입력할 수 있습니다.`
    }
  }
  return null
}

export function calculateRecipe(target: number, ingredients: Ingredient[]) {
  const baseTotal = ingredients.filter((item) => item.kind === 'base').reduce((sum, item) => sum + item.amount, 0)
  const rows: ResultRow[] = ingredients.map((item) => ({
    ...structuredClone(item),
    originalGrams: item.kind === 'base' ? item.amount : baseTotal * item.amount / 100,
    scaledGrams: 0,
  }))
  const originalTotal = rows.reduce((sum, row) => sum + row.originalGrams, 0)
  const scale = originalTotal > 0 ? target / originalTotal : 0
  rows.forEach((row) => { row.scaledGrams = row.originalGrams * scale })
  return { baseTotal, originalTotal, scale, rows }
}

export function createCalculation(target: number, ingredients: Ingredient[]): Calculation {
  const error = validateCalculation(target, ingredients)
  if (error) throw new Error(error)
  const result = calculateRecipe(target, ingredients)
  const now = new Date()
  return {
    id: crypto.randomUUID(), createdAt: now.toISOString(), date: '방금 전',
    title: `${ingredients[0]?.name ?? '새 배합'}${ingredients.length > 1 ? ` 외 ${ingredients.length - 1}종` : ''}`,
    target, ingredients: structuredClone(ingredients), ...result, favorite: false, saved: false,
  }
}

export function matchesCalculation(item: Calculation, query: string) {
  const normalized = query.trim().toLocaleLowerCase('ko')
  if (!normalized) return true
  return [item.title, item.date, ...item.ingredients.map((ingredient) => ingredient.name)]
    .some((value) => value.toLocaleLowerCase('ko').includes(normalized))
}
