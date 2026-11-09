import { createFileRoute, Navigate, useNavigate, Link, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Video, Upload, CheckCircle2, AlertTriangle, Loader2, FileText, ShieldCheck, Square,
  IdCard, BookUser, Camera, Copy, Check, Landmark,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useIsAdmin } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { submitKyc, getMyKycStatus, updateMyKycProfile, getMyKycProfile, type KycPart } from "@/lib/kyc.functions";

function KycErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Encontramos um problema temporário. Tente novamente ou volte para sua conta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Tentar novamente
          </button>
          <Link
            to="/conta"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
          >
            Voltar para minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/kyc")({
  component: KycPage,
  head: () => ({ meta: [{ title: "Verificação KYC — Secure Portal" }] }),
  errorComponent: KycErrorComponent,
});

type LivenessStep = { key: string; labelKey: string; seconds: number };

const STEPS: LivenessStep[] = [
  { key: "front-1", labelKey: "kyc.step.front1", seconds: 3 },
  { key: "right",   labelKey: "kyc.step.right",  seconds: 3 },
  { key: "front-2", labelKey: "kyc.step.front2", seconds: 2 },
  { key: "left",    labelKey: "kyc.step.left",   seconds: 3 },
  { key: "up",      labelKey: "kyc.step.up",     seconds: 3 },
  { key: "down",    labelKey: "kyc.step.down",   seconds: 3 },
];

