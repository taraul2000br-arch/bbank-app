import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { AdminSupportTab } from "@/components/AdminSupportTab";
import { ChevronLeft, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupportPage,
  head: () => ({ meta: [{ title: "Support Centre — Admin" }] }),
});

function AdminSupportPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading, level } = useIsAdmin(user?.id, user?.email);

  useEffect(() => {
    if (!loading && !roleLoading && !isAdmin) {
      navigate({ to: "/" });
    }
  }, [loading, roleLoading, isAdmin, navigate]);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#080808] text-[#F5F5F5] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 animate-spin text-[#C6A667]" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#080808] text-[#F5F5F5] p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] text-xs font-semibold text-[#999999] hover:text-[#F5F5F5] border border-[#292929] transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Voltar ao Console Principal</span>
          </Link>
        </div>
        <AdminSupportTab effectiveViewerLevel={level} adminId={user?.id} />
      </div>
    </div>
  );
}
