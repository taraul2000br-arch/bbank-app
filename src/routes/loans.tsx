import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/loans")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
