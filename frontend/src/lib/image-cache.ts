/**
 * IndexedDB Image Cache with LRU eviction
 * Stores image Blobs for offline access and faster repeat loads
 */

import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'labelhub-image-cache'
const DB_VERSION = 1
const STORE_IMAGES = 'images'
const STORE_METADATA = 'metadata'
const METADATA_KEY = 'cache-stats'
const MAX_CACHE_SIZE = 200 * 1024 * 1024 // 200MB
const MAX_ITEM_SIZE = 10 * 1024 * 1024 // 10MB per image

class ImageCache {
  private db: IDBPDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      try {
        this.db = await openDB(DB_NAME, DB_VERSION, {
          upgrade(db) {
            // Images store
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
              const imageStore = db.createObjectStore(STORE_IMAGES, { keyPath: 'url' })
              imageStore.createIndex('accessed', 'accessed', { unique: false })
              imageStore.createIndex('size', 'size', { unique: false })
            }

            // Metadata store
            if (!db.objectStoreNames.contains(STORE_METADATA)) {
              db.createObjectStore(STORE_METADATA)
            }
          },
        })

        // Initialize metadata if not exists
        const metadata = await this.db.get(STORE_METADATA, METADATA_KEY)
        if (!metadata) {
          await this.db.put(STORE_METADATA, { totalSize: 0, itemCount: 0 }, METADATA_KEY)
        }
      } catch (error) {
        console.error('Failed to initialize image cache:', error)
        this.db = null
      }
    })()

    return this.initPromise
  }

  /**
   * Get cached image blob by URL
   */
  async get(url: string): Promise<Blob | null> {
    await this.init()
    if (!this.db) return null

    try {
      const cached = await this.db.get(STORE_IMAGES, url)
      if (!cached) return null

      // Update access time for LRU
      cached.accessed = Date.now()
      await this.db.put(STORE_IMAGES, cached)

      return cached.blob
    } catch (error) {
      console.error('Failed to get from cache:', error)
      return null
    }
  }

  /**
   * Store image blob in cache
   */
  async set(url: string, blob: Blob): Promise<void> {
    await this.init()
    if (!this.db) return

    const size = blob.size

    // Skip if image is too large
    if (size > MAX_ITEM_SIZE) {
      console.warn(`Image too large to cache: ${size} bytes`)
      return
    }

    try {
      // Check if we need to evict old items
      const metadata = await this.db.get(STORE_METADATA, METADATA_KEY)
      if (metadata && metadata.totalSize + size > MAX_CACHE_SIZE) {
        await this.evictLRU(size)
      }

      // Store the image
      const now = Date.now()
      await this.db.put(STORE_IMAGES, {
        url,
        blob,
        size,
        accessed: now,
        cached: now,
      })

      // Update metadata
      const newMetadata = await this.db.get(STORE_METADATA, METADATA_KEY)
      if (newMetadata) {
        newMetadata.totalSize += size
        newMetadata.itemCount += 1
        await this.db.put(STORE_METADATA, newMetadata, METADATA_KEY)
      }
    } catch (error) {
      console.error('Failed to set cache:', error)
    }
  }

  /**
   * Evict least recently used items to make space
   */
  private async evictLRU(neededSpace: number): Promise<void> {
    if (!this.db) return

    try {
      // Get all items sorted by access time (oldest first)
      const tx = this.db.transaction(STORE_IMAGES, 'readonly')
      const index = tx.store.index('accessed')
      const items = await index.getAll()

      let freedSpace = 0
      const toDelete: string[] = []

      // Evict items until we have enough space
      for (const item of items) {
        toDelete.push(item.url)
        freedSpace += item.size

        if (freedSpace >= neededSpace) {
          break
        }
      }

      // Delete the items
      for (const url of toDelete) {
        await this.delete(url)
      }

      console.log(`Evicted ${toDelete.length} items, freed ${freedSpace} bytes`)
    } catch (error) {
      console.error('Failed to evict LRU:', error)
    }
  }

  /**
   * Delete a cached image
   */
  async delete(url: string): Promise<void> {
    await this.init()
    if (!this.db) return

    try {
      const cached = await this.db.get(STORE_IMAGES, url)
      if (cached) {
        await this.db.delete(STORE_IMAGES, url)

        // Update metadata
        const metadata = await this.db.get(STORE_METADATA, METADATA_KEY)
        if (metadata) {
          metadata.totalSize -= cached.size
          metadata.itemCount -= 1
          await this.db.put(STORE_METADATA, metadata, METADATA_KEY)
        }
      }
    } catch (error) {
      console.error('Failed to delete from cache:', error)
    }
  }

  /**
   * Clear all cached images
   */
  async clear(): Promise<void> {
    await this.init()
    if (!this.db) return

    try {
      await this.db.clear(STORE_IMAGES)
      await this.db.put(STORE_METADATA, { totalSize: 0, itemCount: 0 }, METADATA_KEY)
      console.log('Cache cleared')
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ totalSize: number; itemCount: number; maxSize: number }> {
    await this.init()
    if (!this.db) return { totalSize: 0, itemCount: 0, maxSize: MAX_CACHE_SIZE }

    try {
      const metadata = await this.db.get(STORE_METADATA, METADATA_KEY)
      return {
        totalSize: metadata?.totalSize || 0,
        itemCount: metadata?.itemCount || 0,
        maxSize: MAX_CACHE_SIZE,
      }
    } catch (error) {
      console.error('Failed to get cache stats:', error)
      return { totalSize: 0, itemCount: 0, maxSize: MAX_CACHE_SIZE }
    }
  }

  /**
   * Check if IndexedDB is supported
   */
  static isSupported(): boolean {
    return typeof indexedDB !== 'undefined'
  }
}

// Singleton instance
export const imageCache = new ImageCache()

/**
 * Fetch image with cache fallback
 * 1. Try to get from IndexedDB cache
 * 2. If miss, fetch from network
 * 3. Store in cache for next time
 */
export async function fetchImageWithCache(url: string): Promise<Blob | null> {
  if (!ImageCache.isSupported()) {
    // Fallback to direct fetch
    try {
      const response = await fetch(url)
      return await response.blob()
    } catch {
      return null
    }
  }

  // Try cache first
  const cached = await imageCache.get(url)
  if (cached) {
    console.log(`Cache hit: ${url}`)
    return cached
  }

  // Fetch from network
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    // Store in cache (fire and forget)
    imageCache.set(url, blob).catch((err) => {
      console.error('Failed to cache image:', err)
    })

    console.log(`Cache miss: ${url}`)
    return blob
  } catch (error) {
    console.error(`Failed to fetch image: ${url}`, error)
    return null
  }
}

