import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/credit-cards")({
  beforeLoad: () => {
    throw redirect({ to: "/current-account" });
  },
  component: () => null,
});
