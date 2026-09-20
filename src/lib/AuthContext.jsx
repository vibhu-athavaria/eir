import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { queryClientInstance } from '@/lib/query-client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Tracks the signed-in user's id across onAuthStateChange firings so we can tell
  // "identity actually changed" (sign-out, or a different user signing in on the
  // same device) apart from the harmless duplicate INITIAL_SESSION firing for the
  // same user — only the former should blow away the shared React Query cache.
  const previousUserIdRef = useRef(undefined);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('Failed to load profile', error);
      setProfileError(error);
      return;
    }
    setProfileError(null);
    setProfile(data ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (!mounted) return;
      previousUserIdRef.current = initialSession?.user?.id ?? null;
      setSession(initialSession);
      await loadProfile(initialSession?.user?.id);
      if (mounted) setIsLoadingAuth(false);
    }).catch((error) => {
      console.error('Failed to load auth session', error);
      if (mounted) setIsLoadingAuth(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user?.id ?? null;
      // Clear the shared query cache whenever the signed-in identity changes (sign-out,
      // or a different user signing in) so the next user on this device never briefly
      // renders the previous user's cached mood/self-harm calendar or vent text.
      if (previousUserIdRef.current !== undefined && previousUserIdRef.current !== newUserId) {
        queryClientInstance.clear();
      }
      previousUserIdRef.current = newUserId;
      setSession(newSession);
      loadProfile(newUserId);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updateProfile = async (fields) => {
    if (!session?.user?.id) return null;
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  };

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        created_at: session.user.created_at,
        ...profile,
      }
    : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!session,
        isLoadingAuth,
        profileError,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
