"use client";

import { getState } from "./store";
import { downloadOriginal, removeOriginal, uploadOriginal } from "./cloud/sync";

/**
 * Original-file storage. Demo mode keeps files in this browser (IndexedDB);
 * signed-in accounts use the private Supabase Storage bucket, where access is
 * checked per profile by storage policies. Originals are stored unchanged.
 */
const cloud = () => getState()?.mode === "cloud";

const DB = "healthos-files";
const STORE = "originals";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putFile(key: string, blob: Blob): Promise<void> {
  if (cloud()) return uploadOriginal(key, blob);
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFile(key: string): Promise<Blob | undefined> {
  if (cloud()) return downloadOriginal(key);
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteFile(key: string): Promise<void> {
  if (cloud()) return removeOriginal(key);
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Clears demo files in this browser only. */
export async function clearFiles(): Promise<void> {
  const db = await open();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
