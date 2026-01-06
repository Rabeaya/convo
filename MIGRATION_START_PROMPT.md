# Migration Execution Prompt

## Instructions for AI Assistant

You are tasked with migrating the Convo Web Application from AngularJS 1.6.9 to a modern Next.js 15+ (App Router) + React 18+ + TypeScript stack using the **Co-Existence Strategy**.

---

## Critical Requirements

### 1. Zero Feature Loss
- **EVERY** feature, button, form validation, error state, and API call must work identically to the current AngularJS implementation
- No functionality can be simplified, omitted, or changed
- All business logic must be preserved exactly
- All edge cases must be handled
- All permission checks must work identically

### 2. Absolute UI Parity
- The React version must look and feel **EXACTLY** like the AngularJS version
- Maintain 1:1 parity in:
  - Layout (grid, flexbox, positioning)
  - Spacing (margins, padding - exact pixel values)
  - Typography (fonts, sizes, weights, colors - exact hex codes)
  - Colors (exact hex codes from LESS files)
  - Images/icons (same assets)
  - Animations/transitions (exact timing, easing)
  - Responsive behavior
  - Hover states, focus states, disabled states
  - Loading states, error states

### 3. Co-Existence Strategy
- Create a **NEW** Next.js application in `/modern-app/` directory
- Keep existing AngularJS app in `/src/app/` running
- Use routing bridge to decide: AngularJS route OR React route
- Migrate features one-by-one, feature-by-feature
- Each migrated feature should be fully functional and testable

---

## Project Structure

Create the following structure:

```
/web_app/
  ├── modern-app/              # NEW Next.js/React application
  │   ├── app/                 # Next.js App Router
  │   │   ├── (routes)/       # Feature routes
  │   │   │   ├── chat/
  │   │   │   ├── notes/
  │   │   │   ├── feed/
  │   │   │   ├── settings/
  │   │   │   └── ...
  │   │   ├── layout.tsx      # Root layout
  │   │   └── page.tsx        # Home page
  │   ├── components/         # React components
  │   │   ├── common/        # Shared components
  │   │   └── features/      # Feature-specific components
  │   ├── lib/               # Utilities, API clients
  │   │   ├── api/          # API service layer
  │   │   ├── hooks/        # Custom React hooks
  │   │   ├── stores/       # Zustand stores
  │   │   └── utils/        # Utility functions
  │   ├── types/            # TypeScript types/interfaces
  │   ├── styles/           # Tailwind CSS / CSS Modules
  │   ├── public/           # Static assets
  │   ├── package.json
  │   ├── tsconfig.json
  │   ├── next.config.js
  │   └── tailwind.config.js
  │
  ├── src/app/              # EXISTING AngularJS app (keep as-is)
  │   └── ... (all existing code)
  │
  └── shared/               # Shared between both apps
      ├── types/           # Shared TypeScript types
      ├── api/            # Shared API client
      └── utils/          # Shared utilities
```

---

## Technology Stack

### Framework & Language
- **Next.js 15+** (App Router)
- **React 18+**
- **TypeScript 5+** (Strict Mode - no `any` types)

### State Management
- **TanStack Query v5** (React Query) - Server state
- **Zustand** - Client state (lightweight)
- **Redux Toolkit** - Only if needed for complex features (chat, feed)

### Styling
- **Tailwind CSS 3+** (recommended) OR **CSS Modules + SASS**
- Extract all design tokens (colors, spacing, fonts) from LESS files
- Maintain exact visual parity

### UI Components
- **Shadcn/ui** (recommended) OR **Material-UI** OR **Ant Design**
- Base: **Radix UI** (headless) + Tailwind CSS

### Forms & Validation
- **React Hook Form**
- **Zod** (schema validation)

### HTTP & Real-time
- **Fetch API** (native) + TanStack Query
- **XMPP/Strophe** - Port existing implementation to TypeScript
- **WebSocket** - Native WebSocket API + React hooks

### Rich Text Editor
- **TipTap** (recommended) OR **Quill React**

### Charts
- **Recharts** (recommended) OR **Victory**

