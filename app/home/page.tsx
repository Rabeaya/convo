/**
 * Deprecated Home Route
 *
 * `/feed` is the single source of truth for the home experience.
 * Keep `/home` for backward compatibility, but redirect to `/feed`.
 */

import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

function toQueryString(searchParams: SearchParams): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.set(key, value);
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export default function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  redirect(`/feed${toQueryString(searchParams)}`);
}
