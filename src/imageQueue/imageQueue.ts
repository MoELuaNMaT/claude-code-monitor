/**
 * Image Queue Management Module
 *
 * Manages the queue of images waiting to be sent to Claude Code
 */

export interface QueuedImage {
  id: string;
  name: string;
  type: string;
  data: string; // Base64 encoded
  timestamp: number;
}

/**
 * Image Queue Manager
 */
export class ImageQueue {
  private queue: Map<string, QueuedImage> = new Map();
  private changeCallbacks: Set<() => void> = new Set();

  /**
   * Add an image to the queue
   */
  add(image: Omit<QueuedImage, 'id' | 'timestamp'>): string {
    const id = this.generateId();
    const queuedImage: QueuedImage = {
      ...image,
      id,
      timestamp: Date.now()
    };

    this.queue.set(id, queuedImage);
    this.notifyChange();

    return id;
  }

  /**
   * Remove an image from the queue
   */
  remove(id: string): boolean {
    const removed = this.queue.delete(id);
    if (removed) {
      this.notifyChange();
    }
    return removed;
  }

  /**
   * Get all images in the queue
   */
  getAll(): QueuedImage[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get an image by ID
   */
  get(id: string): QueuedImage | undefined {
    return this.queue.get(id);
  }

  /**
   * Clear all images from the queue
   */
  clear(): void {
    this.queue.clear();
    this.notifyChange();
  }

  /**
   * Get the number of images in the queue
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Register a callback to be called when the queue changes
   */
  onChange(callback: () => void): () => void {
    this.changeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.changeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all registered callbacks
   */
  private notifyChange(): void {
    for (const callback of this.changeCallbacks) {
      try {
        callback();
      } catch (error) {
        console.error('Error in queue change callback:', error);
      }
    }
  }

  /**
   * Generate a unique ID for an image
   */
  private generateId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get queue statistics
   */
  getStats(): { count: number; totalSize: number; oldestTimestamp: number | null } {
    const images = this.getAll();
    let totalSize = 0;
    let oldestTimestamp: number | null = null;

    for (const image of images) {
      // Estimate size from base64 length (base64 is ~33% larger than original)
      totalSize += Math.floor(image.data.length * 0.75);

      if (oldestTimestamp === null || image.timestamp < oldestTimestamp) {
        oldestTimestamp = image.timestamp;
      }
    }

    return {
      count: images.length,
      totalSize,
      oldestTimestamp
    };
  }
}
