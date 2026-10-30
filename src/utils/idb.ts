// ============================================================
// 极简 IndexedDB 封装（零依赖）
// 只服务浏览统计：一库一表（visits），复合主键 key
// ============================================================
import type { VisitBucket } from '../types';

const DB_NAME = 'tabpocket-stats';
const DB_VERSION = 1;
const STORE = 'visits';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openStatsDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        // 按日期查询区间、按域名做排行
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('domain', 'domain', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'));
  });
  return dbPromise;
}

/** 读取单条聚合记录 */
export async function getBucket(key: string): Promise<VisitBucket | undefined> {
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as VisitBucket | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** 写入（覆盖）一条聚合记录 */
export async function putBucket(bucket: VisitBucket): Promise<void> {
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(bucket);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** 批量写入（同一事务，快得多） */
export async function putBuckets(buckets: VisitBucket[]): Promise<void> {
  if (buckets.length === 0) return;
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const b of buckets) store.put(b);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** 按日期区间查询（含首尾） */
export async function getBucketsByDateRange(
  fromDate: string,
  toDate: string,
): Promise<VisitBucket[]> {
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const index = tx.objectStore(STORE).index('date');
    const range = IDBKeyRange.bound(fromDate, toDate);
    const req = index.getAll(range);
    req.onsuccess = () => resolve((req.result ?? []) as VisitBucket[]);
    req.onerror = () => reject(req.error);
  });
}

/** 清空全部统计 */
export async function clearAllBuckets(): Promise<void> {
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 记录条数（用于「是否有数据」判断） */
export async function countBuckets(): Promise<number> {
  const db = await openStatsDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
