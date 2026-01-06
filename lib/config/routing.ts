/**
 * Routing Bridge Configuration
 * 
 * This file manages which routes are handled by React (Next.js) vs AngularJS.
 * As features are migrated, routes are switched from AngularJS to React.
 */

export interface RouteConfig {
  path: string;
  useReact: boolean; // true = React route, false = AngularJS route
  feature?: string; // Feature name for tracking
}

/**
 * Route Configuration Map
 * 
 * Initially, all routes point to AngularJS (useReact: false).
 * As features are migrated, set useReact: true for that route.
 */
export const routeConfig: RouteConfig[] = [
  // Authentication routes
  { path: '/login', useReact: false, feature: 'authentication' },
  { path: '/logout', useReact: false, feature: 'authentication' },
  { path: '/mfa', useReact: false, feature: 'mfa' },
  
  // User routes
  { path: '/users', useReact: false, feature: 'user-directory' },
  { path: '/users/:id', useReact: false, feature: 'user-directory' },
  
  // Settings routes
  { path: '/settings', useReact: false, feature: 'settings' },
  { path: '/settings/account', useReact: false, feature: 'settings' },
  { path: '/settings/notifications', useReact: false, feature: 'settings' },
  { path: '/settings/security', useReact: false, feature: 'settings' },
  { path: '/settings/sso', useReact: false, feature: 'settings' },
  { path: '/settings/analytics', useReact: false, feature: 'settings' },
  
  // Groups routes
  { path: '/groups', useReact: false, feature: 'groups' },
  { path: '/groups/:id', useReact: false, feature: 'groups' },
  
  // Feed routes
  { path: '/feed', useReact: false, feature: 'feed' },
  { path: '/home', useReact: false, feature: 'home' },
  
  // Notes routes
  { path: '/notes', useReact: false, feature: 'notes' },
  { path: '/notes/:id', useReact: false, feature: 'notes' },
  
  // Chat routes
  { path: '/chat', useReact: false, feature: 'chat' },
  { path: '/chat/:id', useReact: false, feature: 'chat' },
  
  // Integrations routes
  { path: '/integrations', useReact: false, feature: 'integrations' },
  
  // Search routes
  { path: '/search', useReact: false, feature: 'search' },
  
  // Default route
  { path: '/', useReact: false, feature: 'home' },
];

/**
 * Check if a route should use React
 */
export function shouldUseReact(path: string): boolean {
  // Remove query params and hash
  const cleanPath = path.split('?')[0].split('#')[0];
  
  // Check exact match first
  const exactMatch = routeConfig.find(
    (route) => route.path === cleanPath && route.useReact
  );
  if (exactMatch) return true;
  
  // Check pattern matches (e.g., /users/:id)
  const patternMatch = routeConfig.find((route) => {
    if (!route.useReact) return false;
    
    const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(cleanPath);
  });
  
  return patternMatch !== undefined;
}

/**
 * Get route config for a path
 */
export function getRouteConfig(path: string): RouteConfig | undefined {
  const cleanPath = path.split('?')[0].split('#')[0];
  
  // Check exact match
  const exactMatch = routeConfig.find((route) => route.path === cleanPath);
  if (exactMatch) return exactMatch;
  
  // Check pattern match
  return routeConfig.find((route) => {
    const pattern = route.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(cleanPath);
  });
}

/**
 * Update route to use React (call this when a feature is migrated)
 */
export function setRouteToReact(path: string): void {
  const config = routeConfig.find((route) => route.path === path);
  if (config) {
    config.useReact = true;
  }
}

