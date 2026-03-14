/**
 * Anti-Ban Message Queue
 * Serializes all outbound WhatsApp messages per instance.
 * Minimum 2 seconds between each message send.
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (err: any) => void;
  label: string; // for logging
}

class MessageQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private instanceName: string;

  constructor(instanceName: string) {
    this.instanceName = instanceName;
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
      console.log(`[queue:${this.instanceName}] sending ${item.label} (remaining: ${this.queue.length})`);
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      console.error(`[queue:${this.instanceName}] error ${item.label}:`, err);
      item.reject(err);
    }

    // Wait 2 seconds before processing next message
    await new Promise((r) => setTimeout(r, 2000));
    this.processNext();
  }
}

// Global map: instanceName → MessageQueue
const queues = new Map<string, MessageQueue>();

export function getMessageQueue(instanceName: string): MessageQueue {
  if (!queues.has(instanceName)) {
    queues.set(instanceName, new MessageQueue(instanceName));
    console.log(`[queue] Created queue for instance: ${instanceName}`);
  }
  return queues.get(instanceName)!;
}
