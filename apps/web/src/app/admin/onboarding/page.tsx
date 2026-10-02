"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertCircle, Building2, Check, CircleDashed, ImagePlus, Info, LoaderCircle, RotateCcw, Store, Upload } from "lucide-react";
import { PlatformAdminShell } from "@/components/platform-admin-shell";
import { AVATAR_PRESETS } from "@/components/avatar-picker";
import { PasswordInput } from "@/components/password-input";
import { PasswordRequirements } from "@/components/password-requirements";
import type { StoreQuestion, StoreQuestionCategory } from "@/app/conocimiento/store-knowledge";
import { apiFetch, type BootstrapResponse } from "@/lib/bootstrap";
import type { IntegrationsResponse } from "@/app/integraciones/shared";
import {
  Avatar,
  Button,
  Card,
  cn,
  Banner,
  ErrorBlock,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  isPasswordValid,
  PASSWORD_MIN_LENGTH,
  passwordConfirmationState,
} from "@/lib/password-policy";

type SignupKind = "invited" | "self_signup";
type ProfileRole = "client" | "consultant";
type OrganizationMode = "create" | "existing" | "consultant";
type ConsultantCodePreview = {
  organization?: { id: string; display_name: string };
  consultant?: { display_name: string };
  requires_signup?: boolean;
  expires_at?: string;
};
type IntegrationProgressState = "idle" | "not_connected" | "authorizing" | "pending" | "importing" | "complete" | "error";
type OnboardingIntegration = "shopify" | "meta" | "klaviyo";
type OnboardingIntegrationProgress = Partial<Record<OnboardingIntegration, { state: IntegrationProgressState; message: string }>>;
type ShopifySalesPreview = { sales?: { net_sales?: number; currency_code?: string | null } };

const ONBOARDING_PREVIEW_STORAGE_KEY = "e-nora-admin-onboarding-shopify-preview";

const CURRENCY_OPTIONS = [
  { value: "EUR", label: "EUR — Euro" },
  { value: "USD", label: "USD — Dólar estadounidense" },
  { value: "GBP", label: "GBP — Libra esterlina" },
  { value: "MXN", label: "MXN — Peso mexicano" },
  { value: "ARS", label: "ARS — Peso argentino" },
  { value: "CLP", label: "CLP — Peso chileno" },
  { value: "COP", label: "COP — Peso colombiano" },
  { value: "PEN", label: "PEN — Sol peruano" },
  { value: "BRL", label: "BRL — Real brasileño" },
  { value: "CAD", label: "CAD — Dólar canadiense" },
  { value: "AUD", label: "AUD — Dólar australiano" },
  { value: "JPY", label: "JPY — Yen japonés" },
  { value: "CHF", label: "CHF — Franco suizo" },
  { value: "CNY", label: "CNY — Yuan chino" },
  { value: "SEK", label: "SEK — Corona sueca" },
  { value: "NOK", label: "NOK — Corona noruega" },
  { value: "DKK", label: "DKK — Corona danesa" },
  { value: "PLN", label: "PLN — Złoty polaco" },
  { value: "CZK", label: "CZK — Corona checa" },
  { value: "HUF", label: "HUF — Florín húngaro" },
  { value: "RON", label: "RON — Leu rumano" },
  { value: "TRY", label: "TRY — Lira turca" },
  { value: "INR", label: "INR — Rupia india" },
  { value: "AED", label: "AED — Dirham de los Emiratos Árabes Unidos" },
  { value: "SAR", label: "SAR — Rial saudí" },
  { value: "KRW", label: "KRW — Won surcoreano" },
  { value: "SGD", label: "SGD — Dólar de Singapur" },
  { value: "HKD", label: "HKD — Dólar de Hong Kong" },
  { value: "NZD", label: "NZD — Dólar neozelandés" },
  { value: "ZAR", label: "ZAR — Rand sudafricano" },
];

const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", label: "España peninsular — Europe/Madrid" },
  { value: "Atlantic/Canary", label: "Islas Canarias — Atlantic/Canary" },
  { value: "Europe/Lisbon", label: "Portugal — Europe/Lisbon" },
  { value: "Europe/London", label: "Reino Unido — Europe/London" },
  { value: "Europe/Paris", label: "Francia — Europe/Paris" },
  { value: "Europe/Berlin", label: "Alemania — Europe/Berlin" },
  { value: "Europe/Rome", label: "Italia — Europe/Rome" },
  { value: "Europe/Amsterdam", label: "Países Bajos — Europe/Amsterdam" },
  { value: "America/Mexico_City", label: "México — America/Mexico_City" },
  { value: "America/Bogota", label: "Colombia — America/Bogota" },
  { value: "America/Lima", label: "Perú — America/Lima" },
  { value: "America/Santiago", label: "Chile — America/Santiago" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina — America/Argentina/Buenos_Aires" },
  { value: "America/Sao_Paulo", label: "Brasil — America/Sao_Paulo" },
  { value: "America/New_York", label: "Estados Unidos (este) — America/New_York" },
  { value: "America/Chicago", label: "Estados Unidos (centro) — America/Chicago" },
  { value: "America/Los_Angeles", label: "Estados Unidos (oeste) — America/Los_Angeles" },
  { value: "America/Toronto", label: "Canadá — America/Toronto" },
  { value: "Asia/Tokyo", label: "Japón — Asia/Tokyo" },
  { value: "Asia/Shanghai", label: "China — Asia/Shanghai" },
  { value: "Asia/Kolkata", label: "India — Asia/Kolkata" },
  { value: "Asia/Dubai", label: "Emiratos Árabes Unidos — Asia/Dubai" },
  { value: "Asia/Singapore", label: "Singapur — Asia/Singapore" },
  { value: "Africa/Johannesburg", label: "Sudáfrica — Africa/Johannesburg" },
  { value: "Australia/Sydney", label: "Australia — Australia/Sydney" },
  { value: "UTC", label: "UTC — Tiempo universal coordinado" },
];

