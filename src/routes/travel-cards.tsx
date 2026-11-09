import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/travel-cards")({
  beforeLoad: () => {
    throw redirect({ to: "/travel-money" });
  },
  component: () => null,
});
