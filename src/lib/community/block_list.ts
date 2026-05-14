const STORAGE_KEY = 'vt-blocklist';

function readBlockList(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeBlockList(list: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...list]));
  } catch { /* non-blocking */ }
}

export function blockUser(userId: string): void {
  const list = readBlockList();
  list.add(userId);
  writeBlockList(list);
}

export function unblockUser(userId: string): void {
  const list = readBlockList();
  list.delete(userId);
  writeBlockList(list);
}

export function isBlocked(userId: string): boolean {
  return readBlockList().has(userId);
}

export function getBlockList(): string[] {
  return [...readBlockList()];
}
