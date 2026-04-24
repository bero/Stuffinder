import { useState, useEffect, useCallback } from 'preact/hooks';
import { supabase, clearPhotoUrlCache } from './supabase';
import type { Session } from '@supabase/supabase-js';
import type { HouseholdMembership } from '../types/database';

const ACTIVE_KEY = 'stuffinder:activeHouseholdId';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}

export function useMemberships(session: Session | null) {
  const [memberships, setMemberships] = useState<HouseholdMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) {
      setMemberships([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, joined_at, households(id, name, created_at)')
        .eq('user_id', session.user.id);
      if (error) throw error;
      setMemberships(
        (data || []).map((row: any) => ({
          household_id: row.household_id,
          role: row.role,
          joined_at: row.joined_at,
          household: row.households,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load households');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { load(); }, [load]);

  return { memberships, loading, error, reload: load };
}

export function useActiveHousehold(memberships: HouseholdMembership[]) {
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(ACTIVE_KEY));

  useEffect(() => {
    if (memberships.length === 0) {
      setActiveId(null);
      localStorage.removeItem(ACTIVE_KEY);
      return;
    }
    const ids = memberships.map(m => m.household_id);
    const stored = localStorage.getItem(ACTIVE_KEY);
    if (stored && ids.includes(stored)) {
      setActiveId(stored);
    } else {
      const first = ids[0];
      localStorage.setItem(ACTIVE_KEY, first);
      setActiveId(first);
    }
  }, [memberships]);

  function select(id: string) {
    if (id !== activeId) clearPhotoUrlCache();
    localStorage.setItem(ACTIVE_KEY, id);
    setActiveId(id);
  }

  return { activeId, select };
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
  return data;
}

export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

export async function signOut() {
  localStorage.removeItem(ACTIVE_KEY);
  clearPhotoUrlCache();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
