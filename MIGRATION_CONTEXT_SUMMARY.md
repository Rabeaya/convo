# Angular to React Migration - Context Summary

## 1. Project Goal

Migrate an existing AngularJS 1.6.9 web application to a modern Next.js 15+ (App Router) + React 18+ + TypeScript stack using a **co-existence strategy**.

**Key Requirements:**
- Zero feature loss - every feature, button, form validation, error state, and API call must work identically
- Absolute UI parity - React version must look and feel exactly like AngularJS version (pixel-perfect)
- Migrate features one-by-one, feature-by-feature
- Do not replicate Angular folder structure - follow existing React architecture in destination repository

**Source/Destination:**
- Source Directory: `D:\Convo\Convo\convo` (Angular)
- Current Directory: React repository (Destination)
- Reference `MIGRATION_START_PROMPT.md` in React repo as primary guide for technical specs, versions, and technology choices

---

## 2. Final Tech Stack

### Framework & Language
- **Next.js 15+** (App Router)
- **React 18+**
- **TypeScript 5+** (Strict Mode - no `any` types)

### State Management
- **TanStack Query v5** (React Query) - Server state
- **Zustand** - Client state (lightweight)

### Styling
- **Tailwind CSS 3+** OR **CSS Modules + SASS**
- Extract all design tokens (colors, spacing, fonts) from LESS files
- Maintain exact visual parity

### API Architecture
- All API calls go through Next.js API proxy routes (`/api/v1/*`)
- Proxy routes forward to remote Convo host (`https://app3.app06.convodev.net` by default)
- Base URL configured via `NEXT_PUBLIC_SERVICES_HOST` environment variable
- Default fallback: `app14.convodev.net` (can be overridden)

### Forms & Validation
- **React Hook Form**
- **Zod** (schema validation)

### HTTP & Real-time
- **Fetch API** (native) + TanStack Query
- **XMPP/Strophe** - Port existing implementation to TypeScript
- **WebSocket** - Native WebSocket API + React hooks

### Rich Text Editor
- **TipTap** (recommended) OR **Quill React**

---

## 3. Conversion Rules

### Component Conversion
- **AngularJS Directive/Controller → Functional React Component** (using Hooks)
- Convert all Angular services to TypeScript services + React hooks
- Use TanStack Query for server state management
- Use Zustand for client state management

### Template Conversion
- Convert HTML templates to JSX maintaining exact structure
- Convert Angular directives (`ng-if`, `ng-repeat`, `ng-click`, etc.) to React equivalents
- Preserve exact DOM structure for UI parity

### Service Conversion
- **AngularJS Service → TypeScript Service + React Hook**
- All API calls must go through Next.js API proxy routes (`/api/v1/*`)
- Proxy routes handle cookie forwarding and CORS
- Services return typed responses matching Angular API structure

### State Management Conversion
- **AngularJS $scope + Backbone → Zustand** for client state
- **AngularJS Services → TanStack Query** for server state
- Use `useQuery` for data fetching
- Use `useMutation` for data mutations
- Invalidate queries after mutations to refresh data

### Route Conversion
- Ensure React routes match Angular URL structure exactly
- Create route aliases for Angular canonical URL paths when needed
- Use Next.js App Router file-based routing

### Styling Conversion
- Extract exact CSS values from LESS files (colors, spacing, fonts)
- Convert to Tailwind CSS utilities OR CSS Modules
- Maintain exact pixel values, hex codes, spacing, typography
- Preserve all animations, transitions, hover states, focus states

### Code Generation Rules
- **No truncation** - Write complete implementations, no placeholders
- **No `// ... rest of code` comments** - Include every line
- **TypeScript strict mode** - No `any` types
- All functions must have proper types
- All API responses must be typed
- All component props must be typed

---

## 4. Architectural Decisions

### API Proxy Pattern
- **All API calls go through Next.js API routes** (`/api/v1/*`)
- Browser calls `http://localhost:3000/api/v1/[endpoint]`
- Next.js proxy forwards to remote Convo host (`https://app3.app06.convodev.net/api/v1/[endpoint]`)
- Proxy handles:
  - Cookie forwarding (preserves authentication)
  - CORS resolution
  - Request/response transformation
  - Error handling

### File Structure
- **Do NOT replicate Angular folder structure**
- Follow existing React architecture in destination repository
- Components in `components/` directory
- API services in `lib/api/` directory
- React hooks in `lib/hooks/` directory
- Zustand stores in `lib/stores/` directory
- Utilities in `lib/utils/` directory

### Settings API Pattern
- Settings API routes: `app/api/v1/settings/route.ts`
- Hooks call `/api/v1/settings` (not `/settings` which is a page route)
- Settings hooks: `useGeneralSettings()`, `useCustomizeFeedSettings()`, `useSaveSettingByName()`
- After saving settings, invalidate general settings query to refresh UI

### Users API Pattern
- Users API route: `app/api/v1/users/route.ts`
- Users service: `lib/api/users.ts`
- Users hook: `lib/hooks/use-users.ts`
- Normalizes Angular response structure (`accessible_users` + `user` → merged array)

### Groups API Pattern
- Groups API route: `app/api/v1/groups/route.ts`
- Groups service: `lib/api/groups.ts`
- Groups hook: `lib/hooks/use-groups.ts`

