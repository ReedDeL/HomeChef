import { useState } from 'react';
import { router, Link } from 'expo-router';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useToast } from '@/components/ToastProvider';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    showToast('Signed in');
    router.back();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={styles.input}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <PrimaryButton label="Sign in" onPress={submit} disabled={submitting || !email || !password} />
      <Link href="/auth/sign-up" style={styles.link}>
        <Text style={styles.linkText}>Don't have an account? Create one</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F2', padding: 20, gap: 12, justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#D0D5CE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'white',
  },
  error: { color: '#B4232A', fontSize: 13 },
  link: { marginTop: 8, alignItems: 'center' },
  linkText: { color: '#1F6F50', fontWeight: '600', textAlign: 'center' },
});
