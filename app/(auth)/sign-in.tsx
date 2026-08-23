import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { signInWithGoogle } from '@/lib/auth/google';
import { radius, space, touchTarget } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

const SIGN_IN_ERROR = "Couldn't sign you in. Check your connection and try again.";

export default function SignInScreen() {
  const { color } = useTheme();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    setIsSigningIn(true);

    try {
      const outcome = await signInWithGoogle();
      if (outcome.type === 'cancelled') return;
    } catch {
      setError(SIGN_IN_ERROR);
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <View style={styles.intro}>
          <Text variant="caption" tone="accent">
            HomeChef
          </Text>
          <Text variant="display">Cook with what you have.</Text>
          <Text variant="body" tone="muted">
            Sign in to keep your pantry and kitchen ready wherever you cook.
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        {error ? <Text accessibilityLiveRegion="polite">{error}</Text> : null}
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          accessibilityHint="Opens Google to sign in to HomeChef"
          accessibilityState={{ busy: isSigningIn, disabled: isSigningIn }}
          disabled={isSigningIn}
          onPress={handleSignIn}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: color.accent,
              opacity: isSigningIn ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text variant="bodyStrong" tone="onAccent">
            {isSigningIn ? 'Signing in…' : 'Continue with Google'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    justifyContent: 'center',
  },
  intro: {
    gap: space.md,
  },
  actions: {
    gap: space.md,
  },
  button: {
    height: touchTarget.primaryCtaHeight,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
