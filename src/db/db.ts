// IndexedDB 접근 계층. UI에서 직접 접근하지 않고 서비스/스토어를 통해 사용한다.
export const SCHEMA_VERSION = 1;
const DB_NAME = 'casino-survival-db';

export type StoreName =
  | 'meta' | 'projects' | 'sessions' | 'tables' | 'shoes' | 'rounds'
  | 'aiProfiles' | 'aiRecords' | 'events' | 'reviews' | 'settings';

export const DATA_STORES: StoreName[] = [
  'projects', 'sessions', 'tables', 'shoes', 'rounds',
  'aiProfiles', 'aiRecords', 'events', 'reviews', 'settings',
];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      const mk = (name: StoreName) =>
        d.objectStoreNames.contains(name) ? null : d.createObjectStore(name, { keyPath: 'id' });
      mk('meta');
      mk('projects');
      mk('sessions')?.createIndex('projectId', 'projectId');
      mk('tables')?.createIndex('sessionId', 'sessionId');
      const shoes = mk('shoes');
      shoes?.createIndex('sessionId', 'sessionId');
      shoes?.createIndex('tableSessionId', 'tableSessionId');
      const rounds = mk('rounds');
      rounds?.createIndex('sessionId', 'sessionId');
      rounds?.createIndex('shoeId', 'shoeId');
      mk('aiProfiles')?.createIndex('projectId', 'projectId');
      const ar = mk('aiRecords');
      ar?.createIndex('sessionId', 'sessionId');
      ar?.createIndex('roundId', 'roundId');
      ar?.createIndex('aiId', 'aiId');
      mk('events')?.createIndex('sessionId', 'sessionId');
      mk('reviews')?.createIndex('sessionId', 'sessionId');
      mk('settings');
      // schemaVersion 마이그레이션은 버전 증가 시 이 블록에 추가한다.
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error as Error);
  });
  return dbPromise;
}

function request<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error as Error);
      }),
  );
}

export function get<T>(store: StoreName, id: string): Promise<T | undefined> {
  return request<T | undefined>(store, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
}

export function getAll<T>(store: StoreName): Promise<T[]> {
  return request<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
}

export function byIndex<T>(store: StoreName, index: string, value: string): Promise<T[]> {
  return openDB().then(
    (d) =>
      new Promise<T[]>((resolve, reject) => {
        const t = d.transaction(store, 'readonly');
        const req = t.objectStore(store).index(index).getAll(value);
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error as Error);
      }),
  );
}

export function put<T extends { id: string }>(store: StoreName, value: T): Promise<IDBValidKey> {
  return request(store, 'readwrite', (s) => s.put(value));
}

export function putMany<T extends { id: string }>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return Promise.resolve();
  return openDB().then(
    (d) =>
      new Promise<void>((resolve, reject) => {
        const t = d.transaction(store, 'readwrite');
        const s = t.objectStore(store);
        values.forEach((v) => s.put(v));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error as Error);
      }),
  );
}

export function del(store: StoreName, id: string): Promise<undefined> {
  return request(store, 'readwrite', (s) => s.delete(id));
}

export function delMany(store: StoreName, ids: string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return openDB().then(
    (d) =>
      new Promise<void>((resolve, reject) => {
        const t = d.transaction(store, 'readwrite');
        const s = t.objectStore(store);
        ids.forEach((id) => s.delete(id));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error as Error);
      }),
  );
}

export function clear(store: StoreName): Promise<undefined> {
  return request(store, 'readwrite', (s) => s.clear());
}

export async function ensureSchema(): Promise<void> {
  await openDB();
  const meta = await get<{ id: string; value: number }>('meta', 'schema');
  if (!meta) await put('meta', { id: 'schema', value: SCHEMA_VERSION });
}