function KycPage() {
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin(user?.id);
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getMyKycStatus);
  const send = useServerFn(submitKyc);
  const saveProfile = useServerFn(updateMyKycProfile);
  const loadProfile = useServerFn(getMyKycProfile);

  // Dados cadastrais (quando o ADM recusa por "dados incompletos")
  const [pFullName, setPFullName] = useState("");
  const [pDocType, setPDocType] = useState("nif");
  const [pDocNumber, setPDocNumber] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pBirth, setPBirth] = useState("");

  const [status, setStatus] = useState<"loading" | "form" | "submitted" | "approved" | "rejected" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [approvedSortCode, setApprovedSortCode] = useState<string | null>(null);
  const [copiedSortCode, setCopiedSortCode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [rejectedParts, setRejectedParts] = useState<KycPart[]>([]);
  const [prevPaths, setPrevPaths] = useState<{ statement1: string | null; statement2: string | null; document: string | null; documentBack: string | null; video: string | null }>({ statement1: null, statement2: null, document: null, documentBack: null, video: null });
  const isPartial = rejectedParts.length > 0;
  const needs = useCallback(
    (p: KycPart) => {
      // Cadastral data (profile) is registered during account creation.
      // It is ONLY requested during KYC if an administrator formally rejected the submission
      // with a specific request to correct profile details ("profile").
      if (p === "profile") {
        return isPartial && rejectedParts.includes("profile");
      }
      return !isPartial || rejectedParts.includes(p);
    },
    [isPartial, rejectedParts]
  );

  // Files
  const [stmt1, setStmt1] = useState<File | null>(null);
  const [stmt2, setStmt2] = useState<File | null>(null);
  const [docType, setDocType] = useState<"national" | "passport">("national");
  const [docPhoto, setDocPhoto] = useState<File | null>(null);
  const [docBackPhoto, setDocBackPhoto] = useState<File | null>(null);

  // Camera + recording
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stepTimerRef = useRef<number | null>(null);
  const stepIdxRef = useRef(0);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRequested, setCameraRequested] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepRemaining, setStepRemaining] = useState(STEPS[0].seconds);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      // Unauthenticated user should not hang on spinner: redirect to home
      navigate({ to: "/" });
      return;
    }

    if (isAdmin) {
      navigate({ to: "/admin" });
      return;
    }

    let isMounted = true;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

    // Safety timeout: 8 seconds maximum to prevent any indefinite spinner
    timeoutTimer = setTimeout(() => {
      if (isMounted && status === "loading") {
        setErrorMessage(
          lang === "pt"
            ? "O carregamento demorou mais do que o esperado. Por favor, tente novamente."
            : "Loading took longer than expected. Please try again."
        );
        setStatus("error");
      }
    }, 8000);

    fetchStatus()
      .then((r) => {
        if (!isMounted) return;
        if (timeoutTimer) clearTimeout(timeoutTimer);

        if (r.status === "approved") {
          setApprovedSortCode(r.sortCode);
          const key = `kyc_approved_seen_${user.id}`;
          if (typeof window !== "undefined" && localStorage.getItem(key)) {
            navigate({ to: "/conta" });
            return;
          }
          if (typeof window !== "undefined") localStorage.setItem(key, "1");
          setStatus("approved");
        } else if (r.status === "pending") {
          setStatus("submitted");
        } else if (r.status === "rejected") {
          setRejectionReason(r.rejection_reason);
          setRejectedParts(r.rejected_parts ?? []);
          setPrevPaths(r.prev_paths ?? { statement1: null, statement2: null, document: null, documentBack: null, video: null });
          if ((r.rejected_parts ?? []).includes("profile" as KycPart)) {
            loadProfile()
              .then((p) => {
                if (!isMounted) return;
                setPFullName(p.full_name ?? "");
                setPDocType(p.document_type || "nif");
                setPDocNumber(p.document_number ?? "");
                setPPhone(p.phone ?? "");
                setPBirth(p.birth_date ?? "");
              })
              .catch(() => {});
          }
          setStatus("form");
        } else {
          // "not_started"
          setStatus("form");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        if (timeoutTimer) clearTimeout(timeoutTimer);
        console.error("[KYC] Failed to fetch KYC status:", err);
        setErrorMessage(
          err?.message || (lang === "pt"
            ? "Não foi possível carregar a verificação. Verifique sua conexão e tente novamente."
            : "Could not load verification status. Please check your connection and try again.")
        );
        setStatus("error");
      });

    return () => {
      isMounted = false;
      if (timeoutTimer) clearTimeout(timeoutTimer);
    };
  }, [loading, user?.id, roleLoading, isAdmin, retryCount, lang]);

  const [stream, setStream] = useState<MediaStream | null>(null);

  const attachStreamToVideo = useCallback((mediaStream: MediaStream | null = streamRef.current) => {
    const v = videoRef.current;
    if (!v || !mediaStream) return;

    if (v.srcObject !== mediaStream) v.srcObject = mediaStream;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.autoplay = true;

    const markReady = () => {
      if (v.videoWidth > 0 || v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        setCameraReady(true);
      }
    };

    const playPreview = () => {
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(markReady).catch(() => {
          window.setTimeout(() => {
            v.play().then(markReady).catch(() => {
              setCameraError(t("kyc.err.play"));
            });
          }, 250);
        });
      } else {
        markReady();
      }
    };

    v.onloadedmetadata = playPreview;
    v.oncanplay = markReady;
    if (v.readyState >= HTMLMediaElement.HAVE_METADATA) playPreview();
  }, [t]);

  const requestCamera = async () => {
    if (cameraRequested && streamRef.current) {
      attachStreamToVideo(streamRef.current);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t("kyc.err.noApi"));
      return;
    }
    setCameraError(null);
    setCameraReady(false);
    setCameraRequested(true);
    setCameraStarting(true);
    try {
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      const constraintOptions: MediaStreamConstraints[] = [
        { video: { facingMode: { ideal: "user" }, width: { ideal: 640, max: 1280 }, height: { ideal: 480, max: 720 } }, audio: false },
        { video: { facingMode: { ideal: "user" } }, audio: false },
        { video: true, audio: false },
      ];

      let s: MediaStream | null = null;
      let lastError: unknown = null;
      for (const constraints of constraintOptions) {
        try {
          s = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastError = err;
        }
      }
      if (!s) throw lastError;

      streamRef.current = s;
      s.getVideoTracks().forEach((track) => {
        track.onended = () => {
          setCameraReady(false);
          setCameraRequested(false);
          setCameraStarting(false);
          setCameraError(t("kyc.err.ended"));
        };
      });
      setStream(s);
      window.setTimeout(() => attachStreamToVideo(s), 0);
    } catch (e: any) {
      const name = e?.name ?? "";
      let msg = e?.message ?? t("kyc.err.default");
      if (name === "NotAllowedError") msg = t("kyc.err.perm");
      else if (name === "NotFoundError") msg = t("kyc.err.notFound");
      else if (name === "NotReadableError") msg = t("kyc.err.busy");
      setCameraError(msg);
      setCameraRequested(false);
      setCameraReady(false);
    } finally {
      setCameraStarting(false);
    }
  };

  useEffect(() => {
    if (!stream || videoUrl) return;
    attachStreamToVideo(stream);
  }, [stream, videoUrl, attachStreamToVideo]);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) window.clearInterval(stepTimerRef.current);
      try { recorderRef.current?.state === "recording" && recorderRef.current.stop(); } catch {}
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, []);


  const stopAll = () => {
    if (stepTimerRef.current) { window.clearInterval(stepTimerRef.current); stepTimerRef.current = null; }
    try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch {}
    setRecording(false);
  };

  const resetCamera = () => {
    stopAll();
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStream(null);
    setCameraReady(false);
    setCameraStarting(false);
    setCameraRequested(false);
    setCameraError(null);
  };

  const startRecording = () => {
    if (!streamRef.current || recording) return;
    setVideoBlob(null);
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4;codecs=avc1",
      "video/mp4",
    ];
    const mime = candidates.find((m) => (window as any).MediaRecorder?.isTypeSupported?.(m)) || "";
    let rec: MediaRecorder;
    try {
      const options: MediaRecorderOptions = {};
      if (mime) options.mimeType = mime;
      options.videoBitsPerSecond = 1_200_000;
      rec = new MediaRecorder(streamRef.current, options);
    } catch {
      try {
        rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
      } catch {
        setCameraError(t("kyc.err.record"));
        return;
      }
    }
    chunksRef.current = [];
    rec.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime || "video/webm" });
      if (blob.size > 0) {
        setVideoBlob(blob);
        setVideoUrl(URL.createObjectURL(blob));
      }
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    stepIdxRef.current = 0;
    setStepIdx(0);
    setStepRemaining(STEPS[0].seconds);

    let remaining = STEPS[0].seconds;
    stepTimerRef.current = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stepIdxRef.current += 1;
        if (stepIdxRef.current >= STEPS.length) {
          stopAll();
          return;
        }
        remaining = STEPS[stepIdxRef.current].seconds;
        setStepIdx(stepIdxRef.current);
      }
      setStepRemaining(remaining);
    }, 1000);
  };

  const retake = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoBlob(null);
    setVideoUrl(null);
    setStepIdx(0);
    setStepRemaining(STEPS[0].seconds);
  };

  const canSubmit =
    (!needs("profile") || (pFullName.trim().length >= 2 && pDocNumber.trim().length >= 3)) &&
    (!needs("statement1") || !!stmt1) &&
    (!needs("statement2") || !!stmt2) &&
    (!needs("document") || (!!docPhoto && (docType === "passport" || !!docBackPhoto))) &&
    (!needs("liveness") || !!videoBlob) &&
    !submitting;

  const handleSubmit = async () => {
    if (!user || !canSubmit || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const ts = Date.now();

      // Only attempt to update profile if an administrator formally requested a profile resubmission
      if (needs("profile")) {
        await saveProfile({
          data: {
            full_name: pFullName.trim(),
            document_type: pDocType as any,
            document_number: pDocNumber.trim(),
            phone: pPhone.trim() || undefined,
            birth_date: pBirth || undefined,
          },
        });
      }

      let p1 = prevPaths.statement1 ?? "";
      let p2 = prevPaths.statement2 ?? "";
      let docPath = prevPaths.document ?? "";
      let docBackPath = prevPaths.documentBack ?? "";
      let vpath = prevPaths.video ?? "";

      const mimeFor = (f: File) => {
        if (f.type && f.type !== "application/octet-stream") return f.type;
        const ext = (f.name.split(".").pop() || "").toLowerCase();
        if (ext === "pdf") return "application/pdf";
        if (ext === "png") return "image/png";
        if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
        if (ext === "webp") return "image/webp";
        if (ext === "heic" || ext === "heif") return "image/heic";
        return "application/octet-stream";
      };

      if (needs("statement1") && stmt1) {
        const ext1 = (stmt1.name.split(".").pop() || "pdf").toLowerCase();
        p1 = `${user.id}/statements/${ts}-1.${ext1}`;
        const up1 = await supabase.storage.from("kyc-documents").upload(p1, stmt1, { upsert: false, contentType: mimeFor(stmt1) });
        if (up1.error) throw new Error(`${t("kyc.up.stmt1")}: ${up1.error.message}`);
      }
      if (needs("statement2") && stmt2) {
        const ext2 = (stmt2.name.split(".").pop() || "pdf").toLowerCase();
        p2 = `${user.id}/statements/${ts}-2.${ext2}`;
        const up2 = await supabase.storage.from("kyc-documents").upload(p2, stmt2, { upsert: false, contentType: mimeFor(stmt2) });
        if (up2.error) throw new Error(`${t("kyc.up.stmt2")}: ${up2.error.message}`);
      }
      if (needs("document") && docPhoto) {
        const docExt = (docPhoto.name.split(".").pop() || "jpg").toLowerCase();
        docPath = `${user.id}/document/${ts}-doc-front.${docExt}`;
        const upDoc = await supabase.storage.from("kyc-documents").upload(docPath, docPhoto, { upsert: false, contentType: mimeFor(docPhoto) });
        if (upDoc.error) throw new Error(`${t("kyc.up.docFront")}: ${upDoc.error.message}`);
        if (docType === "national" && docBackPhoto) {
          const dbExt = (docBackPhoto.name.split(".").pop() || "jpg").toLowerCase();
          docBackPath = `${user.id}/document/${ts}-doc-back.${dbExt}`;
          const upBack = await supabase.storage.from("kyc-documents").upload(docBackPath, docBackPhoto, { upsert: false, contentType: mimeFor(docBackPhoto) });
          if (upBack.error) throw new Error(`${t("kyc.up.docBack")}: ${upBack.error.message}`);
        } else if (docType === "passport") {
          docBackPath = "";
        }
      }
      if (needs("liveness") && videoBlob) {
        const videoExt = videoBlob.type.includes("mp4") ? "mp4" : "webm";
        vpath = `${user.id}/liveness/${ts}-video.${videoExt}`;
        const vup = await supabase.storage.from("kyc-documents").upload(vpath, videoBlob, {
          upsert: false, contentType: videoBlob.type || "video/webm",
        });
        if (vup.error) throw new Error(`${t("kyc.up.video")}: ${vup.error.message}`);
      }

      if (!p1 || !p2 || !docPath || !vpath) {
        throw new Error(t("kyc.incomplete"));
      }

      const livenessPaths = docBackPath ? [docPath, docBackPath, vpath] : [docPath, vpath];
      await send({ data: { statement1_path: p1, statement2_path: p2, liveness_paths: livenessPaths } });
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      setStatus("submitted");
    } catch (e: any) {
      console.error("[KYC submission error]:", e);
      setSubmitError(e?.message ?? (lang === "pt" ? "Não foi possível enviar a documentação. Por favor, tente novamente." : "We couldn't upload your documents. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const currentStep = useMemo(() => STEPS[Math.min(stepIdx, STEPS.length - 1)], [stepIdx]);

  if (loading) return null;
  if (!user) return <Navigate to="/" />;

  if (status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            {lang === "pt" ? "Carregando verificação de segurança..." : "Loading security verification..."}
          </p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-background">
        <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-2">
            {lang === "pt" ? "Não foi possível carregar a verificação" : "Unable to load verification"}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {errorMessage || (lang === "pt"
              ? "Ocorreu um erro ao consultar o status do seu cadastro. Por favor, tente novamente."
              : "An error occurred while checking your account status. Please try again.")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setErrorMessage(null);
                setRetryCount((c) => c + 1);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              {lang === "pt" ? "Tentar novamente" : "Try again"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full border border-border bg-secondary px-6 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
            >
              {lang === "pt" ? "Sair e voltar ao início" : "Sign out & return home"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (status === "approved") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-md w-full bg-background rounded-2xl border border-border/60 p-8 shadow-sm">
          <CheckCircle2 className="w-16 h-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">{t("kyc.approved.title")}</h1>
          <p className="text-muted-foreground mb-6">{t("kyc.approved.desc")}</p>

          {approvedSortCode && (
            <div className="mb-6 p-4 rounded-xl bg-secondary/50 border border-border text-left select-none">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                <Landmark className="w-4 h-4 text-primary" />
                <span>{lang === "pt" ? "Seu Sort Code B Bank" : "Your B Bank Sort Code"}</span>
              </div>
              <div className="flex items-center justify-between gap-3 mt-2">
                <span className="text-2xl font-mono font-bold tracking-widest text-foreground select-text" data-copyable="true">
                  {approvedSortCode}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedSortCode);
                    setCopiedSortCode(true);
                    setTimeout(() => setCopiedSortCode(false), 2500);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-secondary text-xs font-semibold text-foreground transition shrink-0"
                >
                  {copiedSortCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600">{lang === "pt" ? "Copiado!" : "Copied!"}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-primary" />
                      <span>{lang === "pt" ? "Copiar" : "Copy"}</span>
                    </>
                  )}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                {lang === "pt"
                  ? "Guarde este código com atenção. Ele será solicitado em seus próximos logins como verificação de segurança em duas etapas."
                  : "Please save this code carefully. It will be required for two-factor verification on subsequent logins."}
              </p>
            </div>
          )}

          <button
            onClick={() => {
              try {
                localStorage.setItem(`kyc_approved_seen_${user!.id}`, "1");
              } catch {}
              navigate({ to: "/conta" });
            }}
            className="w-full px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition shadow-sm"
          >
            {t("kyc.approved.cta")}
          </button>
        </div>
      </main>
    );
  }

  if (status === "submitted") {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-secondary/40">
        <div className="text-center max-w-lg bg-background rounded-2xl border border-border/60 p-10 shadow-sm">
          <div className="relative mx-auto mb-6 w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">{t("kyc.submitted.title")}</h1>
          <p className="text-muted-foreground mb-2">{t("kyc.submitted.p1")}</p>
          <p className="text-foreground font-medium mb-6">
            {t("kyc.submitted.p2a")} <span className="text-primary">{t("kyc.submitted.p2b")}</span> {t("kyc.submitted.p2c")}
          </p>
          <p className="text-sm text-muted-foreground mb-6">{t("kyc.submitted.p3")}</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}
            className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold"
          >
            {t("kyc.submitted.cta")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-secondary/40 py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <ShieldCheck className="w-10 h-10 text-primary mx-auto mb-2" />
          <h1 className="text-3xl font-bold">{t("kyc.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("kyc.subtitle")}</p>
        </div>

        {rejectionReason && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
            <p className="font-semibold text-destructive mb-1">{t("kyc.rej.title")}</p>
            {rejectionReason && <p className="text-foreground">{rejectionReason}</p>}
            {isPartial ? (
              <>
                <p className="text-muted-foreground mt-2">{t("kyc.rej.listIntro")}</p>
                <ul className="list-disc list-inside text-foreground mt-1">
                  {rejectedParts.includes("profile") && <li>{t("kyc.profile.title")}</li>}
                  {rejectedParts.includes("statement1") && <li>{t("kyc.rej.stmt1")}</li>}
                  {rejectedParts.includes("statement2") && <li>{t("kyc.rej.stmt2")}</li>}
                  {rejectedParts.includes("document") && <li>{t("kyc.rej.doc")}</li>}
                  {rejectedParts.includes("liveness") && <li>{t("kyc.rej.liveness")}</li>}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground mt-1">{t("kyc.rej.reupload")}</p>
            )}
          </div>
        )}

        {needs("profile") && (
          <section className="bg-background rounded-2xl border border-border/60 p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">
                <IdCard className="w-4 h-4" />
              </span>
              <h2 className="text-xl font-bold">{t("kyc.profile.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 pl-11">{t("kyc.profile.desc")}</p>
            <div className="pl-11 grid sm:grid-cols-2 gap-3">
              <label className="text-sm sm:col-span-2">
                <span className="text-muted-foreground">{t("kyc.profile.name")} *</span>
                <input
                  value={pFullName}
                  onChange={(e) => setPFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">{t("kyc.profile.docType")}</span>
                <select
                  value={pDocType}
                  onChange={(e) => setPDocType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="nif">NIF</option>
                  <option value="cpf">CPF</option>
                  <option value="ssn">SSN</option>
                  <option value="dni">DNI</option>
                  <option value="passport">Passport</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">{t("kyc.profile.docNumber")} *</span>
                <input
                  value={pDocNumber}
                  onChange={(e) => setPDocNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">{t("kyc.profile.phone")}</span>
                <input
                  value={pPhone}
                  onChange={(e) => setPPhone(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">{t("kyc.profile.birth")}</span>
                <input
                  type="date"
                  value={pBirth}
                  onChange={(e) => setPBirth(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
          </section>
        )}

        {needs("document") && (
          <section className="bg-background rounded-2xl border border-border/60 p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">1</span>
              <h2 className="text-xl font-bold">{t("kyc.doc.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4 pl-11">{t("kyc.doc.help")}</p>

            <div className="pl-11 mb-5 grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDocType("national")}
                className={`text-left p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  docType === "national" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <IdCard className={`w-6 h-6 mt-0.5 ${docType === "national" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-semibold">{t("kyc.doc.national")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("kyc.doc.nationalDesc")}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setDocType("passport")}
                className={`text-left p-4 rounded-xl border-2 transition flex items-start gap-3 ${
                  docType === "passport" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <BookUser className={`w-6 h-6 mt-0.5 ${docType === "passport" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <div className="font-semibold">{t("kyc.doc.passport")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("kyc.doc.passportDesc")}</div>
                </div>
              </button>
            </div>

            <div className="pl-11">
              <div className={`grid gap-4 ${docType === "national" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                <FileBox
                  label={docType === "passport" ? t("kyc.doc.passportPhoto") : t("kyc.doc.front")}
                  file={docPhoto}
                  onChange={setDocPhoto}
                  accept="image/*"
                />
                {docType === "national" && (
                  <FileBox
                    label={t("kyc.doc.back")}
                    file={docBackPhoto}
                    onChange={setDocBackPhoto}
                    accept="image/*"
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {needs("liveness") && (
        <section className="bg-background rounded-2xl border border-border/60 p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">2</span>
            <h2 className="text-xl font-bold">{t("kyc.live.title")}</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4 pl-11">{t("kyc.live.help")}</p>

          <div className="pl-11">
            {cameraError && (
              <div className="mb-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" /> {cameraError}
              </div>
            )}

            {!cameraRequested && !videoUrl ? (
              <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center bg-secondary/30">
                <Video className="w-10 h-10 mx-auto text-primary mb-3" />
                <p className="text-sm text-muted-foreground mb-4">{t("kyc.live.instr")}</p>
                <button
                  onClick={requestCamera}
                  disabled={cameraStarting}
                  className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2"
                >
                  {cameraStarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {cameraStarting ? t("kyc.live.opening") : t("kyc.live.activate")}
                </button>
              </div>
            ) : (
              <>
                <div className="relative aspect-[4/3] w-full max-w-lg mx-auto rounded-2xl overflow-hidden bg-black">
                  {videoUrl && !recording ? (
                    <video src={videoUrl} controls playsInline className="w-full h-full object-cover" />
                  ) : (
                    <video
                      ref={(node) => {
                        videoRef.current = node;
                        if (node && streamRef.current) window.setTimeout(() => attachStreamToVideo(streamRef.current), 0);
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  )}

                  {!videoUrl && !cameraReady && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black text-white text-sm text-center px-6">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>{cameraStarting ? t("kyc.live.opening") : t("kyc.live.loading")}</span>
                    </div>
                  )}

                  {!videoUrl && cameraReady && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[55%] h-[75%] rounded-[50%] border-[3px] border-white/70 shadow-[0_0_0_2000px_rgba(0,0,0,0.35)]" />
                    </div>
                  )}

                  {recording && (
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 text-white text-xs font-semibold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
                    </div>
                  )}

                  {recording && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white text-center">
                      <div className="text-lg font-bold">{t(currentStep.labelKey)}</div>
                      <div className="text-sm opacity-80 mt-1">
                        {t("kyc.live.step")} {stepIdx + 1} / {STEPS.length} — {stepRemaining}s
                      </div>
                    </div>
                  )}

                  {videoUrl && !recording && (
                    <div className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> {t("kyc.live.recorded")}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
                  {!recording && !videoBlob && (
                    <button
                      onClick={startRecording}
                      disabled={!cameraReady}
                      className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold disabled:bg-muted disabled:text-muted-foreground inline-flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" /> {t("kyc.live.start")}
                    </button>
                  )}
                  {!recording && !videoBlob && cameraRequested && (
                    <button
                      type="button"
                      onClick={resetCamera}
                      className="px-5 py-3 rounded-full border border-border font-medium"
                    >
                      {t("kyc.live.reset")}
                    </button>
                  )}
                  {recording && (
                    <button
                      onClick={stopAll}
                      className="px-6 py-3 rounded-full bg-destructive text-destructive-foreground font-semibold inline-flex items-center gap-2"
                    >
                      <Square className="w-4 h-4" /> {t("kyc.live.stop")}
                    </button>
                  )}
                  {!recording && videoBlob && (
                    <button
                      onClick={retake}
                      className="px-5 py-3 rounded-full border border-border font-medium"
                    >
                      {t("kyc.live.retake")}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
        )}

        {(needs("statement1") || needs("statement2")) && (
          <section className="bg-background rounded-2xl border border-border/60 p-6 mb-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">3</span>
              <h2 className="text-xl font-bold">{t("kyc.stmts.title")}</h2>
            </div>
            <div className="pl-11 mb-5 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-foreground">{t("kyc.stmts.p1")}</p>
              <p className="text-sm text-muted-foreground mt-2">{t("kyc.stmts.p2")}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pl-11">
              {needs("statement1") && <FileBox label={t("kyc.stmts.file1")} file={stmt1} onChange={setStmt1} />}
              {needs("statement2") && <FileBox label={t("kyc.stmts.file2")} file={stmt2} onChange={setStmt2} />}
            </div>
          </section>
        )}

        {submitError && (
          <div className="mb-4 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full py-4 rounded-full bg-primary text-primary-foreground font-bold text-lg disabled:bg-muted disabled:text-muted-foreground inline-flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {t("kyc.submitting")}</> : t("kyc.submit")}
        </button>
        <p className="text-xs text-center text-muted-foreground mt-3">{t("kyc.help72")}</p>
      </div>
    </main>
  );
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
const ALLOWED_PDF_EXTS = [".pdf"];

function FileBox({ label, file, onChange, accept = "application/pdf,image/*" }: {
  label: string; file: File | null; onChange: (f: File | null) => void; accept?: string;
}) {
  const { t } = useI18n();
  const isImage = accept.includes("image") && !accept.includes("pdf");
  const [localError, setLocalError] = useState<string | null>(null);

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageDocInputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      setLocalError(t("kyc.file.maxSize"));
      onChange(null);
      return;
    }

    const name = f.name.toLowerCase();
    const type = f.type.toLowerCase();
    const isImg = ALLOWED_IMAGE_EXTS.some((ext) => name.endsWith(ext)) || type.startsWith("image/");
    const isPdf = ALLOWED_PDF_EXTS.some((ext) => name.endsWith(ext)) || type === "application/pdf";

    const valid = isImage ? isImg : (isImg || isPdf);
    if (!valid) {
      setLocalError(t("kyc.file.invalidType"));
      onChange(null);
      return;
    }

    setLocalError(null);
    onChange(f);
  };

  return (
    <div className="block">
      <span className="block text-sm font-semibold mb-2">{label}</span>
      {file ? (
        <div className="border-2 border-dashed border-primary rounded-xl p-4 text-center transition bg-primary/5">
          <div className="flex items-center gap-2 justify-center text-sm">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-medium truncate max-w-[180px]">{file.name}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setLocalError(null);
              onChange(null);
            }}
            className="mt-2 text-xs text-destructive underline cursor-pointer"
          >
            {t("kyc.file.remove")}
          </button>
        </div>
      ) : (
        <div className={`border-2 border-dashed rounded-xl p-4 text-center transition ${
          isImage ? "flex flex-col sm:flex-row items-center justify-center gap-3" : ""
        } border-border hover:border-primary/60 hover:bg-secondary/50`}>
          {isImage ? (
            <>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                {t("kyc.file.takePhoto")}
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePick}
              />
              <button
                type="button"
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium cursor-pointer hover:bg-secondary/50"
              >
                <Upload className="w-4 h-4" />
                {t("kyc.file.gallery")}
              </button>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handlePick}
              />
            </>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  {t("kyc.file.pdf")}
                </button>
                <button
                  type="button"
                  onClick={() => imageDocInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium cursor-pointer hover:bg-secondary/50"
                >
                  <Upload className="w-4 h-4" />
                  {t("kyc.file.image")}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">{t("kyc.file.pdfHelp")}</p>
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={handlePick}
              />
              <input
                ref={imageDocInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={handlePick}
              />
            </>
          )}
        </div>
      )}
      {localError && (
        <p className="mt-2 text-xs text-destructive font-medium">{localError}</p>
      )}
    </div>
  );
}
