import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a saved church result is reused across visits; matches the backend's Redis cache. */
export const PERSIST_MAX_AGE_MS = 7 * DAY_MS;

/** Bump to discard every saved result after a breaking change to the cached data shape. */
export const PERSIST_BUSTER = 'church-list-v3';

export const PERSIST_STORAGE_KEY = 'evangelismo-digital-query-cache';

/** Only successful nearest-church lookups are saved; nothing typed in a form ever is. */
export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
    const [scope, kind] = query.queryKey;
    return scope === 'churches' && kind === 'nearest' && query.state.status === 'success';
}

/** `localStorage`, or `undefined` when the browser blocks it (private mode, disabled storage). */
export function getSafeStorage(): Storage | undefined {
    try {
        const storage = window.localStorage;
        const probe = `${PERSIST_STORAGE_KEY}-probe`;
        storage.setItem(probe, probe);
        storage.removeItem(probe);
        return storage;
    } catch {
        // Private mode or disabled storage: results are simply not saved.
    }
    return undefined;
}

export function createPersistOptions(storage: Storage | undefined = getSafeStorage()): Omit<PersistQueryClientOptions, 'queryClient'> {
    return {
        persister: createSyncStoragePersister({ storage, key: PERSIST_STORAGE_KEY }),
        maxAge: PERSIST_MAX_AGE_MS,
        buster: PERSIST_BUSTER,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    };
}