### File Handling
- **react-dropzone** / **filepond** - File upload
- **@aws-sdk/client-s3** (v3) - AWS S3
- **xlsx** - Excel handling (keep same library)
- **file-saver** - File download (keep same library)

### Build & Dev Tools
- **Next.js built-in** (Turbopack)
- **ESLint** + **Prettier**
- **TypeScript** strict mode

---

## Migration Process

### Phase 1: Project Setup

1. **Initialize Next.js Project**
   ```bash
   npx create-next-app@latest modern-app --typescript --tailwind --app
   ```

2. **Install Dependencies**
   - TanStack Query, Zustand, React Hook Form, Zod
   - UI component library (Shadcn/ui recommended)
   - All required libraries from library migration matrix

3. **Set Up Project Structure**
   - Create folder structure as outlined above
   - Set up TypeScript strict mode
   - Configure Tailwind CSS with design tokens from LESS files
   - Set up ESLint, Prettier

4. **Create Shared API Layer**
   - Extract all API calls to TypeScript services in `/shared/api/`
   - Create TypeScript types for all API requests/responses
   - Document all API endpoints
   - This API layer will be used by both AngularJS and React apps

5. **Set Up Routing Bridge**
   - Create routing logic to decide: AngularJS route OR React route
   - Start with all routes pointing to AngularJS
   - As features migrate, switch routes to React

### Phase 2: Feature Migration (One Feature at a Time)

For each feature, follow this process:

#### Step 1: Analyze AngularJS Feature
- Read all files for the feature (controllers, directives, services, templates)
- Understand the business logic
- Identify all dependencies
- Map all API calls
- Document all UI states (loading, error, success, etc.)

#### Step 2: Generate React Implementation
- Create TypeScript types/interfaces for all data models
- Generate React components (convert directives/controllers)
- Convert HTML templates to JSX (maintain exact structure)
- Convert LESS styles to Tailwind CSS (exact visual parity)
- Create React hooks for state management
- Set up API integration with TanStack Query
- Port all business logic exactly

#### Step 3: Ensure Feature Completeness
- **ALL** functionality from AngularJS version must be present
- **ALL** form validations must work identically
- **ALL** error states must be handled
- **ALL** edge cases must be covered
- **ALL** permission checks must work
- **ALL** real-time features must work (if applicable)
- **ALL** animations/transitions must match

#### Step 4: UI Parity Verification
- Extract exact CSS values from LESS files (colors, spacing, fonts)
- Match layout exactly (grid, flexbox, positioning)
- Match all interactive states (hover, focus, disabled, active)
- Match animations (timing, easing, duration)
- Use same images/icons/assets
- Match responsive breakpoints

#### Step 5: Testing Readiness
- Code must compile without errors
- TypeScript strict mode (no `any` types)
- All components must be functional
- All API integrations must be set up
- All routes must be configured
- Feature must be accessible via URL

### Phase 3: Feature-by-Feature Migration Order

Migrate features in this order (easiest to hardest):

1. **Authentication & Login**
2. **MFA (Multi-Factor Auth)**
3. **User Directory**
4. **Account Settings**
5. **Notification Settings**
6. **Customize Feed Settings**
7. **Network Information**
8. **Security Settings**
9. **SSO Settings**
10. **Monitor Content**
11. **SMS Notifications**
12. **Groups Management**
13. **Integrations Directory**
14. **File Upload/Sharing**
15. **Search System**
16. **Links/Web View**
17. **Polls**
18. **Feed/Activity Stream**
19. **Comments System**
20. **Likes System**
21. **Common Components** (video player, audio player, modals)
22. **Notes/Documents**
23. **RTC/Collaboration**
24. **Analytics System**
25. **Track Filters**
26. **Dynamic Forms**
27. **Home/Layout**
28. **Rewards/Awards System**
29. **Chat System** (most complex - do last)
30. **Onboarding**
31. **Invites**

---

## Code Generation Guidelines

### Component Conversion

**AngularJS Directive/Controller → React Component:**

