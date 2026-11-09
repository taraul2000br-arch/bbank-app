// Supabase-backed authentication.
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyAdminStatus } from "./admin.functions";
import { callWithRetry } from "./server-call";

export type { Session, User };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const safetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 4000);

    // 1) listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!isMounted) return;
      setSession(s);
      setLoading(false);
    });

    // 2) hydrate existing
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data?.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(safetyTimer);
      });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useIsAdmin(userId: string | null | undefined, _userEmail?: string) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [level, setLevel] = useState<"master" | "geral" | "comum" | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const fetchAdminStatus = useServerFn(getMyAdminStatus);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLevel(null);
      setIsExpired(false);
      setReferralCode(null);
      setLoading(false);
      setCheckedUserId(null);
      return;
    }

    setLoading(true);
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setCheckedUserId(userId);
      }
    }, 7000);

    callWithRetry(() => fetchAdminStatus())
      .then((res) => {
        if (!cancelled) {
          setLevel(res.level);
          setIsAdmin(res.isAdmin);
          setIsExpired(res.isExpired);
          setReferralCode(res.referralCode ?? null);
          setLoading(false);
          setCheckedUserId(userId);
        }
      })
      .catch((err) => {
        console.error("useIsAdmin check error:", err);
        if (!cancelled) {
          setLevel(null);
          setIsAdmin(false);
          setIsExpired(false);
          setReferralCode(null);
          setLoading(false);
          setCheckedUserId(userId);
        }
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, fetchAdminStatus]);

  const isChecking = Boolean(userId) && (checkedUserId !== userId || loading);

  return { isAdmin, loading: isChecking, level, isExpired, referralCode };
}

export async function signOut() {
  await supabase.auth.signOut();
}
