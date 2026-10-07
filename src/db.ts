import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import type { Calculation, ConeBackup, FiringTest, Material } from './types'

const DB_NAME = 'cone-local'
const DB_VERSION = 1
const STORES = ['calculations', 'materials', 'firingTests'] as const
type StoreName = typeof STORES[number]

function openIndexedDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      for (const store of STORES) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function indexedTransaction<T>(storeName: StoreName, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openIndexedDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

const sqlite = new SQLiteConnection(CapacitorSQLite)
let nativeConnection: Promise<SQLiteDBConnection> | undefined

async function openNativeDatabase() {
  if (!nativeConnection) {
    nativeConnection = (async () => {
      const existing = await sqlite.isConnection(DB_NAME, false)
      const db = existing.result
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)
      await db.open()
      await db.execute(`
        CREATE TABLE IF NOT EXISTS cone_records (
          bucket TEXT NOT NULL,
          id TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (bucket, id)
        );
      `)
      return db
    })().catch((error) => {
      nativeConnection = undefined
      throw error
    })
  }
  return nativeConnection
}

async function all<T>(store: StoreName): Promise<T[]> {
  if (!Capacitor.isNativePlatform()) return indexedTransaction<T[]>(store, 'readonly', (objectStore) => objectStore.getAll())
  const db = await openNativeDatabase()
  const result = await db.query('SELECT payload FROM cone_records WHERE bucket = ? ORDER BY rowid DESC', [store])
  return (result.values ?? []).map((row) => JSON.parse(String(row.payload)) as T)
}

async function put<T extends { id: string }>(store: StoreName, value: T) {
  if (!Capacitor.isNativePlatform()) return indexedTransaction(store, 'readwrite', (objectStore) => objectStore.put(value))
  const db = await openNativeDatabase()
  await db.run('INSERT OR REPLACE INTO cone_records (bucket, id, payload) VALUES (?, ?, ?)', [store, value.id, JSON.stringify(value)])
}

async function remove(store: StoreName, id: string) {
  if (!Capacitor.isNativePlatform()) return indexedTransaction(store, 'readwrite', (objectStore) => objectStore.delete(id))
  const db = await openNativeDatabase()
  await db.run('DELETE FROM cone_records WHERE bucket = ? AND id = ?', [store, id])
}

export const coneDB = {
  calculations: {
    all: () => all<Calculation>('calculations'),
    put: (value: Calculation) => put('calculations', value),
    delete: (id: string) => remove('calculations', id),
  },
  materials: {
    all: () => all<Material>('materials'),
    put: (value: Material) => put('materials', value),
  },
  firingTests: {
    all: () => all<FiringTest>('firingTests'),
    put: (value: FiringTest) => put('firingTests', value),
  },
  async export(): Promise<ConeBackup> {
    const [calculations, materials, firingTests] = await Promise.all([this.calculations.all(), this.materials.all(), this.firingTests.all()])
    return { schemaVersion: 2, exportedAt: new Date().toISOString(), calculations, materials, firingTests }
  },
  async import(backup: ConeBackup) {
    if (![1, 2].includes(backup.schemaVersion) || !Array.isArray(backup.calculations) || !Array.isArray(backup.materials) || !Array.isArray(backup.firingTests)) {
      throw new Error('지원하지 않는 CONE 백업 파일입니다.')
    }
    await Promise.all([
      ...backup.calculations.map((item) => this.calculations.put(item)),
      ...backup.materials.map((item) => this.materials.put(item)),
      ...backup.firingTests.map((item) => this.firingTests.put(item)),
    ])
  },
}
