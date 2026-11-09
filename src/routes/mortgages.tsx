import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/mortgages")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
  component: () => null,
});
