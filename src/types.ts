export type IngredientKind = 'base' | 'additive'

export type MaterialSnapshot = {
  materialId?: string
  version?: string
  genericName: string
  productName?: string
  manufacturer?: string
  supplier?: string
  region?: string
  formula?: string
  source?: string
  verification: '확인됨' | '사용자 입력' | '대표값' | '미확인'
}

export type Ingredient = {
  id: number
  name: string
  amount: number
  kind: IngredientKind
  snapshot?: MaterialSnapshot
}

export type ResultRow = Ingredient & { originalGrams: number; scaledGrams: number }

export type Calculation = {
  id: string
  createdAt: string
  date: string
  title: string
  target: number
  ingredients: Ingredient[]
  baseTotal: number
  originalTotal: number
  scale: number
  rows: ResultRow[]
  favorite: boolean
  saved: boolean
}

export type Material = MaterialSnapshot & {
  id: string
  kind: IngredientKind
  custom: boolean
  lastUsedAt?: string
  useCount?: number
}

export type PhotoAttachment = { id: string; name: string; type: string; size: number; data?: string }

export type FiringTest = {
  id: string
  recipeId: string
  name: string
  date: string
  clay: string
  thickness: string
  peakTemperature: number
  atmosphere: '산화' | '환원' | '기타'
  kiln: string
  durationHours: number
  notes: string
  photos: PhotoAttachment[]
}

export type ConeBackup = {
  schemaVersion: 1 | 2
  exportedAt: string
  calculations: Calculation[]
  materials: Material[]
  firingTests: FiringTest[]
}