```typescript
// AngularJS
.directive('cnvUserProfile', ['userService', function(userService) {
  return {
    restrict: 'E',
    scope: { userId: '=' },
    templateUrl: 'user/profile.tpl.html',
    controller: function($scope) {
      $scope.user = null;
      userService.getUser($scope.userId).then(function(user) {
        $scope.user = user;
      });
    }
  };
}]);

// React Component
interface UserProfileProps {
  userId: string;
}

export function UserProfile({ userId }: UserProfileProps) {
  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => userService.getUser(userId)
  });

  if (isLoading) return <Loading />;
  if (error) return <Error />;
  if (!user) return null;

  return (
    <div className="user-profile">
      {/* Exact HTML structure from AngularJS template */}
    </div>
  );
}
```

### Service Conversion

**AngularJS Service → TypeScript Service + React Hook:**

```typescript
// AngularJS
.factory('userService', ['$http', '$q', function($http, $q) {
  return {
    getUsers: function() {
      var deferred = $q.defer();
      $http.get('/api/users').then(function(response) {
        deferred.resolve(response.data);
      });
      return deferred.promise;
    }
  };
}]);

// TypeScript Service
export class UserService {
  async getUsers(): Promise<User[]> {
    const response = await fetch('/api/users');
    return response.json();
  }
}

// React Hook
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => userService.getUsers()
  });
}
```

### Template Conversion

**AngularJS Template → React JSX:**

```html
<!-- AngularJS -->
<div ng-if="isVisible" ng-click="handleClick()">
  <input ng-model="user.name" />
  <div ng-repeat="item in items">{{item.name}}</div>
</div>

<!-- React JSX -->
{isVisible && (
  <div onClick={handleClick}>
    <input value={user.name} onChange={(e) => setUser({...user, name: e.target.value})} />
    {items.map(item => <div key={item.id}>{item.name}</div>)}
  </div>
)}
```

### State Management

**AngularJS $scope + Backbone → Zustand:**

```typescript
// AngularJS + Backbone
var usersService = {
  users: new Backbone.Collection(),
  on: Backbone.Events.on,
  trigger: Backbone.Events.trigger
};

// Zustand Store
interface UsersStore {
  users: User[];
  setUsers: (users: User[]) => void;
}

export const useUsersStore = create<UsersStore>((set) => ({
  users: [],
  setUsers: (users) => set({ users })
}));
```

---

## Critical Library Migrations

### 1. Bootstrap 3.2.0 → Tailwind CSS
- Extract all CSS values from LESS files
- Create Tailwind config with exact design tokens
- Convert all Bootstrap classes to Tailwind utilities
- Maintain exact spacing, colors, typography

### 2. Quill → TipTap (Rich Text Editor)
- Port all Quill plugins to TipTap extensions
- Maintain all formatting features
- Port real-time collaboration (if applicable)
- Test all editor functionality

### 3. D3.js/angular-nvd3 → Recharts
- Port all chart configurations
- Maintain all chart types
- Port data processing logic
- Test all chart interactions

### 4. XMPP/Strophe → TypeScript Port
- Port entire XMPP SDK to TypeScript
- Create React hooks wrapper
- Maintain all XMPP functionality
- Test all message types, presence, etc.

### 5. jQuery → Native DOM/React Refs
- Remove all jQuery usage
- Convert to React patterns
- Use refs for DOM manipulation when needed
- Maintain all functionality

---

## Quality Standards

### TypeScript
- **Strict mode enabled**
- **No `any` types** (use `unknown` if needed)
- All functions must have proper types
- All API responses must be typed
- All component props must be typed

### Code Quality
- Follow React best practices
- Use functional components with hooks
- Proper error handling
- Loading states for all async operations
- Proper cleanup (useEffect cleanup functions)

### UI/UX
- Exact visual parity with AngularJS version
- All animations must match
- All interactive states must match
- Responsive behavior must match
- Accessibility maintained

### Testing
- Code must compile without errors
- All TypeScript types must be correct
- Components must be functional
- API integrations must be set up
- Routes must be accessible

---

## What to Do When User Reports Issues

