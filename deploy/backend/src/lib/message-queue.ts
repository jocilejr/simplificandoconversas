/**
 * Anti-Ban Message Queue
 * Serializes all outbound WhatsApp messages per instance.
 * Configurable delay between each message send.
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (err: any) => void;
  label: string;
}

class MessageQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private instanceName: string;
  private delayMs: number;

  constructor(instanceName: string, delayMs: number = 2000) {
    this.instanceName = instanceName;
    this.delayMs = delayMs;
  }

  setDelay(ms: number) {
    this.delayMs = ms;
    console.log(`[queue:${this.instanceName}] delay updated to ${ms}ms`);
  }

  enqueue<T>(fn: () => Promise<T>, label: string = ""): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, label });
      console.log(`[queue:${this.instanceName}] enqueued ${label} (queue size: ${this.queue.length})`);
      if (!this.processing) {
        this.processNext();
      }
    });
  }

  private async processNext() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const item = this.queue.shift()!;

    try {
      console.log(`[queue:${this.instanceName}] sending ${item.label} (remaining: ${this.queue.length}, delay: ${this.delayMs}ms)`);
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      console.error(`[queue:${this.instanceName}] error ${item.label}:`, err);
      item.reject(err);
    }

    await new Promise((r) => setTimeout(r, this.delayMs));
    this.processNext();
  }
}

// Global map: instanceName → MessageQueue
const queues = new Map<string, MessageQueue>();

export function getMessageQueue(instanceName: string, delayMs?: number): MessageQueue {
  if (!queues.has(instanceName)) {
    queues.set(instanceName, new MessageQueue(instanceName, delayMs || 2000));
    console.log(`[queue] Created queue for instance: ${instanceName} (delay: ${delayMs || 2000}ms)`);
  } else if (delayMs !== undefined) {
    queues.get(instanceName)!.setDelay(delayMs);
  }
  return queues.get(instanceName)!;
}
