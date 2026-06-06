/**
 * In-memory key/value store for ephemeral application data.
 * This intentionally avoids any persistence layer. Data is lost on refresh.
 * Keep API intentionally small; extend only if multiple features need the same primitive.
 */

export type MemoryValue = unknown;

interface MemoryStoreApiBase {
    /** Store or overwrite a value. */
    put<T = MemoryValue>(key: string, value: T): void;
    /** Retrieve a typed value (undefined if missing). */
    get<T = MemoryValue>(key: string): T | undefined;
    /** Remove a key. */
    remove(key: string): void;
    /** Clear ALL keys (feature-level reset). */
    clear(): void;
    /** Get shallow snapshot (read-only copy). */
    snapshot(): Record<string, MemoryValue>;
}

export interface MemoryStoreApi extends MemoryStoreApiBase {
    /** Get a value or initialize it if absent. */
    ensure<T>(key: string, init: () => T): T;
}

// Internal backing map (module scoped singleton)
const backing = new Map<string, MemoryValue>();

const core: MemoryStoreApiBase = {
    put(key, value) {
        backing.set(key, value);
    },
    get<T = MemoryValue>(key: string) {
        return backing.get(key) as T | undefined;
    },
    remove(key) {
        backing.delete(key);
    },
    clear() {
        backing.clear();
    },
    snapshot() {
        return Object.fromEntries(backing.entries());
    },
};

export const memory: MemoryStoreApi = Object.assign(core, {
    ensure<T>(key: string, init: () => T): T {
        const existing = core.get<T>(key);
        if (existing !== undefined) return existing;
        const value = init();
        core.put(key, value);
        return value;
    },
});

export const KEYS = {
    // Add domain key constants here as features are added, e.g.:
    // tasks: 'tasks',
};