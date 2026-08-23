# Google OAuth for Android and Web Implementation Plan


**Goal:** Let Android and web users create or resume a HomeChef account with Google through Supabase Auth.

**Architecture:** A pure OAuth-flow module validates Android callbacks and contains no Expo or Supabase imports. A narrow adapter supplies Expo AuthSession, Expo WebBrowser, and Supabase calls. The root layout observes the persisted Supabase session and routes authenticated users to onboarding or home.

**Tech Stack:** Expo 57, Expo Router, React Native 0.86, TypeScript 6 strict mode, Vitest, @supabase/supabase-js, expo-auth-session, expo-web-browser.

**Governing spec:** docs/specs/2026-08-12-google-oauth-android-web-design.md

## File Structure

| File | Responsibility |
| --- | --- |
| src/lib/auth/google-flow.ts | Pure platform decision, cancellation, and callback token validation. |
| src/lib/auth/google.ts | Expo/Supabase adapter and public sign-in/sign-out calls. |
| src/lib/auth/session-route.ts | Pure sign-in, onboarding, or home route selector. |
| src/lib/auth/useAuthSession.ts | One initial session read and subscription lifecycle. |
| src/lib/auth/app-gate.ts | Pure current-route versus destination comparison. |
| app/(auth)/_layout.tsx, app/(auth)/sign-in.tsx | Sign-in route and accessible UI. |
| app/_layout.tsx | Auth-aware app gate. |
| supabase/config.toml, docs/06_API_KEYS_AND_ENV.md | Safe local config and hosted setup instructions. |

## Task 1: Build the pure Google OAuth flow with tests

**Files:**

- Create: src/lib/auth/google-flow.ts
- Create: src/lib/auth/google-flow.test.ts

**Interfaces:**

- Produces GoogleOAuthOutcome, GoogleOAuthFlowDependencies, and runGoogleOAuthFlow.
- Task 2 consumes these exact exports.

- [ ] **Step 1: Write the failing test**

> Implementation details belong in the referenced source files; this plan retains the contract and verification criteria.

- [ ] **Step 2: Verify RED**

Run: npx vitest run src/lib/auth/google-flow.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the smallest passing flow**


- [ ] **Step 4: Verify GREEN**

Run: npx vitest run src/lib/auth/google-flow.test.ts

Expected: PASS (4 tests).


## Task 2: Add the Expo and Supabase adapter

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Create: src/lib/auth/google.ts
- Create: src/lib/auth/google.test.ts

**Interfaces:**

- Consumes runGoogleOAuthFlow from Task 1.
- Produces signInWithGoogle(): Promise<GoogleOAuthOutcome> and signOut(): Promise<void> for Task 4.

- [ ] **Step 1: Install SDK-compatible dependencies**

Run: npx expo install expo-auth-session expo-web-browser

Expected: Expo selects SDK 57 versions and updates both package files. Do not hand-edit the lockfile.

- [ ] **Step 2: Write failing adapter tests**

> Implementation details belong in the referenced source files; this plan retains the contract and verification criteria.

- [ ] **Step 3: Verify RED**

Run: npx vitest run src/lib/auth/google.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the adapter**

Create a fully typed adapter dependency interface matching the test doubles. The implementation must:

1. call supabase.auth.signInWithOAuth with provider google and options redirectTo on web;
2. call the same API with skipBrowserRedirect: true on Android and throw when data.url is absent;
3. parse callbacks with QueryParams.getQueryParams, reject errorCode, and map access_token plus refresh_token to Task 1 tokens;
4. call supabase.auth.setSession with access_token plus refresh_token and throw Supabase errors;
5. use globalThis.location.origin on web and makeRedirectUri({ path: 'auth/callback' }) on Android;
6. call WebBrowser.maybeCompleteAuthSession() at module scope and WebBrowser.openAuthSessionAsync only through the Android dependency; and
7. implement signOut through supabase.auth.signOut.

Use these imports and final public function:


Do not add an iOS OAuth branch. If `Platform.OS` is neither `web` nor
`android`, `signInWithGoogle` throws `Google sign-in is not available on this
platform.` before creating adapter dependencies. The narrowed platform union
keeps that unsupported path explicit until Harshal's iOS task lands.

- [ ] **Step 5: Verify GREEN**

Run: npx vitest run src/lib/auth/google-flow.test.ts src/lib/auth/google.test.ts && npm run typecheck

Expected: all OAuth tests PASS and no TypeScript errors.


## Task 3: Create the tested session routing boundary

**Files:**

- Create: src/lib/auth/session-route.ts
- Create: src/lib/auth/session-route.test.ts
- Create: src/lib/auth/useAuthSession.ts
- Create: src/lib/auth/app-gate.ts

**Interfaces:**

- Produces authRoute(input) and useAuthSession().
- Task 4 consumes both exports.

- [ ] **Step 1: Write the failing selector tests**

> Implementation details belong in the referenced source files; this plan retains the contract and verification criteria.

- [ ] **Step 2: Verify RED**

Run: npx vitest run src/lib/auth/session-route.test.ts

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement selector and session hook**

