import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cartoes")({
  beforeLoad: () => {
    throw redirect({ to: "/conta" });
  },
  component: () => null,
});
