import { createFileRoute } from "@tanstack/react-router";
import { AccountShell } from "@/components/AccountShell";
import { CustomerSupportChat } from "@/components/CustomerSupportChat";

export const Route = createFileRoute("/support")({
  component: CustomerSupportPage,
  head: () => ({
    meta: [
      { title: "Customer Support — Camila Ricci | Secure Portal" },
      { name: "description", content: "Dedicated customer support with Camila Ricci." },
    ],
  }),
});

function CustomerSupportPage() {
  return (
    <AccountShell>
      {() => (
        <div className="flex-1 min-h-0 flex flex-col w-full h-full max-w-6xl mx-auto p-0 sm:p-3 md:p-4 overflow-hidden">
          <div className="flex-1 min-h-0 flex flex-col bg-white sm:rounded-2xl shadow-sm border-0 sm:border border-slate-200 overflow-hidden">
            <CustomerSupportChat mode="full" />
          </div>
        </div>
      )}
    </AccountShell>
  );
}
