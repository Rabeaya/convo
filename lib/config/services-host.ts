export type ServicesHostResolution = {
  host: string;
  source: 'header' | 'window' | 'env' | 'default';
};

/**
 * Single source of truth for the Convo upstream host.
 *
 * - Client components should prefer `window.servicesHost` (set by `ConfigScript`)
 * - Server routes can pass the request `Headers` so we can respect `x-services-host`
 * - Falls back to env vars and then to a safe default
 */
export function resolveServicesHost(opts?: {
  headers?: Headers;
  allowWindow?: boolean;
  defaultHost?: string;
}): ServicesHostResolution {
  const defaultHost = opts?.defaultHost || process.env.NEXT_PUBLIC_SERVICES_HOST || 'app14.convodev.net';

  const headerHost = opts?.headers?.get('x-services-host')?.trim();
  if (headerHost) return { host: headerHost, source: 'header' };

  if (opts?.allowWindow !== false && typeof window !== 'undefined') {
    const winHost = String((window as any)?.servicesHost || '').trim();
    if (winHost) return { host: winHost, source: 'window' };
  }

  const envHost = (process.env.NEXT_PUBLIC_SERVICES_HOST || process.env.SERVICES_HOST || '').trim();
  if (envHost) return { host: envHost, source: 'env' };

  return { host: defaultHost, source: 'default' };
}

export function resolveServicesHostString(opts?: Parameters<typeof resolveServicesHost>[0]): string {
  return resolveServicesHost(opts).host;
}