When the user tests and reports that something doesn't work:

1. **Understand the Issue**
   - Ask for specific details (what feature, what action, what error)
   - Compare with AngularJS implementation
   - Identify the root cause

2. **Fix the Issue**
   - Update the code to match AngularJS behavior exactly
   - Ensure UI matches exactly
   - Test the fix (if possible)
   - Verify all edge cases

3. **Iterate**
   - User tests again
   - Fix any remaining issues
   - Continue until feature works identically to AngularJS

---

## Deliverables for Each Feature

When you complete migrating a feature, it should:

1. ✅ **Compile without errors** (TypeScript strict mode)
2. ✅ **Be accessible via URL** (routing configured)
3. ✅ **Have all functionality** (identical to AngularJS)
4. ✅ **Match UI exactly** (1:1 visual parity)
5. ✅ **Handle all states** (loading, error, success, empty)
6. ✅ **Work with real API** (API integration complete)
7. ✅ **Be testable** (user can test immediately)

---

## Important Notes

1. **Start with Simple Features**: Begin with authentication, settings, user directory - these are isolated and easier to test

2. **One Feature at a Time**: Complete one feature fully before moving to the next. Don't start multiple features simultaneously.

3. **Maintain AngularJS App**: Don't modify the existing AngularJS app. Keep it running as-is. Only create new React code.

4. **Shared API Layer**: Use the shared API layer so both apps use the same API calls and data structures.

5. **Feature Flags**: Consider using feature flags to gradually roll out React features while keeping AngularJS as fallback.

6. **Documentation**: Document any assumptions, API contracts, or complex logic for future reference.

---

## Success Criteria

A feature is considered successfully migrated when:

- ✅ All functionality works identically to AngularJS version
- ✅ UI looks exactly the same (pixel-perfect)
- ✅ All edge cases handled
- ✅ All error states handled
- ✅ All loading states handled
- ✅ All form validations work
- ✅ All permissions work
- ✅ All real-time features work (if applicable)
- ✅ Code compiles without errors
- ✅ TypeScript strict mode passes
- ✅ User can test and verify it works

---

## Start Migration

Begin with **Phase 1: Project Setup** and then proceed feature-by-feature in the order specified above. For each feature, follow the migration process steps (Analyze → Generate → Ensure Completeness → UI Parity → Testing Readiness).

Remember: **Zero feature loss** and **absolute UI parity** are non-negotiable requirements.

---

## Immediate Action Plan

### Step 1: Read and Understand the Codebase
1. Read `FUNCTIONAL_REQUIREMENTS.md` to understand all features
2. Read `COMPREHENSIVE_MIGRATION_PLAN.md` for detailed migration strategy
3. Read `MIGRATION_APPROACH_EVALUATION.md` for approach justification
4. Analyze the existing AngularJS codebase structure

### Step 2: Initialize the Project
1. Create `/modern-app/` directory
2. Initialize Next.js 15+ with TypeScript and Tailwind CSS
3. Set up the complete project structure as specified
4. Install all required dependencies

### Step 3: Extract Design Tokens
1. Read all LESS files from `/src/app/` and `/src/less/`
2. Extract all colors, spacing, fonts, breakpoints
3. Create `tailwind.config.js` with exact design tokens
4. Document all CSS values for UI parity

### Step 4: Create Shared API Layer
1. Analyze all API calls in AngularJS services
2. Create TypeScript API client in `/shared/api/`
3. Create TypeScript types for all API requests/responses
4. Document all API endpoints

### Step 5: Set Up Routing Bridge
1. Analyze AngularJS routing (UI-Router states)
2. Create Next.js routes matching AngularJS routes
3. Set up routing bridge to route to AngularJS or React
4. Start with all routes pointing to AngularJS

### Step 6: Begin Feature Migration
Start with Feature #1: **Authentication & Login**
- Analyze all authentication-related files
- Generate React components
- Convert templates
- Set up API integration
- Make it testable

### Step 7: Iterate Based on User Feedback
- User tests the migrated feature
- User reports any issues
- Fix issues to match AngularJS exactly
- Continue until feature works identically
- Move to next feature

