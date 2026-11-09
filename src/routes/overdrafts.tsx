import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/overdrafts")({
  beforeLoad: () => {
    throw redirect({ to: "/current-account" });
  },
  component: () => null,
});
