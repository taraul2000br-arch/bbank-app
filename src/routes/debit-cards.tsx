import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/debit-cards")({
  beforeLoad: () => {
    throw redirect({ to: "/current-account" });
  },
  component: () => null,
});
