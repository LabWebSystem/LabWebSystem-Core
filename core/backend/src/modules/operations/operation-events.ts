import type { OperationDto, OperationLogItemDto, OperationStepDto } from "./operation-types.js";

export type OperationStreamEvent =
  | {
      type: "log";
      operationId: string;
      payload: OperationLogItemDto;
    }
  | {
      type: "step";
      operationId: string;
      payload: OperationStepDto;
    }
  | {
      type: "operation";
      operationId: string;
      payload: OperationDto;
    };

export interface OperationEventBus {
  publish(event: OperationStreamEvent): void;
  subscribe(operationId: string, listener: (event: OperationStreamEvent) => void): () => void;
}

export class InMemoryOperationEventBus implements OperationEventBus {
  private readonly listeners = new Map<string, Set<(event: OperationStreamEvent) => void>>();

  publish(event: OperationStreamEvent): void {
    const subscribers = this.listeners.get(event.operationId);
    if (!subscribers) {
      return;
    }

    for (const listener of subscribers) {
      listener(event);
    }
  }

  subscribe(operationId: string, listener: (event: OperationStreamEvent) => void): () => void {
    const subscribers = this.listeners.get(operationId) ?? new Set<(event: OperationStreamEvent) => void>();
    subscribers.add(listener);
    this.listeners.set(operationId, subscribers);

    return () => {
      const current = this.listeners.get(operationId);
      if (!current) {
        return;
      }
      current.delete(listener);
      if (current.size === 0) {
        this.listeners.delete(operationId);
      }
    };
  }
}