---

## Code Analysis Checklist (For Each Feature)

Before generating React code for a feature, ensure you have:

- [ ] Read all AngularJS files for the feature (controllers, directives, services, templates)
- [ ] Understood all business logic
- [ ] Identified all API calls and endpoints
- [ ] Mapped all dependencies
- [ ] Documented all UI states (loading, error, success, empty)
- [ ] Extracted all CSS values from LESS files
- [ ] Identified all form validations
- [ ] Identified all permission checks
- [ ] Identified all edge cases
- [ ] Identified all real-time features (if any)
- [ ] Identified all animations/transitions

---

## File Reading Strategy

For each feature migration, read these files in order:

1. **Service Files** (understand data layer)
   - `src/app/services/[feature]Service.js`
   - `src/app/[feature]/[feature]Service.js`

2. **Controller Files** (understand business logic)
   - `src/app/[feature]/[feature]Ctrl.js`
   - `src/app/[feature]/[feature]Controller.js`

3. **Directive Files** (understand components)
   - `src/app/[feature]/**/*.js` (directives)
   - `src/app/common/directives/**/*.js` (if used)

4. **Template Files** (understand UI structure)
   - `src/app/[feature]/**/*.tpl.html`
   - `src/app/[feature]/templates/**/*.html`

5. **Style Files** (understand visual design)
   - `src/app/[feature]/**/*.less`
   - `src/app/[feature]/styles/**/*.less`

6. **Related Files** (understand dependencies)
   - Shared components used
   - Common utilities used
   - API services used

---

## API Analysis Strategy

For each feature, identify:

1. **All API Endpoints**
   - GET requests
   - POST requests
   - PUT requests
   - DELETE requests
   - WebSocket connections
   - XMPP messages (if applicable)

2. **Request/Response Formats**
   - Request parameters
   - Request body structure
   - Response data structure
   - Error response format

3. **API Dependencies**
   - Authentication requirements
   - Permission requirements
   - Rate limiting
   - Caching requirements

---

## UI Extraction Strategy

For each feature, extract:

1. **Layout Structure**
   - Container structure
   - Grid/flexbox layout
   - Positioning (absolute, relative, fixed)
   - Z-index values

2. **Spacing**
   - All margin values (top, right, bottom, left)
   - All padding values (top, right, bottom, left)
   - Gap values (if using grid/flexbox)

3. **Typography**
   - Font families
   - Font sizes (exact px/rem values)
   - Font weights
   - Line heights
   - Letter spacing
   - Text colors (exact hex codes)

4. **Colors**
   - Background colors (exact hex codes)
   - Text colors (exact hex codes)
   - Border colors (exact hex codes)
   - Hover colors
   - Focus colors
   - Active colors
   - Disabled colors

5. **Borders & Shadows**
   - Border widths
   - Border styles
   - Border radius
   - Box shadows (exact values)

6. **Animations**
   - Transition properties
   - Transition durations
   - Transition timing functions
   - Animation keyframes
   - Animation durations

---

## Testing Instructions for User

After each feature migration, the user should test:

1. **Functional Testing**
   - [ ] All buttons work
   - [ ] All forms submit correctly
   - [ ] All validations work
   - [ ] All error states display correctly
   - [ ] All loading states display correctly
   - [ ] All empty states display correctly
   - [ ] All permissions work correctly
   - [ ] All edge cases handled

2. **UI Testing**
   - [ ] Layout matches AngularJS exactly
   - [ ] Spacing matches exactly
   - [ ] Colors match exactly
   - [ ] Typography matches exactly
   - [ ] Images/icons display correctly
   - [ ] Animations match exactly
   - [ ] Responsive behavior matches
   - [ ] Hover states work
   - [ ] Focus states work
   - [ ] Disabled states work

3. **Integration Testing**
   - [ ] Feature works with other features
   - [ ] Navigation works correctly
   - [ ] State persists correctly
   - [ ] Real-time updates work (if applicable)

