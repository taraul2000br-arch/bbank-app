import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/business-loans")({
  beforeLoad: () => {
    throw redirect({ to: "/business-banking" });
  },
  component: () => null,
});
