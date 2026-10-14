import { HISTORY_RETENTION_MS, type PortfolioSnapshot } from './history.ts'

const DB_NAME = 'gazewallet:history:v1'
const STORE = 'snapshots'
const META = 'metadata'
let connection: Promise<IDBDatabase> | undefined

function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('History storage is unavailable')); return }
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('series', ['compositionKey', 'currency', 'timestamp'])
        store.createIndex('timestamp', 'timestamp')
        request.result.createObjectStore(META, { keyPath: 'key' })
      }
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('History storage is blocked by another tab'))
      request.onsuccess = () => {
        const db = request.result
        db.onversionchange = () => { db.close(); connection = undefined }
        resolve(db)
      }
    }).catch((error: unknown) => { connection = undefined; throw error })
  }
  return connection
}

function seriesRange(key: string, currency: string, since = 0): IDBKeyRange {
  return IDBKeyRange.bound([key, currency, since], [key, currency, Number.MAX_SAFE_INTEGER])
}

export async function loadHistory(key: string, currency: string): Promise<PortfolioSnapshot[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).index('series').getAll(seriesRange(key, currency, Date.now() - HISTORY_RETENTION_MS))
    tx.oncomplete = () => resolve(request.result as PortfolioSnapshot[])
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('History read aborted'))
  })
}

export async function saveSnapshot(snapshot: PortfolioSnapshot): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META], 'readwrite')
    const store = tx.objectStore(STORE)
    const deleted = tx.objectStore(META).get('clearedAt')
    deleted.onsuccess = () => {
      // Old cache and late responses from other tabs must not resurrect deleted observations.
      if (snapshot.timestamp <= (deleted.result?.value ?? 0)) return
      const request = store.index('series').openCursor(seriesRange(snapshot.compositionKey, snapshot.currency), 'prev')
      request.onsuccess = () => {
        const previous = request.result?.value as PortfolioSnapshot | undefined
        // StrictMode, reloads and multiple tabs must not duplicate unchanged cached observations.
        if (!previous || (previous.sourceKey !== snapshot.sourceKey && previous.timestamp <= snapshot.timestamp)) store.put(snapshot)
      }
    }
    const expired = store.index('timestamp').openCursor(IDBKeyRange.upperBound(Date.now() - HISTORY_RETENTION_MS, true))
    expired.onsuccess = () => {
      const cursor = expired.result
      if (cursor) { cursor.delete(); cursor.continue() }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('History write aborted'))
  })
}

export async function clearHistory(): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE, META], 'readwrite')
    tx.objectStore(STORE).clear()
    tx.objectStore(META).put({ key: 'clearedAt', value: Date.now() })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('History deletion aborted'))
  })
}
