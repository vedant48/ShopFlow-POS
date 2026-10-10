/**
 * ShopFlow Development Instrumentation
 * Records transaction start/commit/failure, query duration, sync lifecycle, and errors.
 * Active in development or when explicitly enabled; zero production footprint.
 */

export interface TransactionRecord {
  id: string;
  mode: string;
  tables: string[];
  startTime: number;
  durationMs?: number;
  status: 'PENDING' | 'COMMITTED' | 'FAILED';
  error?: string;
}

export interface SyncCycleRecord {
  id: string;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  status: 'STARTED' | 'COMPLETED' | 'FAILED';
  itemsCount: number;
  syncedCount?: number;
  failedCount?: number;
  error?: string;
}

export interface QueryRecord {
  name: string;
  durationMs: number;
  timestamp: number;
  error?: string;
}

class ShopFlowDiagnostics {
  transactions: TransactionRecord[] = [];
  syncCycles: SyncCycleRecord[] = [];
  queries: QueryRecord[] = [];
  isEnabled = true;

  recordTxStart(id: string, mode: string, tables: string[]): void {
    if (!this.isEnabled) return;
    this.transactions.push({
      id,
      mode,
      tables,
      startTime: performance.now(),
      status: 'PENDING',
    });
    // Cap in-memory history to last 100
    if (this.transactions.length > 100) this.transactions.shift();
  }

  recordTxCommit(id: string): void {
    if (!this.isEnabled) return;
    const tx = this.transactions.find((t) => t.id === id);
    if (tx) {
      tx.durationMs = Math.round(performance.now() - tx.startTime);
      tx.status = 'COMMITTED';
    }
  }

  recordTxFail(id: string, error: any): void {
    if (!this.isEnabled) return;
    const tx = this.transactions.find((t) => t.id === id);
    if (tx) {
      tx.durationMs = Math.round(performance.now() - tx.startTime);
      tx.status = 'FAILED';
      tx.error = error?.message || String(error);
    }
  }

  recordSyncStart(id: string, itemsCount: number): void {
    if (!this.isEnabled) return;
    this.syncCycles.push({
      id,
      startTime: performance.now(),
      status: 'STARTED',
      itemsCount,
    });
    if (this.syncCycles.length > 100) this.syncCycles.shift();
  }

  recordSyncEnd(id: string, result: { synced: number; failed: number; error?: string }): void {
    if (!this.isEnabled) return;
    const cycle = this.syncCycles.find((c) => c.id === id);
    if (cycle) {
      cycle.endTime = performance.now();
      cycle.durationMs = Math.round(cycle.endTime - cycle.startTime);
      cycle.status = result.failed > 0 || result.error ? 'FAILED' : 'COMPLETED';
      cycle.syncedCount = result.synced;
      cycle.failedCount = result.failed;
      cycle.error = result.error;
    }
  }

  recordQuery(name: string, durationMs: number, error?: string): void {
    if (!this.isEnabled) return;
    this.queries.push({
      name,
      durationMs: Math.round(durationMs),
      timestamp: Date.now(),
      error,
    });
    if (this.queries.length > 100) this.queries.shift();
  }

  getSummary() {
    return {
      activeTransactions: this.transactions.filter((t) => t.status === 'PENDING').length,
      failedTransactions: this.transactions.filter((t) => t.status === 'FAILED').length,
      committedTransactions: this.transactions.filter((t) => t.status === 'COMMITTED').length,
      lastSync: this.syncCycles[this.syncCycles.length - 1] || null,
      slowQueries: this.queries.filter((q) => q.durationMs > 50),
    };
  }
}

export const diagnostics = new ShopFlowDiagnostics();

// Expose globally in window for dev inspection
if (typeof window !== 'undefined') {
  (window as any).__shopflow_diagnostics = diagnostics;
}