~~~ts
export function authRoute(input: { isAuthenticated: boolean; onboardingDone: boolean }):
  | '/(auth)/sign-in'
  | '/(onboarding)/equipment'
  | '/' {
  if (!input.isAuthenticated) return '/(auth)/sign-in';
  return input.onboardingDone ? '/' : '/(onboarding)/equipment';
}
~~~


- [ ] **Step 4: Verify GREEN**

Run: npx vitest run src/lib/auth/session-route.test.ts && npm run typecheck

Expected: PASS (3 tests) and no TypeScript errors.


## Task 4: Add the sign-in UI and app gate

**Files:**

- Create: app/(auth)/_layout.tsx
- Create: app/(auth)/sign-in.tsx
- Modify: app/_layout.tsx

**Interfaces:**

- Consumes Tasks 2 and 3.
- Produces an accessible Google sign-in UI and routing that does not expose app screens to signed-out users.

- [ ] **Step 1: Write the app-gate regression test**

Create src/lib/auth/app-gate.test.ts:

> Implementation details belong in the referenced source files; this plan retains the contract and verification criteria.

- [ ] **Step 2: Verify RED**

Run: npx vitest run src/lib/auth/app-gate.test.ts

Expected: PASS. Task 3 has already established the authentication-first route
selector; this test is a regression check that the root gate does not replace a
route when it is already in the destination group.

- [ ] **Step 3: Implement UI and gate**

Create app/(auth)/_layout.tsx with a headerless fade-animation Stack. Create app/(auth)/sign-in.tsx using Screen, Text, and Pressable. Its button awaits signInWithGoogle, silently ignores an outcome with type cancelled, and renders exactly:

~~~text
Couldn't sign you in. Check your connection and try again.
~~~

For the button, use space.md, radius.md, touchTarget.primaryCtaHeight, and color.accent. Include all of:

~~~tsx
accessible
accessibilityRole="button"
accessibilityLabel="Continue with Google"
accessibilityHint="Opens Google to sign in to HomeChef"
~~~

Create src/lib/auth/app-gate.ts with needsRouteReplacement(currentGroup, target), which maps /(auth)/sign-in to (auth), /(onboarding)/equipment to (onboarding), and / to no group. It returns false only for an exact group match. Replace OnboardingGate in app/_layout.tsx with AppGate. It waits for Zustand hydration and useAuthSession().isLoading to finish, calls authRoute and needsRouteReplacement, then calls router.replace only when the function returns true. Scan and settings must no longer bypass sign-in.

- [ ] **Step 4: Verify GREEN and static checks**

Run: npx vitest run src/lib/auth/session-route.test.ts src/lib/auth/app-gate.test.ts && npm run check

Expected: route tests PASS, then lint, typecheck, tests, and format checks PASS.


## Task 5: Configure and verify Google OAuth securely

**Files:**

- Modify: supabase/config.toml
- Modify: docs/06_API_KEYS_AND_ENV.md

**Interfaces:**

- Consumes Task 2 redirect behavior.
- Produces safe local configuration and exact hosted-provider instructions.

- [ ] **Step 1: Add local-only provider configuration**

Add this block with no literal credential:

~~~toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET)"
skip_nonce_check = false
~~~

Set local additional redirect URLs to the explicit local web origin and homechef://**.

- [ ] **Step 2: Document hosted configuration**

In docs/06_API_KEYS_AND_ENV.md, document these steps: create one Google Cloud Web application OAuth client; copy the Supabase Dashboard Google-provider callback URL as its authorized redirect URI; add only deployed and local web origins as JavaScript origins; enter the ID and secret in Supabase Dashboard → Authentication → Providers → Google; add the deployed web origin, local web origin, and homechef://** to Supabase Redirect URLs; and store local credentials only in ignored supabase/.env.local.

- [ ] **Step 3: Check committed configuration**

Run: git diff --check && rg -n "SUPABASE_AUTH_EXTERNAL_GOOGLE" supabase/config.toml docs/06_API_KEYS_AND_ENV.md

Expected: no whitespace errors and only environment-variable names, never credential values.

- [ ] **Step 4: Verify web and Android round trips**

Run npm run web, complete Google sign-in on the configured local origin, and verify a new account reaches equipment onboarding and reload retains the session. Then run npm run android:dev, complete Google sign-in in the Android auth browser, verify the homechef:// return opens HomeChef, and verify relaunch retains the session.


## Plan Self-Review

- **Spec coverage:** Tasks 1–2 cover Android/web OAuth and callbacks; Task 3 covers session hydration; Task 4 covers accessible UI and session-aware routes; Task 5 covers provider configuration and live verification.
- **Security coverage:** no Google secret enters client code, no provider token is persisted, and authorization remains Supabase-session and RLS based.
- **Scope coverage:** iOS, Apple Sign-In, password login, data schema, RLS, Edge Functions, and Google API access are excluded.
- **Placeholder scan:** no TBD or TODO remains.
- **Type consistency:** Task 1 exports are consumed by Task 2, and Task 3 exports are consumed by Task 4.
