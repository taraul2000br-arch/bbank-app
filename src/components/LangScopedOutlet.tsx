import { Outlet } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

export function LangScopedOutlet() {
  const { lang } = useI18n();
  return <Outlet key={lang} />;
}
