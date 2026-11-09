import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyKycStatus, getKycStatusByUserId } from "@/lib/kyc.functions";

export type KycStatus = "not_started" | "pending" | "approved" | "rejected";

export function useKycStatus(userId: string | undefined) {
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchStatus = useServerFn(getMyKycStatus);

  useEffect(() => {
    if (!userId) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    fetchStatus()
      .then((r) => {
        if (cancelled) return;
        setStatus(r.status);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        // On failure, don't assume "not_started" — that would bounce
        // approved users to /kyc. Leave as null so callers can skip the gate.
        setStatus(null);
        setLoading(false);
      })
      .finally(() => {
        clearTimeout(timer);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [userId, fetchStatus]);

  return { status, loading };
}

export async function fetchKycStatus(userId: string, token?: string, proof?: string): Promise<KycStatus> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (proof) {
      headers["x-bancoteste-sc-proof"] = proof;
      // legacy header omitted
      headers["x-velunor-sc-proof"] = proof;
    }
    const res = await getKycStatusByUserId({
      data: { userId },
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });
    return res.status;
  } catch {
    return "not_started";
  }
}
