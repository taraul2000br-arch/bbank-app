import { Landmark, LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { signOut } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";

const COPY: Record<string, { title: string; tag: string; description: string; notice: string; signOut: string }> = {
  pt: {
    title: "Conta temporariamente indisponível",
    tag: "Regularização fiscal — Reino Unido",
    description:
      "Em conformidade com a legislação vigente no Reino Unido aplicável à movimentação de valores mantidos junto a esta instituição, será necessária a regularização dos fundos correspondentes perante o HM Revenue & Customs (HMRC) para a liberação das operações em sua conta.",
    notice:
      "Recomendamos que o titular providencie a regularização junto ao fisco britânico ou contate o seu gerente de relacionamento para orientação sobre os procedimentos cabíveis.",
    signOut: "Sair da conta",
  },
  en: {
    title: "Account temporarily unavailable",
    tag: "Tax regularisation — United Kingdom",
    description:
      "In accordance with the United Kingdom legislation applicable to the movement of funds held with this institution, the regularisation of the corresponding funds with HM Revenue & Customs (HMRC) will be required before any operations on your account may be released.",
    notice:
      "We recommend that the account holder proceed with the regularisation before the British tax authority or contact their relationship manager for guidance on the applicable procedures.",
    signOut: "Sign out",
  },
  es: {
    title: "Cuenta temporalmente no disponible",
    tag: "Regularización fiscal — Reino Unido",
    description:
      "En cumplimiento de la legislación vigente en el Reino Unido aplicable a la movilización de los fondos mantenidos en esta institución, será necesaria la regularización de los importes correspondientes ante HM Revenue & Customs (HMRC) para liberar las operaciones de su cuenta.",
    notice:
      "Recomendamos al titular proceder con la regularización ante la autoridad fiscal británica o contactar a su gestor de relaciones para orientación sobre los trámites aplicables.",
    signOut: "Cerrar sesión",
  },
  fr: {
    title: "Compte temporairement indisponible",
    tag: "Régularisation fiscale — Royaume-Uni",
    description:
      "Conformément à la législation en vigueur au Royaume-Uni applicable au mouvement des fonds détenus auprès de cette institution, la régularisation des montants correspondants auprès de HM Revenue & Customs (HMRC) sera requise pour la libération des opérations de votre compte.",
    notice:
      "Nous recommandons au titulaire de procéder à la régularisation auprès de l'administration fiscale britannique ou de contacter son chargé de relation pour les démarches applicables.",
    signOut: "Se déconnecter",
  },
  de: {
    title: "Konto vorübergehend nicht verfügbar",
    tag: "Steuerliche Regularisierung — Vereinigtes Königreich",
    description:
      "Gemäß den im Vereinigten Königreich geltenden Rechtsvorschriften für die Bewegung von bei diesem Institut gehaltenen Geldern ist die Regularisierung der entsprechenden Beträge bei HM Revenue & Customs (HMRC) erforderlich, bevor Transaktionen auf Ihrem Konto freigegeben werden können.",
    notice:
      "Wir empfehlen dem Kontoinhaber, die Regularisierung bei der britischen Steuerbehörde vorzunehmen oder seinen Kundenbetreuer für weitere Hinweise zu kontaktieren.",
    signOut: "Abmelden",
  },
  pl: {
    title: "Konto chwilowo niedostępne",
    tag: "Regularyzacja podatkowa — Wielka Brytania",
    description:
      "Zgodnie z obowiązującymi w Wielkiej Brytanii przepisami dotyczącymi przepływu środków utrzymywanych w tej instytucji, wymagana będzie regularyzacja odpowiednich kwot wobec HM Revenue & Customs (HMRC), aby umożliwić realizację operacji na Państwa rachunku.",
    notice:
      "Zalecamy, aby posiadacz rachunku dokonał regularyzacji wobec brytyjskiego organu podatkowego lub skontaktował się ze swoim opiekunem klienta w celu uzyskania wskazówek.",
    signOut: "Wyloguj się",
  },
};

export function AccountBlockedOverlay() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const c = COPY[lang] ?? COPY.pt;

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-xl p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-primary to-primary/80 px-8 py-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-white/15 grid place-items-center shrink-0">
            <Landmark className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/80 font-semibold">
              {c.tag}
            </div>
            <h2 className="text-2xl font-bold text-white mt-0.5">{c.title}</h2>
          </div>
        </div>

        <div className="px-8 py-6 space-y-4 text-sm leading-relaxed text-foreground">
          <p className="text-justify">{c.description}</p>
          <p className="text-muted-foreground text-justify">{c.notice}</p>
        </div>

        <div className="px-8 py-4 border-t border-border bg-secondary/30 flex justify-end">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition"
          >
            <LogOut className="w-4 h-4" />
            {c.signOut}
          </button>
        </div>
      </div>
    </div>
  );
}
