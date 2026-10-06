import type { Calculation, ConeBackup, FiringTest, Material } from './types'

const DB_NAME = 'cone-local'
const DB_VERSION = 1
const STORES = ['calculations', 'materials', 'firingTests'] as const
type StoreName = typeof STORES[number]

function openDatabase(): Promise<IDBDatabase> {
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

async function transact<T>(storeName: StoreName, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = operation(transaction.objectStore(storeName))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
  })
}

export const coneDB = {
  calculations: {
    all: () => transact<Calculation[]>('calculations', 'readonly', (store) => store.getAll()),
    put: (value: Calculation) => transact('calculations', 'readwrite', (store) => store.put(value)),
    delete: (id: string) => transact('calculations', 'readwrite', (store) => store.delete(id)),
  },
  materials: {
    all: () => transact<Material[]>('materials', 'readonly', (store) => store.getAll()),
    put: (value: Material) => transact('materials', 'readwrite', (store) => store.put(value)),
  },
  firingTests: {
    all: () => transact<FiringTest[]>('firingTests', 'readonly', (store) => store.getAll()),
    put: (value: FiringTest) => transact('firingTests', 'readwrite', (store) => store.put(value)),
  },
  async export(): Promise<ConeBackup> {
    const [calculations, materials, firingTests] = await Promise.all([this.calculations.all(), this.materials.all(), this.firingTests.all()])
    return {
      schemaVersion: 1, exportedAt: new Date().toISOString(), calculations, materials,
      firingTests: firingTests.map((test) => ({
        ...test,
        photos: test.photos.map((photo) => ({ id: photo.id, name: photo.name, type: photo.type, size: photo.size })),
      })),
    }
  },
  async import(backup: ConeBackup) {
    if (backup.schemaVersion !== 1 || !Array.isArray(backup.calculations) || !Array.isArray(backup.materials) || !Array.isArray(backup.firingTests)) {
      throw new Error('지원하지 않는 CONE 백업 파일입니다.')
    }
    await Promise.all([
      ...backup.calculations.map((item) => this.calculations.put(item)),
      ...backup.materials.map((item) => this.materials.put(item)),
      ...backup.firingTests.map((item) => this.firingTests.put({ ...item, photos: item.photos })),
    ])
  },
}
