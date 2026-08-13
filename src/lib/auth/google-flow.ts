export type GoogleOAuthOutcome = { type: 'redirecting' | 'signed-in' | 'cancelled' };

export interface GoogleOAuthFlowDependencies {
  platform: 'android' | 'web';
  redirectTo: string;
  startWebRedirect(redirectTo: string): Promise<void>;
  requestNativeUrl(redirectTo: string): Promise<string>;
  openNativeSession(url: string, redirectTo: string): Promise<{ type: string; url?: string }>;
  readSessionTokens(url: string): { accessToken: string | null; refreshToken: string | null };
  setSession(tokens: { accessToken: string; refreshToken: string }): Promise<void>;
}

export async function runGoogleOAuthFlow(
  dependencies: GoogleOAuthFlowDependencies
): Promise<GoogleOAuthOutcome> {
  if (dependencies.platform === 'web') {
    await dependencies.startWebRedirect(dependencies.redirectTo);
    return { type: 'redirecting' };
  }
  const url = await dependencies.requestNativeUrl(dependencies.redirectTo);
  const result = await dependencies.openNativeSession(url, dependencies.redirectTo);
  if (result.type !== 'success' || !result.url) return { type: 'cancelled' };
  const { accessToken, refreshToken } = dependencies.readSessionTokens(result.url);
  if (!accessToken || !refreshToken) throw new Error('Google sign-in did not return a session.');
  await dependencies.setSession({ accessToken, refreshToken });
  return { type: 'signed-in' };
}