// Solo pregunta datos que no se pueden inferir de forma fiable desde las
// integraciones. Los datos observables se importarán y se revisarán después.
const ONBOARDING_QUESTION_CATEGORIES: StoreQuestionCategory[] = [
  {
    id: "objetivos_y_reglas",
    label: "Objetivos y reglas del negocio",
    questions: [
      { id: "monthly_revenue_target", question: "¿Qué facturación mensual quieres alcanzar?", type: "number", unit: "€" },
      { id: "minimum_margin_target_pct", question: "¿Qué margen mínimo quieres proteger?", type: "number", unit: "%" },
      { id: "maximum_cac_target", question: "¿Cuál es el coste máximo que aceptarías para captar un cliente?", type: "number", unit: "€" },
      { id: "commercial_guardrails", question: "¿Qué descuentos, mensajes o promesas debemos evitar?", type: "textarea" },
      { id: "business_priority", question: "¿Cuál es la prioridad más importante de tu negocio ahora?", type: "textarea" },
    ],
  },
  {
    id: "costes_no_importables",
    label: "Costes que solo tú conoces",
    questions: [
      { id: "fixed_expenses_monthly", question: "¿Cuánto suman tus gastos fijos mensuales?", type: "number", unit: "€" },
      { id: "default_shipping_cost", question: "Si no aparece en Shopify, ¿cuál es tu coste medio real de envío por pedido?", type: "number", unit: "€" },
      { id: "payment_fee_pct", question: "Si no podemos leerlo de la integración, ¿qué comisión porcentual te cobra el proveedor de pagos?", type: "number", unit: "%" },
      { id: "payment_fee_fixed", question: "Si no podemos leerlo de la integración, ¿qué importe fijo te cobra por transacción?", type: "number", unit: "€" },
    ],
  },
];

const IMPORT_DATA_SOURCES = [
  {
    id: "shopify",
    name: "Shopify",
    src: "/shopify-svgrepo-com.svg",
    description: "Ventas netas, pedidos, ticket medio, catálogo, stock, descuentos y costes unitarios cuando estén informados.",
  },
  {
    id: "meta",
    name: "Meta Ads",
    src: "/meta-logo-facebook-svgrepo-com.svg",
    description: "Gasto publicitario, campañas y resultados atribuidos por Meta para estimar CAC y rendimiento.",
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    src: "/logos/klaviyo.png",
    description: "Campañas, flujos, ingresos atribuidos y actividad de email/SMS disponible.",
  },
  {
    id: "web",
    name: "Web de la tienda",
    src: null,
    description: "Marca, catálogo, políticas de envío y devolución y canales de atención que podamos revisar en la web.",
  },
] as const;

