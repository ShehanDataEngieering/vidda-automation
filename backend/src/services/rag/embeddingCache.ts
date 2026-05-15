const { logger } = require('../utils/logger');

interface CacheEntry {
  embedding: number[];
  timestamp: number;
}

const MAX_SIZE = 1000;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const cache = new Map<string, CacheEntry>();

function hash(text: string): string {
  return text.slice(0, 120) + '|' + text.length;
}

export function getCachedEmbedding(text: string): number[] | null {
  const key = hash(text);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.embedding;
}

export function setCachedEmbedding(text: string, embedding: number[]): void {
  const key = hash(text);
  if (cache.size >= MAX_SIZE) {
    const oldestKey = [...cache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0]?.[0];
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { embedding, timestamp: Date.now() });
}

export function clearEmbeddingCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; maxSize: number } {
  return { size: cache.size, maxSize: MAX_SIZE };
}