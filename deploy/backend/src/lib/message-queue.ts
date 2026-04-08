/**
 * Anti-Ban Message Queue
 * Serializes all outbound WhatsApp messages per instance.
 * Configurable delay between each message send.
 * Supports cooldown: after N sends, pause for M minutes.
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
  private inCooldown = false;
  private currentLabel: string | null = null;
  private instanceName: string;
  private delayMs: number;
  private pauseAfterSends: number | null;
  private pauseMinutes: number | null;
  private sendCount = 0;

  constructor(
    instanceName: string,
    delayMs: number = 2000,
    pauseAfterSends: number | null = null,
    pauseMinutes: number | null = null,
  ) {
    this.instanceName = instanceName;
    this.delayMs = delayMs;
    this.pauseAfterSends = pauseAfterSends;
    this.pauseMinutes = pauseMinutes;
  }

  setDelay(ms: number) {
    this.delayMs = ms;
    console.log(`[queue:${this.instanceName}] delay updated to ${ms}ms`);
  }

  setCooldown(pauseAfterSends: number | null, pauseMinutes: number | null) {
    this.pauseAfterSends = pauseAfterSends;
    this.pauseMinutes = pauseMinutes;
    console.log(`[queue:${this.instanceName}] cooldown updated: pause after ${pauseAfterSends} sends for ${pauseMinutes} min`);
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

    // Check cooldown BEFORE sending: if we've sent N messages, pause for M minutes
    if (
      this.pauseAfterSends &&
      this.pauseAfterSends > 0 &&
      this.pauseMinutes &&
      this.pauseMinutes > 0 &&
      this.sendCount >= this.pauseAfterSends
    ) {
      const cooldownMs = this.pauseMinutes * 60 * 1000;
      console.log(`[queue:${this.instanceName}] ⏸ COOLDOWN: sent ${this.sendCount} msgs, pausing for ${this.pauseMinutes} min (${cooldownMs}ms)`);
      this.sendCount = 0;
      await new Promise((r) => setTimeout(r, cooldownMs));
    } else {
      // Normal delay BEFORE sending (including the first message)
      console.log(`[queue:${this.instanceName}] waiting ${this.delayMs}ms before sending ${item.label}...`);
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    try {
      console.log(`[queue:${this.instanceName}] sending ${item.label} (remaining: ${this.queue.length})`);
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      console.error(`[queue:${this.instanceName}] error ${item.label}:`, err);
      item.reject(err);
    }

    this.sendCount++;

    this.processNext();
  }
}

// Global map: instanceName → MessageQueue
const queues = new Map<string, MessageQueue>();

export function getMessageQueue(
  instanceName: string,
  delayMs?: number,
  pauseAfterSends?: number | null,
  pauseMinutes?: number | null,
): MessageQueue {
  if (!queues.has(instanceName)) {
    queues.set(
      instanceName,
      new MessageQueue(instanceName, delayMs || 2000, pauseAfterSends ?? null, pauseMinutes ?? null),
    );
    console.log(`[queue] Created queue for instance: ${instanceName} (delay: ${delayMs || 2000}ms, pauseAfter: ${pauseAfterSends ?? "none"}, pauseMin: ${pauseMinutes ?? "none"})`);
  } else {
    if (delayMs !== undefined) {
      queues.get(instanceName)!.setDelay(delayMs);
    }
    if (pauseAfterSends !== undefined || pauseMinutes !== undefined) {
      queues.get(instanceName)!.setCooldown(pauseAfterSends ?? null, pauseMinutes ?? null);
    }
  }
  return queues.get(instanceName)!;
}