function OnboardingPreview({ bootstrap }: { bootstrap: BootstrapResponse }) {
  const [signupKind, setSignupKind] = useState<SignupKind>("self_signup");
  const [role, setRole] = useState<ProfileRole>("client");
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [shopifyDomain, setShopifyDomain] = useState("");
  const [showShopifyDomain, setShowShopifyDomain] = useState(false);
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>("create");
  const [organizationName, setOrganizationName] = useState("");
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [consultantCode, setConsultantCode] = useState("");
  const [consultantCodePreview, setConsultantCodePreview] = useState<ConsultantCodePreview | null>(null);
  const [isCheckingConsultantCode, setIsCheckingConsultantCode] = useState(false);
  const [testOrganizationId, setTestOrganizationId] = useState("");
  const [currencyCode, setCurrencyCode] = useState("EUR");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [integrationProgress, setIntegrationProgress] = useState<OnboardingIntegrationProgress>({});
  const [authorizingIntegration, setAuthorizingIntegration] = useState<OnboardingIntegration | null>(null);
  const [isRestoringIntegrationReturn, setIsRestoringIntegrationReturn] = useState(true);
  const [isLoadingImportReview, setIsLoadingImportReview] = useState(false);
  const [importReviewAttemptKey, setImportReviewAttemptKey] = useState(0);
  const [importReviewError, setImportReviewError] = useState<string | null>(null);
  const [monthlyNetSales, setMonthlyNetSales] = useState<number | null>(null);
  const [importedCurrencyCode, setImportedCurrencyCode] = useState<string | null>(null);
  const [openImportSource, setOpenImportSource] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPasswordStep = signupKind === "invited";
  const organizationStep = hasPasswordStep ? 2 : 1;
  const profileStep = organizationStep + 1;
  const storeStep = profileStep + 1;
  const importStep = storeStep + 1;
  const firstQuestionStep = importStep + 1;
  const totalSteps = (hasPasswordStep ? 5 : 4) + ONBOARDING_QUESTION_CATEGORIES.length;
  const visibleStep = step;
  const currentQuestionCategory = ONBOARDING_QUESTION_CATEGORIES[step - firstQuestionStep];
  const passwordMismatch = passwordConfirmationState(password, confirm) === "mismatch";
  const testOrganizations = bootstrap.memberships
    .filter((membership) => membership.organization)
    .map((membership) => ({
      value: membership.organization_id,
      label: membership.organization?.display_name ?? membership.organization_id,
    }));
  const assignedOrganizationName = organizationMode === "existing"
    ? testOrganizations.find((organization) => organization.value === selectedOrganizationId)?.label ?? ""
    : consultantCodePreview?.organization?.display_name || organizationName;

  function updateIntegrationProgress(
    integration: OnboardingIntegration,
    state: IntegrationProgressState,
    message: string,
  ) {
    setIntegrationProgress((current) => ({
      ...current,
      [integration]: { state, message },
    }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedIntegration = (["shopify", "meta", "klaviyo"] as const)
      .find((integration) => params.has(integration));
    if (!returnedIntegration) {
      setIsRestoringIntegrationReturn(false);
      return;
    }

    const integration: OnboardingIntegration = returnedIntegration;
    const returnedStatus = params.get(returnedIntegration) ?? "connected";
    const providerLabel = returnedIntegration === "meta" ? "Meta" : returnedIntegration === "klaviyo" ? "Klaviyo" : "Shopify";
    let savedOrganizationId = "";
    let returnedShopDomain = "";
    let restoredSignupKind: SignupKind = "self_signup";
    try {
      const serialized = window.sessionStorage.getItem(ONBOARDING_PREVIEW_STORAGE_KEY);
      if (serialized) {
        const saved = JSON.parse(serialized) as {
          signupKind?: SignupKind;
          role?: ProfileRole;
          name?: string;
          businessName?: string;
          brandName?: string;
          websiteUrl?: string;
          shopifyDomain?: string;
          organizationMode?: OrganizationMode;
          organizationName?: string;
          selectedOrganizationId?: string;
          consultantCode?: string;
          consultantCodePreview?: ConsultantCodePreview | null;
          testOrganizationId?: string;
          currencyCode?: string;
          timezone?: string;
          answers?: Record<string, string>;
          avatar?: string | null;
          integrationProgress?: OnboardingIntegrationProgress;
        };
        if (saved.signupKind) {
          restoredSignupKind = saved.signupKind;
          setSignupKind(saved.signupKind);
        }
        if (saved.role) setRole(saved.role);
        if (saved.name) setName(saved.name);
        if (saved.businessName) setBusinessName(saved.businessName);
        if (saved.brandName) setBrandName(saved.brandName);
        if (saved.websiteUrl) setWebsiteUrl(saved.websiteUrl);
        if (saved.shopifyDomain) {
          setShopifyDomain(saved.shopifyDomain);
          setShowShopifyDomain(true);
        }
        if (saved.organizationMode) setOrganizationMode(saved.organizationMode);
        if (saved.organizationName) setOrganizationName(saved.organizationName);
        if (saved.selectedOrganizationId) setSelectedOrganizationId(saved.selectedOrganizationId);
        if (saved.consultantCode) setConsultantCode(saved.consultantCode);
        if (saved.consultantCodePreview) setConsultantCodePreview(saved.consultantCodePreview);
        if (saved.testOrganizationId) setTestOrganizationId(saved.testOrganizationId);
        if (saved.currencyCode) setCurrencyCode(saved.currencyCode);
        if (saved.timezone) setTimezone(saved.timezone);
        if (saved.answers) setAnswers(saved.answers);
        if (saved.avatar) setAvatar(saved.avatar);
        if (saved.integrationProgress) setIntegrationProgress(saved.integrationProgress);
        savedOrganizationId = saved.testOrganizationId ?? "";
        returnedShopDomain = saved.shopifyDomain?.toLowerCase() ?? "";
      }
    } catch {
      window.sessionStorage.removeItem(ONBOARDING_PREVIEW_STORAGE_KEY);
    }
    window.sessionStorage.removeItem(ONBOARDING_PREVIEW_STORAGE_KEY);
    setStep(restoredSignupKind === "invited" ? 4 : 3);
    window.history.replaceState({}, "", window.location.pathname);

    if (["denied", "error", "already_claimed"].includes(returnedStatus)) {
      updateIntegrationProgress(
        returnedIntegration,
        "error",
        returnedStatus === "denied"
          ? `No se autorizó el acceso a ${providerLabel}. Revisa los permisos e inténtalo de nuevo.`
          : returnedStatus === "already_claimed"
            ? "Esta tienda ya está conectada a otra organización. Elige la organización correcta o consulta con soporte."
            : `No se pudo completar la conexión con ${providerLabel}. Revisa Integraciones o vuelve a intentarlo.`,
      );
      setIsRestoringIntegrationReturn(false);
      return;
    }

    if (!savedOrganizationId) {
      updateIntegrationProgress(integration, "error", "No se pudo restaurar la organización seleccionada. Vuelve al paso 3 para revisar la conexión.");
      setIsRestoringIntegrationReturn(false);
      return;
    }

    updateIntegrationProgress(integration, "pending", `${providerLabel} autorizó la conexión. Estamos preparando la sincronización inicial…`);
    const returnedShopDomainFromUrl = returnedIntegration === "shopify" ? params.get("tienda")?.toLowerCase() ?? returnedShopDomain : "";
    const providerId = returnedIntegration === "meta" ? "meta_ads" : returnedIntegration;
    let cancelled = false;
    let timer: number | undefined;
    let attempts = 0;

    async function refreshImportStatus() {
      if (!savedOrganizationId || cancelled) return;
      attempts += 1;
      try {
        const response = await apiFetch(
          `/v1/organizations/${savedOrganizationId}/integrations?onboarding_poll=${Date.now()}`,
        );
        if (!response.ok) {
          if (attempts >= 20) {
            updateIntegrationProgress(integration, "error", `No pudimos consultar el estado de ${providerLabel}. Abre Integraciones para revisar la conexión.`);
            cancelled = true;
          }
          return;
        }
        const payload = (await response.json()) as IntegrationsResponse;
        const provider = payload.providers.find((item) => item.id === providerId);
        const connection = provider?.connections.find((item) =>
          returnedShopDomainFromUrl ? item.provider_account_id?.toLowerCase() === returnedShopDomainFromUrl : true,
        ) ?? provider?.connection;
        if (!connection) {
          if (attempts >= 20) {
            updateIntegrationProgress(integration, "error", `No encontramos la conexión de ${providerLabel} en la organización seleccionada. Revisa Integraciones.`);
            cancelled = true;
          }
          return;
        }

        if (connection.status === "error") {
          updateIntegrationProgress(integration, "error", connection.last_error_message || `${providerLabel} no pudo completar la conexión. Revisa los permisos e inténtalo de nuevo.`);
          cancelled = true;
          return;
        }

        const syncStatus = connection.latest_sync?.status?.toLowerCase();
        if (
          attempts >= 20 &&
          connection.status !== "syncing" &&
          (!connection.latest_sync || connection.latest_sync.sync_type === "oauth")
        ) {
          updateIntegrationProgress(integration, "error", `La autorización de ${providerLabel} se completó, pero no hemos podido confirmar el inicio de la sincronización. Revisa Integraciones.`);
          cancelled = true;
          return;
        }
        if (
          connection.status !== "syncing" &&
          ["failed", "error"].includes(syncStatus ?? "")
        ) {
          updateIntegrationProgress(integration, "error", connection.latest_sync?.error_message || `La sincronización de ${providerLabel} no se completó. Puedes reintentarla desde Integraciones.`);
          cancelled = true;
          return;
        }
        if (
          connection.status !== "syncing" &&
          connection.latest_sync?.sync_type !== "oauth" &&
          ["succeeded", "completed", "complete"].includes(syncStatus ?? "")
        ) {
          updateIntegrationProgress(integration, "complete", `Los datos de ${providerLabel} ya están disponibles en la organización seleccionada.`);
          cancelled = true;
          return;
        }

        const isSyncing = connection.status === "syncing" || syncStatus === "running" || syncStatus === "in_progress";
        updateIntegrationProgress(
          integration,
          isSyncing ? "importing" : "pending",
          isSyncing
            ? `${providerLabel} está importando y guardando datos. Puedes continuar con el cuestionario.`
            : `Conexión autorizada. La sincronización inicial de ${providerLabel} empezará en breve.`,
        );
      } catch {
        if (attempts >= 20) {
          updateIntegrationProgress(integration, "error", `No pudimos consultar el estado de ${providerLabel}. Abre Integraciones para revisar la conexión.`);
          cancelled = true;
        }
      }
    }

    void refreshImportStatus();
    timer = window.setInterval(() => void refreshImportStatus(), 5000);
    setIsRestoringIntegrationReturn(false);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  // OAuth parameters initialize this one-time restoration.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step !== importStep) return;

    let cancelled = false;
    let timeout: number | undefined;
    let attempts = 0;
    setImportReviewError(null);

    if (!testOrganizationId) {
      setIntegrationProgress({
        shopify: { state: "not_connected", message: "Selecciona un destino real para revisar una conexión de Shopify." },
        meta: { state: "not_connected", message: "Selecciona un destino real para revisar una conexión de Meta." },
        klaviyo: { state: "not_connected", message: "Selecciona un destino real para revisar una conexión de Klaviyo." },
      });
      setMonthlyNetSales(null);
      setImportedCurrencyCode(null);
      setIsLoadingImportReview(false);
      return () => { cancelled = true; };
    }

    async function refreshImportReview() {
      if (cancelled) return;
      attempts += 1;
      if (attempts === 1) setIsLoadingImportReview(true);

      try {
        const response = await apiFetch(
          `/v1/organizations/${testOrganizationId}/integrations?onboarding_review=${Date.now()}`,
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
          throw new Error(payload.message || payload.error || `No se pudieron consultar las integraciones (${response.status}).`);
        }

        const payload = (await response.json()) as IntegrationsResponse;
        if (!cancelled) setImportReviewError(null);
        const activeStates: IntegrationProgressState[] = [];
        for (const [providerId, integration] of [["shopify", "shopify"], ["meta_ads", "meta"], ["klaviyo", "klaviyo"]] as const) {
          const provider = payload.providers.find((item) => item.id === providerId);
          const connection = provider?.connections.find((item) => item.status === "syncing" || item.status === "connected")
            ?? provider?.connection;
          if (!connection) {
            setIntegrationProgress((current) => ({
              ...current,
              [integration]: { state: "not_connected", message: `No hay una conexión de ${provider?.name ?? integration} en el destino seleccionado.` },
            }));
            continue;
          }

          const sync = connection.latest_sync ?? provider?.latest_sync;
          const syncStatus = sync?.status?.toLowerCase();
          let state: IntegrationProgressState;
          let message: string;
          if (connection.status === "error" || ["failed", "error"].includes(syncStatus ?? "")) {
            state = "error";
            message = connection.last_error_message || sync?.error_message || `La sincronización de ${provider?.name ?? integration} terminó con error.`;
          } else if (connection.status === "syncing" || ["running", "in_progress"].includes(syncStatus ?? "")) {
            state = "importing";
            message = `${provider?.name ?? integration} está importando datos. Puedes continuar mientras termina.`;
          } else if (sync && sync.sync_type !== "oauth" && ["succeeded", "completed", "complete"].includes(syncStatus ?? "")) {
            state = "complete";
            message = `${provider?.name ?? integration}: sincronización completada.`;
          } else {
            state = "pending";
            message = `Conexión autorizada. Esperando a que empiece la sincronización de ${provider?.name ?? integration}.`;
          }
          activeStates.push(state);
          setIntegrationProgress((current) => ({ ...current, [integration]: { state, message } }));
        }

        const shopify = payload.providers.find((item) => item.id === "shopify");
        const shopifyConnection = shopify?.connections.find((item) => item.status === "syncing" || item.status === "connected")
          ?? shopify?.connection;
        if (shopifyConnection && shopifyConnection.status !== "error") {
          const metricsResponse = await apiFetch(
            `/v1/organizations/${testOrganizationId}/shopify/metrics?days=30&connectionId=${encodeURIComponent(shopifyConnection.id)}`,
          );
          if (metricsResponse.ok) {
            const metrics = (await metricsResponse.json()) as ShopifySalesPreview;
            setMonthlyNetSales(typeof metrics.sales?.net_sales === "number" ? metrics.sales.net_sales : null);
            setImportedCurrencyCode(metrics.sales?.currency_code ?? null);
          } else if (metricsResponse.status !== 404) {
            const details = (await metricsResponse.json().catch(() => ({}))) as { message?: string; error?: string };
            setImportReviewError(details.message || details.error || `Shopify todavía no devuelve ventas (${metricsResponse.status}).`);
          }
        } else {
          setMonthlyNetSales(null);
          setImportedCurrencyCode(null);
        }

        const stillWorking = activeStates.some((state) => state === "pending" || state === "importing");
        if (!cancelled && stillWorking && attempts < 20) {
          timeout = window.setTimeout(() => void refreshImportReview(), 5000);
        }
      } catch (caught) {
        if (!cancelled) {
          setImportReviewError(caught instanceof Error ? caught.message : "No se pudo consultar el estado de las importaciones.");
          if (attempts < 20) timeout = window.setTimeout(() => void refreshImportReview(), 5000);
        }
      } finally {
        if (!cancelled && attempts === 1) setIsLoadingImportReview(false);
      }
    }

    void refreshImportReview();
    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [importReviewAttemptKey, importStep, step, testOrganizationId]);

  function reset() {
    setStep(1);
    setPassword("");
    setConfirm("");
    setName("");
    setBusinessName("");
    setAvatar(null);
    setAvatarFileName(null);
    setBrandName("");
    setWebsiteUrl("");
    setShopifyDomain("");
    setShowShopifyDomain(false);
    setOrganizationMode("create");
    setOrganizationName("");
    setSelectedOrganizationId("");
    setConsultantCode("");
    setConsultantCodePreview(null);
    setIntegrationProgress({});
    setAuthorizingIntegration(null);
    setIsLoadingImportReview(false);
    setImportReviewAttemptKey(0);
    setImportReviewError(null);
    setMonthlyNetSales(null);
    setImportedCurrencyCode(null);
    setOpenImportSource(null);
    window.sessionStorage.removeItem(ONBOARDING_PREVIEW_STORAGE_KEY);
    setCurrencyCode("EUR");
    setTimezone("Europe/Madrid");
    setAnswers({});
    setCompleted(false);
    setError(null);
  }

  function changeSignupKind(value: string) {
    const nextSignupKind = value as SignupKind;
    setSignupKind(nextSignupKind);
    setStep(1);
    setCompleted(false);
    setError(null);
  }

  async function validateConsultantCode() {
    setError(null);
    setConsultantCodePreview(null);
    if (!consultantCode.trim()) {
      setError("Introduce el código que te ha facilitado tu consultor.");
      return;
    }
    setIsCheckingConsultantCode(true);
    try {
      const response = await apiFetch("/v1/invites/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: consultantCode.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as ConsultantCodePreview & {
        message?: string;
        error?: string;
      };
      if (!response.ok || !payload.expires_at) {
        setError(payload.message || payload.error || "No hemos podido validar el código. Comprueba que esté bien escrito.");
        return;
      }
      setConsultantCodePreview(payload);
      if (payload.organization) {
        setOrganizationName(payload.organization.display_name);
      }
    } catch {
      setError("No se pudo validar el código por un error de conexión. Inténtalo de nuevo.");
    } finally {
      setIsCheckingConsultantCode(false);
    }
  }

  function continueOrganization() {
    setError(null);
    if (organizationMode === "create" && !organizationName.trim()) {
      setError("Escribe el nombre que quieres para tu organización.");
      return;
    }
    if (organizationMode === "existing" && !selectedOrganizationId) {
      setError("Selecciona la organización a la que pertenece esta tienda.");
      return;
    }
    if (organizationMode === "consultant" && !consultantCodePreview) {
      setError("Valida primero el código del consultor.");
      return;
    }
    if (organizationMode === "consultant" && consultantCodePreview?.requires_signup && !organizationName.trim()) {
      setError("Escribe el nombre de tu espacio para terminar de vincularlo al consultor.");
      return;
    }
    setStep(profileStep);
  }

  function finishPreview() {
    setError(null);
    if (!name.trim()) {
      setError("Escribe el nombre personal.");
      return;
    }
    if (role === "consultant" && !businessName.trim()) {
      setError("Escribe el nombre del negocio o agencia.");
      return;
    }
    setStep((current) => current + 1);
  }

  function continueStoreProfile() {
    setError(null);
    if (!brandName.trim()) {
      setError("Escribe el nombre de la tienda o marca.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(currencyCode)) {
      setError("Indica la moneda con su código ISO de tres letras, por ejemplo EUR, USD o MXN.");
      return;
    }
    const candidateUrl = websiteUrl.trim();
    if (!candidateUrl) {
      setError("Añade la dirección de la web de la tienda.");
      return;
    }
    try {
      const parsed = new URL(candidateUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid protocol");
    } catch {
      setError("Introduce una URL válida, por ejemplo https://mitienda.com.");
      return;
    }
    setStep(importStep);
  }

  async function connectIntegrationForPreview(integration: OnboardingIntegration) {
    setError(null);
    if (!testOrganizationId) {
      setError("Selecciona una organización donde conectar la cuenta.");
      return;
    }
    const providerLabel = integration === "meta" ? "Meta" : integration === "klaviyo" ? "Klaviyo" : "Shopify";
    let normalizedShop = shopifyDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (integration === "shopify" && !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(normalizedShop)) {
      setError("Introduce el dominio interno terminado en .myshopify.com que Shopify asignó a la tienda.");
      return;
    }

    setAuthorizingIntegration(integration);
    updateIntegrationProgress(integration, "authorizing", `Conectando con ${providerLabel}…`);
    try {
      const endpointProvider = integration === "meta" ? "meta" : integration;
      const body = integration === "shopify"
        ? { shopDomain: normalizedShop, appMode: "public", returnTo: "/admin/onboarding" }
        : { returnTo: "/admin/onboarding" };
      const response = await apiFetch(
        `/v1/organizations/${testOrganizationId}/integrations/${endpointProvider}/connect`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        const message = payload.message || payload.error || `No se pudo iniciar la conexión con ${providerLabel}.`;
        updateIntegrationProgress(integration, "error", message);
        setAuthorizingIntegration(null);
        setError(message);
        return;
      }
      const payload = (await response.json()) as { redirectUrl: string };
      const avatarForReturn = avatar && !avatar.startsWith("data:") ? avatar : null;
      window.sessionStorage.setItem(ONBOARDING_PREVIEW_STORAGE_KEY, JSON.stringify({
        signupKind,
        role,
        name,
        businessName,
        brandName,
        websiteUrl,
        shopifyDomain: normalizedShop || shopifyDomain,
        organizationMode,
        organizationName,
        selectedOrganizationId,
        consultantCode,
        consultantCodePreview,
        testOrganizationId,
        currencyCode,
        timezone,
        answers,
        avatar: avatarForReturn,
        integrationProgress,
      }));
      window.location.assign(payload.redirectUrl);
    } catch {
      setAuthorizingIntegration(null);
      updateIntegrationProgress(integration, "error", `Error de red al conectar con ${providerLabel}. Reintenta.`);
      setError(`Error de red al conectar con ${providerLabel}. Reintenta.`);
    }
  }
  function updateAnswer(question: StoreQuestion, value: string) {
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  function moveQuestionnaire(delta: 1 | -1) {
    const next = step + delta;
    if (next < firstQuestionStep) {
      setStep(importStep);
      return;
    }
    if (next >= firstQuestionStep + ONBOARDING_QUESTION_CATEGORIES.length) {
      setCompleted(true);
      return;
    }
    setStep(next);
  }

  const onboardingQuestions = ONBOARDING_QUESTION_CATEGORIES
    .flatMap((category) => category.questions)
  const completedAnswerCount = onboardingQuestions
    .filter((question) => Boolean(answers[question.id]?.trim())).length;

  const connectedImportStates = (["shopify", "meta", "klaviyo"] as const)
    .map((integration) => integrationProgress[integration]?.state ?? "not_connected")
    .filter((state) => state !== "not_connected" && state !== "idle");
  const importProgressPercent = connectedImportStates.length
    ? Math.round(connectedImportStates.reduce((total, state) => total + (
      state === "complete" || state === "error" ? 100 : state === "importing" ? 65 : 15
    ), 0) / connectedImportStates.length)
    : 0;
  const importedRevenueLabel = monthlyNetSales == null
    ? null
    : new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: importedCurrencyCode && /^[A-Z]{3}$/.test(importedCurrencyCode) ? importedCurrencyCode : currencyCode,
      maximumFractionDigits: 0,
    }).format(monthlyNetSales);

  function renderQuestion(question: StoreQuestion) {
    const value = answers[question.id] ?? "";
    return (
      <Field key={question.id} label={question.question}>
        {question.id === "monthly_revenue_target" ? (
          <div className="mb-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm">
            {importedRevenueLabel ? (
              <p>Ventas netas importadas en los últimos 30 días: <strong>{importedRevenueLabel}</strong>. Indica el objetivo mensual que quieres alcanzar.</p>
            ) : (
              <p>Aún no tenemos ventas netas de Shopify para mostrar. Puedes conectar Shopify o indicar tu objetivo igualmente.</p>
            )}
          </div>
        ) : null}
        {question.type === "textarea" ? (
          <Textarea
            value={value}
            onChange={(event) => updateAnswer(question, event.target.value)}
            placeholder="Escribe tu respuesta..."
            rows={3}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Input
              type={question.type === "number" ? "number" : "text"}
              value={value}
              onChange={(event) => updateAnswer(question, event.target.value)}
              placeholder={question.placeholder ?? "Escribe tu respuesta..."}
            />
            {question.unit ? <span className="shrink-0 text-sm text-muted">{question.unit === "€" ? currencyCode : question.unit}</span> : null}
          </div>
        )}
      </Field>
    );
  }

  function updateWebsiteUrl(value: string) {
    setWebsiteUrl(value);
    const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/)[0];
    if (domain?.endsWith(".myshopify.com")) {
      setShopifyDomain(domain);
      setShowShopifyDomain(true);
    }
  }

  function previewAvatar(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Elige un archivo de imagen.");
      return;
    }
    setAvatarFileName(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setAvatar(reader.result);
    };
    reader.readAsDataURL(file);
  }

  if (isRestoringIntegrationReturn) {
    return <Card title="Volviendo de la autorización" description="Restaurando el paso 3 y el estado del onboarding…" />;
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950">
        Prueba de administración · respuestas temporales, conexiones reales.
      </div>
      {Object.entries(integrationProgress).map(([integration, progress]) => {
        if (!progress || progress.state === "idle" || progress.state === "not_connected") return null;
        const label = integration === "meta" ? "Meta" : integration === "klaviyo" ? "Klaviyo" : "Shopify";
        return (
          <Banner key={integration} tone={progress.state === "error" ? "danger" : progress.state === "complete" ? "success" : "warn"}>
            <span className="font-medium">
              {progress.state === "authorizing" ? `Conectando con ${label}…` :
                progress.state === "pending" ? `${label}: conexión autorizada` :
                progress.state === "importing" ? `Sincronizando ${label}` :
                progress.state === "complete" ? `${label}: sincronización completada` : `Conexión con ${label}`}
            </span>
            {progress.message ? <span className="ml-1">{progress.message}</span> : null}
          </Banner>
        );
      })}

      <Card title="Configura la prueba" description="Elige qué variante del alta quieres recorrer.">
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Tipo de alta">
            <Select
              value={signupKind}
              onChange={changeSignupKind}
              options={[
                { value: "invited", label: "Cuenta invitada: contraseña y perfil" },
                { value: "self_signup", label: "Registro propio: solo perfil" },
              ]}
            />
          </Field>
          <Field label="Perfil a simular">
            <Select
              value={role}
              onChange={(value) => {
                setRole(value as ProfileRole);
                setError(null);
                if (completed) {
                  setCompleted(false);
                  setStep(1);
                }
              }}
              options={[
                { value: "client", label: "Cliente" },
                { value: "consultant", label: "Consultor" },
              ]}
            />
          </Field>
          <Field label="Destino de conexiones reales de prueba">
            <Select
              value={testOrganizationId}
              onChange={setTestOrganizationId}
              options={testOrganizations}
              placeholder={testOrganizations.length ? "Seleccionar organización" : "No hay organizaciones disponibles"}
              disabled={testOrganizations.length === 0}
            />
          </Field>
        </div>
        <p className="mt-3 text-xs text-muted">
          Este destino solo se usa al autorizar Shopify, Meta o Klaviyo desde el panel. La organización elegida dentro del onboarding es una simulación independiente.
        </p>
        <div className="mt-4">
          <Button variant="secondary" onClick={reset}>
            <RotateCcw size={16} aria-hidden /> Reiniciar prueba
          </Button>
        </div>
      </Card>

      {!completed ? (
        <section
          aria-label="Vista previa del onboarding"
          className="mx-auto w-full max-w-3xl rounded-2xl border border-separator bg-white p-8 shadow-sm sm:p-12"
        >
          <div className="mb-6 flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, index) => index + 1).map((item) => (
              <span
                key={item}
                className={cn("h-1.5 flex-1 rounded-full", item <= visibleStep ? "bg-accent" : "bg-separator")}
              />
            ))}
          </div>
          <p className="mb-5 text-sm font-medium text-muted">
            Paso {visibleStep} de {totalSteps}
          </p>

          {hasPasswordStep && step === 1 ? (
            <Card title="Crea tu contraseña" description="Es lo primero. La usarás para entrar a partir de ahora.">
              <div className="mt-6 grid gap-6">
                <Field label="Contraseña">
                  <PasswordInput
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={PASSWORD_MIN_LENGTH}
                  />
                </Field>
                <PasswordRequirements password={password} />
                <Field label="Repite la contraseña">
                  <PasswordInput
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    minLength={PASSWORD_MIN_LENGTH}
                    aria-invalid={passwordMismatch}
                    required
                  />
                </Field>
                {passwordMismatch ? <p className="text-xs text-danger" role="alert">Las contraseñas no coinciden.</p> : null}
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <Button
                  disabled={!isPasswordValid(password) || passwordConfirmationState(password, confirm) !== "match"}
                  onClick={() => { setError(null); setStep(organizationStep); }}
                >
                  Continuar
                </Button>
              </div>
            </Card>
          ) : step === organizationStep ? (
            <Card title="¿Con qué organización vas a trabajar?" description="Cada tienda quedará asociada a la organización que elijas aquí.">
              <div className="mt-6 grid gap-5">
                <Field label="Forma de acceso">
                  <Select
                    value={organizationMode}
                    onChange={(value) => {
                      setOrganizationMode(value as OrganizationMode);
                      setConsultantCodePreview(null);
                      setError(null);
                    }}
                    options={[
                      { value: "create", label: "Alta directa · crear una organización" },
                      { value: "existing", label: "Elegir una organización existente" },
                      { value: "consultant", label: "Vengo de un consultor · tengo un código" },
                    ]}
                  />
                </Field>
                {organizationMode === "create" ? (
                  <Field label="Nombre de la organización">
                    <Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="El nombre que quieras" required />
                  </Field>
                ) : organizationMode === "existing" ? (
                  <Field label="Organización de esta tienda">
                    <Select value={selectedOrganizationId} onChange={setSelectedOrganizationId} options={testOrganizations} placeholder="Seleccionar organización" disabled={testOrganizations.length === 0} />
                  </Field>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <Field label="Código del consultor">
                        <Input value={consultantCode} onChange={(event) => { setConsultantCode(event.target.value.toUpperCase()); setConsultantCodePreview(null); }} placeholder="Ej. ENORA-1234" autoComplete="off" required />
                      </Field>
                      <Button variant="secondary" disabled={isCheckingConsultantCode || !consultantCode.trim()} onClick={() => void validateConsultantCode()}>
                        {isCheckingConsultantCode ? "Comprobando…" : "Validar código"}
                      </Button>
                    </div>
                    {consultantCodePreview ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                        <div className="flex items-center gap-2 font-semibold"><Check size={17} aria-hidden /> Código válido</div>
                        {consultantCodePreview.organization ? (
                          <p className="mt-1">Organización: <span className="font-medium">{consultantCodePreview.organization.display_name}</span>. Esta tienda se asociará a ella.</p>
                        ) : (
                          <>
                            <p className="mt-1">Consultor: <span className="font-medium">{consultantCodePreview.consultant?.display_name ?? "Consultor E-NORA"}</span>.</p>
                            <p className="mt-1">Este código vincula la tienda con el consultor. Indica el nombre de la organización a la que pertenecerá; así cada tienda podrá quedar en una organización distinta.</p>
                            <Field label="Nombre de tu organización">
                              <Input value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="El nombre que quieras" required />
                            </Field>
                          </>
                        )}
                      </div>
                    ) : null}
                  </>
                )}
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setStep(organizationStep)}>Volver</Button>
                  <Button disabled={organizationMode === "consultant" && isCheckingConsultantCode} onClick={continueOrganization}>Continuar</Button>
                </div>
              </div>
            </Card>
          ) : step === profileStep ? (
            <Card title="Tu perfil" description="Puedes cambiar el nombre que te asignaron y elegir un avatar.">
              <div className="mt-6 grid gap-6">
                <Field label="Nombre personal">
                  <Input value={name} onChange={(event) => setName(event.target.value)} required />
                </Field>
                {role === "consultant" ? (
                  <Field label="Nombre de tu negocio o agencia">
                    <Input value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Mi agencia" required />
                  </Field>
                ) : null}
                <div>
                  <p className="text-sm font-medium text-foreground">Avatar</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {avatar && !AVATAR_PRESETS.includes(avatar) ? (
                      <span className="rounded-full ring-2 ring-accent ring-offset-2">
                        <Avatar name={name || "?"} src={avatar} size="md" />
                      </span>
                    ) : null}
                    {AVATAR_PRESETS.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => { setAvatar(url); setAvatarFileName(null); }}
                        className={cn("rounded-full ring-2 ring-offset-2 transition", avatar === url ? "ring-accent" : "ring-transparent")}
                        aria-label="Elegir avatar"
                        aria-pressed={avatar === url}
                      >
                        <Avatar name={name || "?"} src={url} size="md" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <label className="relative flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4 transition hover:border-accent hover:bg-accent/10 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        aria-label="Elegir foto de perfil"
                        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          previewAvatar(file);
                          event.currentTarget.value = "";
                        }}
                      />
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                        <ImagePlus size={20} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {avatarFileName ?? "Sube una foto de perfil"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted">
                          {avatarFileName ? "Lista para previsualizar" : "PNG, JPG, WEBP o GIF · solo vista previa"}
                        </span>
                      </span>
                      <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-separator bg-white px-3 text-sm font-medium text-foreground shadow-sm">
                        <Upload size={16} aria-hidden />
                        Elegir archivo
                      </span>
                    </label>
                    <p className="mt-2 text-xs text-muted">La imagen no se guarda en la cuenta.</p>
                  </div>
                </div>
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setStep(organizationStep)}>Volver</Button>
                  <Button onClick={finishPreview}>Continuar</Button>
                </div>
              </div>
            </Card>
          ) : step === storeStep ? (
            <Card title="Tu tienda" description={`Esta tienda quedará asociada a «${assignedOrganizationName || "tu organización"}».`}>
              <div className="mt-6 grid gap-6">
                <Field label="Marca">
                  <Input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Nombre de tu marca" required />
                </Field>
                <Field label="Web de la tienda">
                  <Input type="url" value={websiteUrl} onChange={(event) => updateWebsiteUrl(event.target.value)} placeholder="https://mitienda.com" required />
                </Field>
                {showShopifyDomain ? (
                  <Field label="URL Shopify">
                    <Input
                      value={shopifyDomain}
                      onChange={(event) => setShopifyDomain(event.target.value)}
                      placeholder="mitienda.myshopify.com"
                      autoComplete="off"
                    />
                  </Field>
                ) : null}
                <div className="flex items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-muted">
                  <Building2 size={17} aria-hidden />
                  <span>Organización de esta tienda: <strong className="text-foreground">{assignedOrganizationName}</strong></span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: "shopify", label: "Shopify", src: "/shopify-svgrepo-com.svg", alt: "" },
                    { id: "meta", label: "Meta", src: "/meta-logo-facebook-svgrepo-com.svg", alt: "" },
                    { id: "klaviyo", label: "Klaviyo", src: "/logos/klaviyo.png", alt: "" },
                  ] as const).map((integration) => {
                    const isDisabled = authorizingIntegration !== null || !testOrganizationId;
                    return (
                      <button
                        key={integration.id}
                        type="button"
                        onClick={() => {
                          if (integration.id === "shopify" && !shopifyDomain.trim()) {
                            setShowShopifyDomain(true);
                            return;
                          }
                          void connectIntegrationForPreview(integration.id);
                        }}
                        disabled={isDisabled}
                        aria-label={`Conectar ${integration.label}`}
                        className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-xl border border-separator bg-white px-2 py-3 text-sm font-medium transition hover:border-accent hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Image src={integration.src} alt={integration.alt} width={30} height={30} className="h-7 w-7 object-contain" />
                        <span>{authorizingIntegration === integration.id ? "Conectando…" : integration.label}</span>
                      </button>
                    );
                  })}
                </div>
                <details className="rounded-lg border border-separator px-3 py-2">
                  <summary className="cursor-pointer text-sm font-medium">Moneda y zona horaria</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Moneda"><Select value={currencyCode} onChange={setCurrencyCode} options={CURRENCY_OPTIONS} /></Field>
                    <Field label="Zona horaria"><Select value={timezone} onChange={setTimezone} options={TIMEZONE_OPTIONS} /></Field>
                  </div>
                </details>
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setStep(profileStep)}>Volver</Button>
                  <Button onClick={continueStoreProfile}>Continuar al cuestionario</Button>
                </div>
              </div>
            </Card>
          ) : step === importStep ? (
            <Card title="Preparando los datos de tu tienda" description="Revisamos las conexiones y mostramos el estado de la importación antes del cuestionario.">
              <div className="mt-4 flex items-center justify-between gap-4 text-sm">
                <span className="text-muted">
                  {connectedImportStates.length
                    ? `${connectedImportStates.filter((state) => state === "complete").length} de ${connectedImportStates.length} aplicaciones sincronizadas`
                    : "No hay aplicaciones conectadas en el destino seleccionado"}
                </span>
                <strong className="tabular-nums">{importProgressPercent}%</strong>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-separator"
                role="progressbar"
                aria-label="Progreso de importación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={importProgressPercent}
              >
                <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${importProgressPercent}%` }} />
              </div>
              <ul className="mt-5 divide-y divide-separator">
                {(["shopify", "meta", "klaviyo"] as const).map((integration) => {
                  const progress = integrationProgress[integration] ?? { state: "not_connected" as const, message: "Sin conexión en el destino seleccionado." };
                  const source = IMPORT_DATA_SOURCES.find((item) => item.id === integration)!;
                  const StatusIcon = progress.state === "complete" ? Check
                    : progress.state === "error" ? AlertCircle
                      : progress.state === "importing" || progress.state === "authorizing" ? LoaderCircle
                        : progress.state === "pending" ? CircleDashed : Store;
                  const statusLabel = progress.state === "complete" ? "Completada"
                    : progress.state === "error" ? "Error"
                      : progress.state === "importing" ? "Importando"
                        : progress.state === "authorizing" ? "Conectando"
                          : progress.state === "pending" ? "Pendiente" : "Sin conectar";
                  return (
                    <li key={integration} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                      <Image src={source.src!} alt="" width={28} height={28} className="mt-0.5 h-7 w-7 object-contain" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span>{source.name}</span>
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                            <StatusIcon size={14} aria-hidden className={progress.state === "importing" || progress.state === "authorizing" ? "animate-spin" : undefined} />
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{progress.message}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {isLoadingImportReview ? <p className="mt-4 text-sm text-muted" role="status">Consultando las integraciones…</p> : null}
              {importReviewError ? (
                <div className="mt-4 grid gap-2">
                  <ErrorBlock>{importReviewError}</ErrorBlock>
                  <Button variant="secondary" onClick={() => setImportReviewAttemptKey((current) => current + 1)}>Reintentar consulta</Button>
                </div>
              ) : null}
              {!testOrganizationId ? (
                <p className="mt-4 rounded-lg bg-surface-subtle px-3 py-2 text-sm text-muted">Elige un destino real de prueba en la configuración de arriba para consultar conexiones y datos importados.</p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setStep(storeStep)}>Volver a las conexiones</Button>
                <Button onClick={() => setStep(firstQuestionStep)}>Continuar con los datos disponibles</Button>
              </div>
            </Card>
          ) : currentQuestionCategory ? (
            <>
            <Card title="Datos que detectamos por aplicación" description="Pulsa una aplicación para ver qué información podrá aportar al análisis.">
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {IMPORT_DATA_SOURCES.map((source) => {
                  const isOpen = openImportSource === source.id;
                  const progress = source.id === "web" ? null : integrationProgress[source.id];
                  return (
                    <div key={source.id} className="rounded-xl border border-separator bg-white">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenImportSource(isOpen ? null : source.id)}
                        className="flex w-full items-center gap-3 p-3 text-left hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-subtle">
                          {source.src ? <Image src={source.src} alt="" width={26} height={26} className="h-6 w-6 object-contain" /> : <Store size={19} aria-hidden className="text-muted" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block text-sm">{source.name}</strong>
                          {source.id === "shopify" && importedRevenueLabel ? (
                            <span className="block text-xs text-muted">Últimos 30 días: {importedRevenueLabel}</span>
                          ) : progress?.state ? (
                            <span className="block text-xs text-muted">{progress.state === "complete" ? "Datos sincronizados" : progress.state === "error" ? "Revisar error de conexión" : progress.state === "not_connected" ? "Sin conectar" : "Importación en curso"}</span>
                          ) : null}
                        </span>
                        <Info size={16} aria-hidden className="shrink-0 text-muted" />
                      </button>
                      {isOpen ? (
                        <p role="note" className="border-t border-separator px-3 py-3 text-sm text-muted">{source.description}</p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card title={currentQuestionCategory.label} description="Solo pedimos estos datos si no aparecen tras la importación. Puedes dejar en blanco lo que E-NORA ya haya detectado.">
              <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted">
                <span>Cuestionario · {step - firstQuestionStep + 1} de {ONBOARDING_QUESTION_CATEGORIES.length}</span>
                <span>{completedAnswerCount}/{onboardingQuestions.length} respuestas</span>
              </div>
              <div className="grid gap-4">
                {currentQuestionCategory.questions.map(renderQuestion)}
                {error ? <ErrorBlock>{error}</ErrorBlock> : null}
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => moveQuestionnaire(-1)}>Volver</Button>
                  <Button onClick={() => moveQuestionnaire(1)}>
                    {step === firstQuestionStep + ONBOARDING_QUESTION_CATEGORIES.length - 1 ? "Completar onboarding" : "Siguiente bloque"}
                  </Button>
                </div>
              </div>
            </Card>
            </>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-5">
          <Card title="Resumen de la prueba" description="Revisa la información que habría recopilado este onboarding.">
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900">
              <Check size={18} aria-hidden />
              <span>Vista previa completada para {role === "consultant" ? "consultor" : "cliente"}. Las respuestas del cuestionario no se guardaron.</span>
            </div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ["Nombre personal", name],
                ["Organización", assignedOrganizationName],
                ["Tienda → organización", `${brandName} → ${assignedOrganizationName}`],
                ["Consultor", organizationMode === "consultant" ? consultantCodePreview?.consultant?.display_name || "Código de consultor" : "Alta directa"],
                ["Negocio o agencia", role === "consultant" ? businessName : "No aplica"],
                ["Tienda o marca", brandName],
                ["Web pública", websiteUrl],
                ["Moneda", currencyCode],
                ["Zona horaria", timezone],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-separator p-3">
                  <dt className="text-xs font-medium text-muted">{label}</dt>
                  <dd className="mt-1 break-words text-sm">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted">
              Cuestionario: {completedAnswerCount} de {onboardingQuestions.length} respuestas rellenadas.
              En el flujo real, cada tienda permanecerá asociada a su organización; el usuario podrá cambiar de organización cuando conecte otras tiendas.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => { setCompleted(false); setStep(firstQuestionStep + ONBOARDING_QUESTION_CATEGORIES.length - 1); }}>
                Revisar respuestas
              </Button>
              <Button variant="ghost" onClick={reset}><RotateCcw size={16} aria-hidden /> Probar otra vez</Button>
            </div>
          </Card>
          {ONBOARDING_QUESTION_CATEGORIES.map((category) => (
            <Card key={category.id} title={category.label}>
              <dl className="divide-y divide-separator">
                {category.questions.map((question) => (
                  <div key={question.id} className="py-3 first:pt-0 last:pb-0">
                    <dt className="text-sm font-medium">{question.question}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-muted">{answers[question.id]?.trim() || "Pendiente"}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminOnboardingPage() {
  return (
    <PlatformAdminShell title="Onboarding de prueba">
      {(bootstrap) => <OnboardingPreview bootstrap={bootstrap} />}
    </PlatformAdminShell>
  );
}