4. **Report Issues**
   - Describe what doesn't work
   - Provide steps to reproduce
   - Compare with AngularJS behavior
   - Include screenshots if UI doesn't match

---

## Ready to Start

You now have everything needed to begin the migration. Start with **Phase 1: Project Setup** and proceed systematically through each feature. Remember: quality over speed - ensure each feature works perfectly before moving to the next.

---

## Execution Instructions

### For the AI Assistant (You)

When you receive this prompt:

1. **Start Immediately**: Begin with Phase 1 (Project Setup) - don't wait for confirmation
2. **Read All Relevant Files**: For each feature, read ALL related files before generating code
3. **Generate Complete Code**: Don't leave placeholders - generate fully functional code
4. **Ensure Compilation**: All code must compile without errors
5. **Make It Testable**: Each feature must be accessible and testable immediately
6. **Document Assumptions**: If you make any assumptions, document them clearly

### For Each Feature Migration

1. **Read First**: Read all AngularJS files for the feature completely
2. **Understand Fully**: Understand all business logic, dependencies, and edge cases
3. **Generate Complete**: Generate all React components, services, hooks, types
4. **Convert Templates**: Convert all HTML templates to JSX with exact structure
5. **Extract Styles**: Extract all CSS values and convert to Tailwind
6. **Set Up Routes**: Configure Next.js routes for the feature
7. **Test Compilation**: Ensure everything compiles
8. **Make Accessible**: Feature should be accessible via URL for testing

### When User Reports Issues

1. **Read the Issue**: Understand what doesn't work
2. **Compare with AngularJS**: Read the AngularJS implementation
3. **Identify Root Cause**: Find why it doesn't work
4. **Fix Immediately**: Update the code to match AngularJS exactly
5. **Verify Fix**: Ensure the fix addresses the issue
6. **Continue**: Move forward once issue is resolved

---

## Key Principles

1. **Zero Feature Loss**: Every single feature must work identically
2. **UI Parity**: Visual matching must be pixel-perfect
3. **One Feature at a Time**: Complete one fully before starting next
4. **Testable Immediately**: Each feature must be testable right away
5. **Fix Issues Promptly**: When user reports issues, fix them immediately
6. **No Shortcuts**: Don't simplify or omit anything - match AngularJS exactly

---

## Start Now

Begin the migration immediately. Start with Phase 1: Project Setup, then proceed feature-by-feature. Generate complete, working, testable code for each feature. The user will test and provide feedback - fix issues as they arise and continue until all features are migrated and working perfectly.

---

## Quick Reference: Key Files to Read

### For Understanding the Application
- `src/app/app.js` - Main AngularJS app configuration
- `src/app/main/MainCtrl.js` - Main controller (orchestrates app)
- `src/app/config.js` - Application configuration
- `src/index.html` - Main HTML entry point
- `FUNCTIONAL_REQUIREMENTS.md` - All features documented
- `COMPREHENSIVE_MIGRATION_PLAN.md` - Migration strategy details

### For Each Feature Migration
- `src/app/[feature]/[feature]Ctrl.js` or `[feature]Controller.js` - Controller
- `src/app/[feature]/[feature]Service.js` - Service (if exists)
- `src/app/services/[feature]Service.js` - Service (if in services folder)
- `src/app/[feature]/**/*.tpl.html` - Templates
- `src/app/[feature]/**/*.less` - Styles
- `src/app/[feature]/**/*.js` - All related JS files

### For Shared Components
- `src/app/common/` - Shared components and utilities
- `src/app/components/` - Reusable components
- `src/app/services/` - All services (79 files)

---

## Final Checklist Before Starting

- [ ] Understand the codebase structure
- [ ] Understand all 31 features to migrate
- [ ] Understand the co-existence strategy
- [ ] Ready to create `/modern-app/` directory
- [ ] Ready to keep `/src/app/` untouched
- [ ] Ready to create `/shared/` for shared code
- [ ] Understand zero feature loss requirement
- [ ] Understand UI parity requirement
- [ ] Ready to test and iterate

**You are now ready to begin the migration. Start with Phase 1: Project Setup.**

