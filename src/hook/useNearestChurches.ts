import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchNearestChurches, NearestChurchesError, NearestChurchesSearch, normalizeCep } from '../util/nearestChurchesApi';
import { PERSIST_MAX_AGE_MS } from '../config/queryPersistence';

export const NEAREST_CHURCHES_STALE_TIME_MS = 5 * 60 * 1000;
const MAX_RETRIES_WHEN_UNAVAILABLE = 1;

export function nearestChurchesQueryKey(search: NearestChurchesSearch | null) {
    return search === null
        ? ['churches', 'nearest', null] as const
        : ['churches', 'nearest', normalizeCep(search.cep), search.mode] as const;
}

/** Retries only transient failures, once; never 4xx or rate limits. */
export function shouldRetryNearestChurches(failureCount: number, error: unknown): boolean {
    return error instanceof NearestChurchesError
        && error.kind === 'unavailable'
        && failureCount < MAX_RETRIES_WHEN_UNAVAILABLE;
}

/** Shared by the hook and by imperative `queryClient.fetchQuery` calls, so both hit one cache entry. */
export function nearestChurchesQueryOptions(search: NearestChurchesSearch | null) {
    return queryOptions({
        queryKey: nearestChurchesQueryKey(search),
        queryFn: ({ signal }) => fetchNearestChurches(search as NearestChurchesSearch, signal),
        enabled: search !== null,
        retry: shouldRetryNearestChurches,
        staleTime: NEAREST_CHURCHES_STALE_TIME_MS,
        // Kept in memory as long as it may be persisted, so saved results survive between searches.
        gcTime: PERSIST_MAX_AGE_MS,
    });
}

/** Fetches the nearest churches for a CEP and travel mode; idle while `search` is null. */
function useNearestChurches(search: NearestChurchesSearch | null) {
    return useQuery(nearestChurchesQueryOptions(search));
}

export default useNearestChurches;
