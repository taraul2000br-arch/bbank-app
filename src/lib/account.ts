import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { getMyAccountDashboard } from "@/lib/account.functions";
import { logSafeError } from "@/lib/safe-logger";

export type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

export function formatMoney(balance: number | null | undefined, currency: string = "GBP") {
  if (balance === null || balance === undefined || isNaN(Number(balance))) {
    return "—";
  }
  const num = Number(balance);
  const isNegative = num < 0;
  const cleanCurrency = (currency || "GBP").trim().toUpperCase() || "GBP";
  try {
    const absFormatted = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: cleanCurrency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(num));

    return isNegative ? `-${absFormatted}` : absFormatted;
  } catch {
    const symbol = cleanCurrency === "EUR" ? "€" : cleanCurrency === "USD" ? "$" : "£";
    return isNegative ? `-${symbol}${Math.abs(num).toFixed(2)}` : `${symbol}${num.toFixed(2)}`;
  }
}

function useAccountDashboard() {
  const { user } = useAuth();
  const fetchDashboard = useServerFn(getMyAccountDashboard);

  return useQuery({
    queryKey: ["account-dashboard", user?.id],
    queryFn: async () => {
      try {
        return await fetchDashboard();
      } catch (err) {
        logSafeError("getMyAccountDashboard", err);
        throw err;
      }
    },
    enabled: !!user?.id,
    staleTime: 10_000,
    retry: 1,
  });
}

export function useAccount() {
  const { data, isLoading, isError, error, isStale, refetch } = useAccountDashboard();
  const hasAccountData = !!data && data.account !== undefined && typeof data.account.balance === "number";
  return {
    balance: hasAccountData ? Number(data.account.balance) : (isLoading ? 0 : null),
    currency: data?.account?.currency || "GBP",
    accountNumber: data?.account?.accountNumber ?? "",
    iban: data?.account?.iban ?? "",
    loading: isLoading,
    isError,
    error,
    balanceUnavailable: isError || (!isLoading && !hasAccountData),
    isStale,
    refetch,
  };
}

export type Profile = {
  full_name: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  birth_date: string | null;
  country: string;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  account_blocked: boolean;
  account_blocked_at: string | null;
  transfer_locked: boolean;
};

export function useProfile() {
  const { data, isLoading } = useAccountDashboard();
  return { profile: data?.profile ?? null, loading: isLoading };
}

export function useTransactions() {
  const { data, isLoading, isError, error, refetch } = useAccountDashboard();
  return {
    txs: data?.transactions ?? [],
    loading: isLoading,
    isError,
    error,
    refetch,
  };
}

export type PendingTransfer = {
  id: string;
  protocol?: string | null;
  amount: number;
  beneficiary_name: string | null;
  to_country: string | null;
  purpose: string | null;
  reference: string | null;
  created_at: string;
};

export function usePendingTransfers() {
  const { data } = useAccountDashboard();
  return data?.pendingTransfers ?? [];
}

export function usePendingTransfersTotal() {
  const pending = usePendingTransfers();
  return pending.reduce((s, r) => s + Number(r.amount), 0);
}

export function generateUkIban(sortCode: string, accNumber: string): string {
  const cleanSort = (sortCode || "").replace(/\D/g, "").padStart(6, "0").slice(0, 6);
  const cleanAcc = (accNumber || "").replace(/\D/g, "").padStart(8, "0").slice(0, 8);

  // ISO 7064 MOD-97 check digits for demonstrative IBAN
  // Country: GB (G=16, B=11), Bank: BBAN (B=11, B=11, A=10, N=23)
  const numStr = `11111023${cleanSort}${cleanAcc}161100`;
  const remainder = Number(BigInt(numStr) % 97n);
  const check = String(98 - remainder).padStart(2, "0");

  return `GB${check}BBAN${cleanSort}${cleanAcc}`;
}

export function parseUkAccountCredentials(rawAccNo?: string | null, rawIban?: string | null) {
  let sortCode = "";
  let accNumber = "";
  let fullIban = (rawIban || "").trim();

  if (rawAccNo) {
    const trimmed = rawAccNo.trim();
    if (trimmed.startsWith("GB") && trimmed.length >= 22) {
      if (!fullIban) fullIban = trimmed;
      const sc = trimmed.slice(8, 14);
      if (sc.length === 6) {
        sortCode = `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
      }
      accNumber = trimmed.slice(14, 22);
    } else if (/^\d{8}$/.test(trimmed)) {
      accNumber = trimmed;
    } else {
      // Handles 20-XXXXXX-YYYYYYYY or XX-XX-XX-YYYYYYYY
      const parts = trimmed.split("-").filter(Boolean);
      if (parts.length >= 2) {
        const lastPart = parts[parts.length - 1].replace(/\D/g, "");
        if (lastPart.length >= 8) {
          accNumber = lastPart.slice(-8);
        }
        const prefixDigits = parts.slice(0, -1).join("").replace(/\D/g, "");
        if (prefixDigits.length >= 6) {
          const sc = prefixDigits.slice(0, 6);
          sortCode = `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
        }
      }
      if (!accNumber) {
        const digits = trimmed.replace(/\D/g, "");
        if (digits.length >= 8) {
          accNumber = digits.slice(-8);
        } else if (trimmed.length > 0) {
          accNumber = trimmed;
        }
      }
    }
  }

  if (fullIban && fullIban.startsWith("GB") && fullIban.length >= 22) {
    const sc = fullIban.slice(8, 14);
    if (sc.length === 6 && !sortCode) {
      sortCode = `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
    }
    if (!accNumber) {
      accNumber = fullIban.slice(14, 22);
    }
  }

  // Fallback sort code if none detected
  if (!sortCode) {
    sortCode = "10-80-00";
  }

  // Fallback IBAN auto-generated if empty and account number is available
  if (!fullIban && accNumber) {
    fullIban = generateUkIban(sortCode, accNumber);
  }

  const prettyIban = fullIban ? fullIban.replace(/(.{4})/g, "$1 ").trim() : "";

  return {
    sortCode,
    accountNumber: accNumber,
    iban: fullIban,
    prettyIban,
  };
}


