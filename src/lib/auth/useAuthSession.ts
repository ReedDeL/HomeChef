import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export interface AuthSessionState {
  isLoading: boolean;
  isAuthenticated: boolean;
}

const initialAuthSessionState: AuthSessionState = {
  isLoading: true,
  isAuthenticated: false,
};

export function useAuthSession(): AuthSessionState {
  const [state, setState] = useState(initialAuthSessionState);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        setState({
          isLoading: false,
          isAuthenticated: !error && data.session !== null,
        });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ isLoading: false, isAuthenticated: session !== null });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}