### Component Migration Pattern
1. Read all Angular files (template, controller, service, styles)
2. Understand all business logic, dependencies, edge cases
3. Generate complete React component with:
   - TypeScript types/interfaces
   - React hooks for state management
   - TanStack Query for data fetching
   - Exact UI structure matching Angular template
   - Exact styling matching Angular LESS files
4. Ensure route parity (match Angular URL structure)
5. Test compilation and accessibility

### UI Parity Requirements
- Match layout exactly (grid, flexbox, positioning)
- Match spacing exactly (margins, padding - exact pixel values)
- Match typography exactly (fonts, sizes, weights, colors - exact hex codes)
- Match colors exactly (exact hex codes from LESS files)
- Match images/icons (same assets)
- Match animations/transitions (exact timing, easing)
- Match responsive behavior
- Match all interactive states (hover, focus, disabled, active, loading, error)

---

## 5. Known Issues

### File Upload Issues
- **S3 upload configuration**: File storage not configured for S3 uploads in environment
- **Double file explorer**: Attachment button opens file explorer twice (needs event handler fix)
- **File upload error**: `Error: File storage is not configured for S3 uploads in this environment` at `InlineInsert.tsx:305:13`

### Settings Loading Issues (RESOLVED)
- ~~Settings API was calling `/settings` (page route) instead of `/api/v1/settings` (API route)~~
- ~~Fixed by creating `app/api/v1/settings/route.ts` proxy route~~
- ~~Fixed by updating hooks to use `/api/v1/settings`~~

### API Base URL Issues (RESOLVED)
- ~~API calls were using wrong base URL (`http://localhost:3000/api/v1/settings` directly)~~
- ~~Fixed by configuring `NEXT_PUBLIC_SERVICES_HOST` environment variable~~
- ~~Fixed by updating API proxy routes to use `https://app3.app06.convodev.net` as base URL~~

### Radio Button Issues (RESOLVED)
- ~~Radio buttons not working in CustomizeFeedView~~
- ~~Fixed by preventing settings hydration effect from constantly resetting state~~
- ~~Fixed by splitting state into `alwaysAskShareLink` (checkbox) + `defaultShareLinkSetting` (radio)~~

### Data Plumbing Issues (RESOLVED)
- ~~Missing `users` API + hook implementation~~
- ~~Missing `usersGroupsListProvider` behaviors (history-on-focus, auto-select first suggestion, exclude invited users)~~
- ~~Missing hidden-groups modal + unhide flow~~
- ~~Missing feed refresh trigger after saves~~
- All resolved during CustomizeFeedView migration

### Console Logging
- User preference: **Do not add console.log statements** - fix issues without debugging logs
- User will revert changes that include console logging

---

## 6. Open Questions

### File Upload Configuration
- How should S3 uploads be configured for the React environment?
- What are the required environment variables for S3 configuration?
- Should file uploads go through Next.js API proxy or directly to S3?

### InlineInsert Component
- Attachment button double-click issue needs investigation
- File upload flow needs to be aligned with Angular implementation
- Need to verify file attachment handling matches Angular behavior exactly

### Feature Migration Priority
- Migration order defined in `MIGRATION_START_PROMPT.md` (31 features total)
- Current status: CustomizeFeedView migrated, AccountSettingsView migrated
- Next features to migrate per priority list

### Route Parity
- Some Angular routes may need aliases for backward compatibility
- Need to verify all Angular canonical URLs have React equivalents
- Route migration strategy for complex nested routes

### Real-time Features
- XMPP/Strophe migration to TypeScript needs detailed planning
- WebSocket implementation strategy needs definition
- Real-time update patterns need to match Angular behavior

---

## Additional Notes

### Migration Approach
- **One feature at a time** - Complete one feature fully before moving to next
- **Fix issues immediately** - When user reports issues, fix them promptly
- **No shortcuts** - Don't simplify or omit anything, match AngularJS exactly
- **Testable immediately** - Each feature must be testable right away

### Quality Standards
- Code must compile without errors (TypeScript strict mode)
- All components must be functional
- All API integrations must be set up
- All routes must be accessible
- Feature must work identically to AngularJS version

### User Testing Process
- User tests migrated features
- User reports issues with specific details
- Fix issues to match AngularJS exactly
- Continue until feature works identically
- Move to next feature

---

## Key Files Reference

### Migration Spec
- `MIGRATION_START_PROMPT.md` - Primary guide for technical specs, versions, technology choices

### API Routes
- `app/api/v1/settings/route.ts` - Settings API proxy
- `app/api/v1/users/route.ts` - Users API proxy
- `app/api/v1/groups/route.ts` - Groups API proxy
- `app/api/v1/accounts/route.ts` - Accounts API proxy

### Services
- `lib/api/users.ts` - Users service
- `lib/api/groups.ts` - Groups service
- `lib/api/client.ts` - API client base

### Hooks
- `lib/hooks/use-users.ts` - Users hook
- `lib/hooks/use-groups.ts` - Groups hook
- `lib/hooks/use-settings.ts` - Settings hooks

### Components
- `components/settings/CustomizeFeedView.tsx` - Customize Feed settings (migrated)
- `components/settings/AccountSettingsView.tsx` - Account settings (migrated)
- `components/feed/InlineInsert.tsx` - Feed composer (has file upload issues)

### Configuration
- `lib/config/services-host.ts` - Services host configuration
- Environment variable: `NEXT_PUBLIC_SERVICES_HOST` (default: `app14.convodev.net`)


