import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';

import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile, UserRole } from './types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  role: UserRole | null;
  isApproved: boolean;
  isAdmin: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: Exclude<UserRole, 'pending' | 'admin'>
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPasswordReset: (
    email: string
  ) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // FETCH PROFILE
  // --------------------------------------------------

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        setProfile(null);
        return null;
      }

      setProfile(data as Profile | null);

      return data as Profile | null;
    } catch (error) {
      console.error('Unexpected profile error:', error);
      setProfile(null);
      return null;
    }
  }, []);

  // --------------------------------------------------
  // REFRESH PROFILE
  // --------------------------------------------------

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  // --------------------------------------------------
  // INITIAL AUTH SESSION
  // --------------------------------------------------

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('Get session error:', error);
        }

        if (!mounted) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // --------------------------------------------------
    // AUTH STATE LISTENER
    // --------------------------------------------------

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      console.log('Auth event:', event);

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (!newSession?.user) {
        setProfile(null);
      }

      // IMPORTANT:
      // Do not fetch profile directly inside the auth callback.
      // Run it after the auth event has completed.
      if (newSession?.user) {
        setTimeout(async () => {
          if (!mounted) return;

          await fetchProfile(newSession.user.id);

          if (mounted) {
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // --------------------------------------------------
  // SIGN IN
  // --------------------------------------------------

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);

        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          console.error('Sign in error:', error);
          setLoading(false);
          return { error: error.message };
        }

        if (data.user) {
          setSession(data.session);
          setUser(data.user);

          await fetchProfile(data.user.id);
        }

        setLoading(false);

        return { error: null };
      } catch (error) {
        console.error('Unexpected sign in error:', error);

        setLoading(false);

        return {
          error: 'Unexpected error during login.',
        };
      }
    },
    [fetchProfile]
  );

  // --------------------------------------------------
  // SIGN UP
  // --------------------------------------------------

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: Exclude<UserRole, 'pending' | 'admin'>
    ) => {
      const isIndusuniEmail = (e: string) =>
        /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)*indusuni\.ac\.in$/i.test(
          e
        );

      if (!isIndusuniEmail(email)) {
        return {
          error:
            'Only @indusuni.ac.in email addresses are accepted',
        };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
          },
        });

        if (error) {
          console.error('SignUp error:', error, data);

          return {
            error: error.message ?? 'Sign up failed',
          };
        }

        console.log('Signup successful:', data);

        // If email confirmation is enabled,
        // session may be null until user confirms email.
        if (data.session && data.user) {
          setSession(data.session);
          setUser(data.user);

          await fetchProfile(data.user.id);
        }

        return { error: null };
      } catch (error) {
        console.error('Unexpected signUp error:', error);

        return {
          error:
            'Unexpected error during sign up. Check console/logs.',
        };
      }
    },
    [fetchProfile]
  );

  // --------------------------------------------------
  // SIGN OUT
  // --------------------------------------------------

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setProfile(null);
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------
  // PASSWORD RESET
  // --------------------------------------------------

  const sendPasswordReset = useCallback(async (email: string) => {
    try {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo:
            import.meta.env.VITE_APP_URL ??
            window.location.origin,
        });

      if (error) {
        console.error('Password reset error:', error);

        return {
          error: error.message ?? 'Password reset failed',
        };
      }

      return { error: null };
    } catch (error) {
      console.error(
        'Unexpected resetPassword error:',
        error
      );

      return {
        error:
          'Unexpected error while requesting password reset.',
      };
    }
  }, []);

  // --------------------------------------------------
  // ROLE
  // --------------------------------------------------

  const role = profile?.role ?? null;

  const isApproved = role !== null;

  const isAdmin = role === 'admin';

  // --------------------------------------------------
  // PROVIDER
  // --------------------------------------------------

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        role,
        isApproved,
        isAdmin,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}