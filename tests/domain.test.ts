import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateRecipe, validateCalculation } from '../src/domain.ts'

const ingredients = [
  { id: 1, name: '장석', amount: 3, kind: 'base' as const },
  { id: 2, name: '석회석', amount: 4, kind: 'base' as const },
  { id: 3, name: '규석', amount: 3, kind: 'base' as const },
  { id: 4, name: '아연', amount: 11, kind: 'additive' as const },
]

test('500g 목표량으로 정확하게 환산한다', () => {
  const result = calculateRecipe(500, ingredients)
  assert.equal(result.baseTotal, 10)
  assert.ok(Math.abs(result.originalTotal - 11.1) < 1e-9)
  assert.ok(Math.abs(result.rows.reduce((sum, row) => sum + row.scaledGrams, 0) - 500) < 1e-9)
  assert.ok(Math.abs(result.rows[3].scaledGrams - 49.5495495) < 1e-6)
})

test('Base가 없으면 거부한다', () => {
  assert.match(validateCalculation(100, [{ id: 1, name: '아연', amount: 5, kind: 'additive' }]) ?? '', /기본 재료/)
})

test('Additive 허용 범위를 검증한다', () => {
  assert.match(validateCalculation(100, [...ingredients.slice(0, 1), { id: 5, name: '안료', amount: 41, kind: 'additive' }]) ?? '', /40%/)
})
