import { describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({ os: 'web' }));

vi.mock('expo-auth-session', () => ({ makeRedirectUri: vi.fn() }));
vi.mock('expo-auth-session/build/QueryParams', () => ({ getQueryParams: vi.fn() }));
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));
vi.mock('react-native', () => ({
  Platform: {
    get OS(): string {
      return platformState.os;
    },
  },
}));

import { makeRedirectUri } from 'expo-auth-session';

import { createGoogleOAuthDependencies, signInWithGoogle, signOut } from '@/lib/auth/google';
import { supabase } from '@/lib/supabase';

describe('createGoogleOAuthDependencies', () => {
  it('uses a regular Supabase redirect on web', async () => {
    const signInWithOAuth = vi.fn(async () => ({ data: {}, error: null }));
    const dependencies = createGoogleOAuthDependencies({
      platform: 'web',
      redirectTo: 'https://homechef.example.com',
      signInWithOAuth,
      setSession: vi.fn(async () => ({ error: null })),
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(),
    });
    await dependencies.startWebRedirect('https://homechef.example.com');
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://homechef.example.com' },
    });
  });

  it('requests an Android URL without auto-navigation', async () => {
    const signInWithOAuth = vi.fn(async () => ({
      data: { url: 'https://auth.example' },
      error: null,
    }));
    const dependencies = createGoogleOAuthDependencies({
      platform: 'android',
      redirectTo: 'homechef://auth/callback',
      signInWithOAuth,
      setSession: vi.fn(async () => ({ error: null })),
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(),
    });
    await expect(dependencies.requestNativeUrl('homechef://auth/callback')).resolves.toBe(
      'https://auth.example'
    );
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'homechef://auth/callback', skipBrowserRedirect: true },
    });
  });

  it('maps callback tokens for the flow without retaining provider tokens', () => {
    const dependencies = createGoogleOAuthDependencies({
      platform: 'android',
      redirectTo: 'homechef://auth/callback',
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(async () => ({ error: null })),
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(() => ({
        errorCode: null,
        params: { access_token: 'session-access', refresh_token: 'session-refresh' },
      })),
    });

    expect(dependencies.readSessionTokens('homechef://auth/callback')).toEqual({
      accessToken: 'session-access',
      refreshToken: 'session-refresh',
    });
  });

  it('rejects a callback containing an OAuth error code', () => {
    const dependencies = createGoogleOAuthDependencies({
      platform: 'android',
      redirectTo: 'homechef://auth/callback',
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(async () => ({ error: null })),
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(() => ({ errorCode: 'access_denied', params: {} })),
    });

    expect(() => dependencies.readSessionTokens('homechef://auth/callback')).toThrow(
      'Google sign-in failed.'
    );
  });

  it('rejects a Supabase callback containing an OAuth error parameter', () => {
    const dependencies = createGoogleOAuthDependencies({
      platform: 'android',
      redirectTo: 'homechef://auth/callback',
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      setSession: vi.fn(async () => ({ error: null })),
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(() => ({
        errorCode: null,
        params: { error: 'access_denied', error_code: 'access_denied' },
      })),
    });

    expect(() => dependencies.readSessionTokens('homechef://auth/callback')).toThrow(
      'Google sign-in failed.'
    );
  });

  it('passes the callback session pair to Supabase', async () => {
    const setSession = vi.fn(async () => ({ error: null }));
    const dependencies = createGoogleOAuthDependencies({
      platform: 'android',
      redirectTo: 'homechef://auth/callback',
      signInWithOAuth: vi.fn(async () => ({ data: {}, error: null })),
      setSession,
      openAuthSessionAsync: vi.fn(),
      getQueryParams: vi.fn(),
    });

    await dependencies.setSession({
      accessToken: 'session-access',
      refreshToken: 'session-refresh',
    });

    expect(setSession).toHaveBeenCalledWith({
      access_token: 'session-access',
      refresh_token: 'session-refresh',
    });
  });

  it('rejects an unsupported platform before creating adapter dependencies', async () => {
    const makeRedirectUriMock = vi.mocked(makeRedirectUri);
    const signInWithOAuthMock = vi.mocked(supabase.auth.signInWithOAuth);
    makeRedirectUriMock.mockClear();
    signInWithOAuthMock.mockClear();
    platformState.os = 'ios';

    await expect(signInWithGoogle()).rejects.toThrow(
      'Google sign-in is not available on this platform.'
    );

    expect(makeRedirectUriMock).not.toHaveBeenCalled();
    expect(signInWithOAuthMock).not.toHaveBeenCalled();
    platformState.os = 'web';
  });

  it('delegates sign-out to Supabase', async () => {
    const signOutMock = vi.mocked(supabase.auth.signOut);
    signOutMock.mockResolvedValue({ error: null });

    await signOut();

    expect(signOutMock).toHaveBeenCalledOnce();
  });
});
