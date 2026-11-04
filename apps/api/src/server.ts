import { internalSecretMatches } from "./internal-auth.js";
import { getAgentOutputDetail } from "./ai-output-detail.js";
import { registerOrgAccessGuard, registerOrganizationSettingsRoutes } from "./organization-settings.js";
import { registerConsultoraSettingsRoutes } from "./consultora-settings.js";
import { registerMeetingRoutes } from "./meetings.js";
import { installSupabaseReadRetry } from "./supabase-read-retry.js";
import { disconnectIntegration } from "./integration-disconnect.js";
import { createSingleFlight } from "./single-flight.js";
import { submitAgentJudgeFeedback } from "./agent-judge-feedback.js";
import { adjudicateAgentJudgeEvalCase, createAgentJudgeEvalCase, getAgentJudgeHoldoutState, listAgentJudgeEvalQueue, loadApprovedAgentJudgeHoldout, runAgentJudgeDatasetEvaluation, submitAgentJudgeEvalReview } from "./agent-judge-dataset.js";
import { createAgentReleaseEvalFixture, listAgentReleaseEvalFixtures, runAgentReleaseEvalAsPlatformAdmin } from "./agent-release-eval-fixtures.js";
// Una pasada global a la vez por proceso: si el cron se solapa, la segunda
// llamada se une a la que ya corre en vez de lanzar otra en paralelo.
const internalPass = createSingleFlight<unknown>();
import { pathToFileURL } from "node:url";
import { timingSafeEqual } from "node:crypto";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import {
  extractInternalPlaybookPdfText,
  MAX_INTERNAL_PLAYBOOK_PDF_BYTES,
} from "./marketing-playbook-pdf.js";
import { registerInternalMailingVisualImageBodyParser } from "./marketing-playbook-visual.js";
import { renderReportPdf } from "./report-pdf.js";
import { buildSampleReportDocument } from "./report-data.js";
import { listReportTemplates, resolveReportTemplateId } from "./report-templates.js";
import {
  createCopilotReportShareLink,
  emailCopilotReport,
} from "./copilot-report-sharing.js";
import { Redis } from "ioredis";
import {
  describeEnvironmentTargetRisk,
  loadApiEnv,
  shouldBlockOnEnvironmentRisk,
} from "@e-nora/config";
import {
  causalEdgeInputSchema,
  healthReferenceInputSchema,
  maturityDeclarationSchema,
  severityThresholdsSchema,
  interventionEffectTargetSchema,
  healthResponseSchema,
  readinessResponseSchema,
  type CopilotEvidenceReference,
  copilotEvidenceReferenceSchema,
  METRIC_SPECS,
} from "@e-nora/contracts";
import {
  createLogger,
  evaluateHttpSlo,
  redactSensitiveText,
} from "@e-nora/observability";
import { isIntegrationFeatureEnabled } from "@e-nora/integrations";
import { parseCaminoDurationMonths } from "@e-nora/ai";
import {
  getAdminModelPrices,
  runAdminModelPriceSync,
} from "./ai-model-pricing.js";
import {
  apiMetrics,
  beginApiHttpRequest,
  finishApiHttpRequest,
  recordApiHttpSample,
} from "./metrics.js";
import {
  createConsultantDecisionContextDeclaration,
  listConsultantDecisionContexts,
} from "./decision-context-api.js";
import { listConsultantTemporalUrgency } from "./temporal-urgency-api.js";
import { listConsultantDecisionImpact } from "./decision-impact-api.js";
import { listConsultantConstraints } from "./constraints-api.js";
import {
  listConsultantAllocation,
  listConsultantDecisionOutputs,
  listConsultantFeasibility,
  listConsultantPortfolio,
  listConsultantRanking,
  listConsultantRisk,
  listConsultantStrategicFit,
} from "./decision-blocks-api.js";
import { listConsultantPlaybookRuns } from "./playbook-api.js";
import { listConsultantAcquisitionRuns } from "./acquisition-api.js";
import { listConsultantPaidMediaRuns } from "./paid-media-api.js";
import { listConsultantConversionRuns } from "./conversion-api.js";
import { listConsultantOfferPricingRuns } from "./offer-pricing-api.js";
import { listConsultantRetentionCrmRuns } from "./retention-crm-api.js";
import { listConsultantUnitEconomicsRuns } from "./unit-economics-api.js";
import { listConsultantProductInventoryRuns } from "./product-inventory-api.js";
import { listConsultantOperationsCxRuns } from "./operations-cx-api.js";
import { listConsultantMeasurementExperimentationRuns } from "./measurement-experimentation-api.js";
import { listConsultantScalabilityRuns } from "./scalability-constraints-api.js";
import { listConsultantRecoveryCrisisRuns } from "./recovery-crisis-api.js";
import { listConsultantAiPlaybookInsights } from "./ai-playbook-insights-api.js";
import { listConsultantBenchmarkGuardrailsRuns } from "./benchmark-guardrails-api.js";
import { listConsultantCohortContextRuns } from "./cohort-context-api.js";
import { listConsultantDataQualityReliabilityRuns } from "./data-quality-reliability-api.js";
import { listConsultantAcquisitionDemandRuns } from "./acquisition-demand-api.js";
import { listConsultantPaidMediaBenchmarksRuns } from "./paid-media-benchmarks-api.js";
import { listConsultantConversionCroBenchmarksRuns } from "./conversion-cro-benchmarks-api.js";
import { listConsultantOfferPricingBenchmarksRuns } from "./offer-pricing-benchmarks-api.js";
import { listConsultantRetentionCrmBenchmarksRuns } from "./retention-crm-benchmarks-api.js";
import { listConsultantUnitEconomicsBenchmarksRuns } from "./unit-economics-benchmarks-api.js";
import { listConsultantOperationsCxBenchmarksRuns } from "./operations-cx-benchmarks-api.js";
import { listConsultantProductInventoryBenchmarksRuns } from "./product-inventory-benchmarks-api.js";
import { listConsultantScalabilityBenchmarksRuns } from "./scalability-benchmarks-api.js";
import { listConsultantAnomaliesRedFlagsRuns } from "./anomalies-red-flags-api.js";
import { listConsultantBenchmarkConfidenceRuns } from "./benchmark-confidence-api.js";
import { listConsultantInterventionEligibilityRuns } from "./intervention-eligibility-api.js";
import { listConsultantInterventionMatchingRuns } from "./intervention-matching-api.js";
import { listConsultantInterventionPrioritizationRuns } from "./intervention-prioritization-api.js";
import { listConsultantInterventionImpactRuns } from "./intervention-impact-api.js";
import { listConsultantInterventionFeasibilityRuns } from "./intervention-feasibility-api.js";
import { listConsultantInterventionRiskRuns } from "./intervention-risk-api.js";
import { listConsultantInterventionSequencingRuns } from "./intervention-sequencing-api.js";
import { listConsultantInterventionTestExecuteRuns } from "./intervention-test-execute-api.js";
import { listConsultantInterventionIntensityRuns } from "./intervention-intensity-api.js";
import { listConsultantMaturityRecommendationRuns } from "./maturity-recommendations-api.js";
import { listConsultantConstraintRecommendationRuns } from "./constraint-recommendations-api.js";
import { listConsultantRecommendationPortfolioRuns } from "./recommendation-portfolio-api.js";
import { listConsultantDynamicDecisionRuns } from "./dynamic-decision-api.js";
import { listConsultantRestraintDecisionRuns } from "./restraint-decision-api.js";
import { listConsultantExpectedOutcomeRuns } from "./expected-outcome-api.js";
import { listConsultantRecommendationConfidenceRuns } from "./recommendation-confidence-api.js";
import { listConsultantRecommendationCommunicationRuns } from "./recommendation-communication-api.js";
import {
  applyConsultantLifecycleCommand,
  listConsultantExecutionLifecycleStates,
  listConsultantExecutionLifecycleTransitions,
} from "./execution-lifecycle-api.js";
import { listConsultantHitlApprovalRuns } from "./hitl-approval-api.js";
import { listConsultantClosureHandoffRuns } from "./closure-handoff-api.js";
import { listConsultantExecutionPlans } from "./execution-plan-api.js";
import { listConsultantReadinessRuns } from "./readiness-api.js";
import { listConsultantActionEnvelopeRuns } from "./action-envelope-api.js";
import { listConsultantExecutionSupervisionRuns } from "./execution-supervision-api.js";
import { listConsultantContinuousLearningRuns } from "./continuous-learning-api.js";
import { listAccountActions } from "./actions.js";
import {
  addMarketingDraftNote,
  generateClientInviteCode,
  createClientOrganization,
  deleteConsultant,
  deleteOrganization,
  deleteOrganizationStore,
  getAdminObservability,
  getConsultantOverview,
  listConsultantAgenda,
  getOrganizationAccess,
  getClientAccess,
  inviteClientMember,
  revokeClientAccessInvite,
  setClientMemberRole,
  inviteConsultant,
  listAdminClients,
  getClientOverview,
  listConsultantCalls,
  listConsultantContextReadings,
  listConsultantMaturity,
  listConsultantCapabilityHealth,
  createConsultantHealthReference,
  declareConsultantCapabilityMaturity,
  listConsultantHealthReferences,
  retireConsultantHealthReference,
  createConsultantCausalEdge,
  listConsultantCausalPaths,
  listConsultantHypotheses,
  listConsultantRootCauses,
  listConsultantDiagnosticRobustness,
  listConsultantTemporalDiagnoses,
  listConsultantDiagnosticOutputs,
  listConsultantPrioritizationRuns,
  listConsultantConfidence,
  listConsultantSeverity,
  listConsultantSignals,
  listConsultantSymptomMap,
  listConsultantDataQuality,
  listConsultantIntegrations,
  listConsultantKnowledge,
  listConsultantMarketing,
  listConsultantMetaPortfolio,
  listConsultantMetaAccounts,
  listConsultantKlaviyoAccounts,
  listConsultantKlaviyoPortfolio,
  listConsultantOperations,
  listConsultantWork,
  listConsultantOrders,
  listConsultantProposedTasks,
  listConsultantOrganizations,
  listConsultantPlans,
  listConsultantStores,
  listMarketingDraftNotes,
  listAgentOutputNotes,
  addAgentOutputNote,
  listAgentEscalations,
  listAgentEscalationOwners,
  updateAgentEscalation,
  setMarketingDraftSchedule,
  listConsultants,
  createOwnStore,
  listOrganizationStores,
  hardDeleteOrganization,
  hardDeleteOrganizationStore,
  listOwnStoresOverview,
  pauseConsultantClient,
  previewClientInvite,
  redeemClientInvite,
  regenerateClientInvite,
  resendConsultantInvite,
  resumeConsultantClient,
  restoreOrganization,
  restoreOrganizationStore,
  updateConsultant,
  unlinkConsultantClient,
  upsertConsultantAssignment,
  upsertOrganizationMember,
  updateOrganization,
  getSeverityThresholds,
  setSeverityThresholds,
  listInterventionEffects,
  declareInterventionEffect,
  decideDiagnosticRevision,
} from "./consultant.js";
import { getConsultantProfitability } from "./consultant-profitability.js";
import { getConsultantCampaignsOverview } from "./consultant-campaigns.js";
import {
  addCampaignThreadNote,
  listCampaignThread,
  requestCampaignReview,
  resolveCampaignThreadNote,
  setCampaignReviewStatus,
} from "./campaign-review.js";
import {
  advanceMailingCampaignForDraft,
  decideFailedMailingEmail,
  getMailingCampaign,
  getMailingDelivery,
  listMailingDeliveryCandidates,
  linkMailingDelivery,
  isMailingGraphEnabled,
  resumeMailingCampaign,
  reviewMailingCampaignEmail,
  startMailingCampaign,
} from "./mailing-campaign.js";
import { applyCampaignEditProposal, proposeCampaignEdit } from "./campaign-ai-edit.js";
import { chatStudioEdit } from "./studio-ai-chat.js";
import { getAdminAiUsage } from "./ai-usage-admin.js";
import { getAdminAiCostModel, setAdminAiAgentSettings } from "./ai-cost-model.js";
import { getAdminAiModelLab } from "./ai-model-lab.js";
import { getAdminA06StockEvents, setAdminA06StockEventSettings, runA06StockEventTick } from "./a06-stock-events.js";
import {
  createQuickAction,
  deleteQuickAction,
  listQuickActions,
  reorderQuickActions,
  updateQuickAction,
  type QuickActionInput,
} from "./campaign-quick-actions.js";
import { runMaturityEngine } from "./maturity-engine.js";
import { runSeverityEngine } from "./severity-engine.js";
import { runInterventionEffectEngine } from "./intervention-effect-engine.js";
import { ingestPixelEvent, isPixelStoreId } from "./shopify-pixel.js";
import {
  declareChangeEvent,
  declareContextFact,
  deleteChangeEvent,
  getTenantContext,
} from "./tenant-context-api.js";
import {
  getDailyWorkbench,
  markClientReviewed,
} from "./consultant-workbench-api.js";
import {
  listClientMessageThreads,
  listThreadMessages,
  markThreadRead,
  postThreadMessage,
  uploadThreadAttachment,
} from "./consultant-messages.js";
import {
  isAuthContextError,
  isOperationalOrganizationError,
  requireOwnOrganizationAccess,
  resolveAuthContext,
  type AuthContext,
  type AuthContextError,
} from "./auth-context.js";
import { runWithRequestCorrelation } from "./request-context.js";
import { listOrganizationDataQuality } from "./data-quality.js";
import { listIntegrations } from "./integrations.js";
import {
  createShopifyConnectionAuthUrl,
  handleShopifyOAuthCallback,
  triggerShopifySync,
} from "./shopify.js";
import {
  getShopifyConnections,
  getShopifyOverview,
} from "./shopify-overview.js";
import {
  getShopifyCatalogDiscount,
  getShopifyCatalogProduct,
  listShopifyInventory,
  listShopifyCatalogDiscounts,
  listShopifyCatalogProducts,
} from "./shopify-catalog.js";
import {
  approveAndApplyShopifyDiscountProposal,
  createShopifyDiscountProposal,
  listShopifyDiscountProposals,
} from "./shopify-discount-proposals.js";
import { getShopifyMetrics } from "./shopify-metrics.js";
import { getShopifyToday } from "./shopify-today.js";
import { getStockForecast } from "./stock-forecast.js";
import { createMetricActionTask, recordMetricAnalysisFeedback } from "./metric-actions.js";
import { getMetricAnalysis } from "./metric-analysis.js";

// A29: periodo de la explicacion (mismo rango que /metric-analysis) y cada cuanto se puede
// volver a pedir. Rafa (2026-10-16): una hora; antes, abrir la metrica devuelve la guardada.
const METRIC_EXPLANATION_FRESH_MS = 60 * 60 * 1000;
// El cliente solo ve lo que le toca hacer a él; las acciones del consultor son para el consultor.
const withRenewal = <T extends { generated_at: string; output?: unknown }>(data: T, context: AuthContext) => {
  const isConsultant = ["platform_admin", "consultant"].includes(context.profile.platform_role);
  const output = data.output as { recommendations?: Array<{ owner?: string }> } | null | undefined;
  return {
    ...data,
    ...(isConsultant || !output?.recommendations
      ? {}
      : { output: { ...output, recommendations: output.recommendations.filter((r) => r.owner !== "consultor") } }),
    renews_at: new Date(new Date(data.generated_at).getTime() + METRIC_EXPLANATION_FRESH_MS).toISOString(),
  };
};
const metricExplanationDays = (input: string | undefined) => {
  const n = Math.floor(Number(input));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 30;
};
import { getShopifyInsights } from "./shopify-insights.js";
import { getMetaInsights } from "./meta-insights.js";
import { getMetaCampaignDetail, listMetaCampaigns } from "./meta-campaigns.js";
import { listMetaCreativeLibrary } from "./meta-creative-library.js";
import { getKlaviyoInsights } from "./klaviyo-insights.js";
import { getKlaviyoEmailDetail, listKlaviyoEmails } from "./klaviyo-emails.js";
import {
  handleShopifyWebhookRequest,
} from "./shopify-webhook-handler.js";
import { handleFathomWebhookRequest } from "./fathom-webhook-handler.js";
import { ensureOwnOrganization } from "./registro.js";
import {
  actualizarPlazas,
  actualizarSolicitud,
  aprobarSolicitud,
  crearSolicitud,
  declararCliente,
  invitarAprobadas,
  invitarSolicitud,
  listarDeclarados,
  listarSolicitudes,
  recomprobarTienda,
} from "./solicitudes.js";
import {
  createMyReferralCode,
  getMyReferralProgram,
  getPublicReferralCode,
  listConsultantReferralsAdmin,
  listReferralProgramAdmin,
  revokeReferralConsent,
  setMyReferralCodeActive,
  setReferralContacted,
  upsertReferralCodeAdmin,
} from "./referidos.js";
import {
  grantSubscription,
  getPlatformFinancialDashboard,
  listPlans,
  listPlatformSubscriptions,
  revokeSubscription,
  type GrantInput,
} from "./billing.js";
import { getToolCatalog } from "./tool-catalog.js";
import { decideCapabilityProposal, listCapabilityProposals } from "./capability-proposals.js";
import {
  getPlatformBillingSettings,
  getPlatformInvoice,
  listPlatformInvoices,
  retryInvoiceVerifactu,
  sendInvoiceEmailForInvoice,
  upsertPlatformBillingSettings,
} from "./invoicing.js";
import {
  archivePlatformExpense,
  createPlatformExpense,
  listPlatformExpenses,
  updatePlatformExpense,
  type PlatformExpenseInput,
} from "./platform-finance.js";
import type { StandardWebhookHeaders } from "./standard-webhook.js";
import { processQueuedFathomWebhookEvents } from "./fathom-webhook-handler.js";
import type { FathomWebhookHeaders } from "./fathom-webhook.js";
import { reconcileAllShopifyConnections } from "./shopify-reconcile.js";
import { purgeProcessedWebhookEvents } from "./webhook-retention.js";
import { handleKlaviyoWebhookRequest } from "./klaviyo-webhooks.js";
import { purgeExpiredAiContext } from "./ai-context-retention.js";
import { exportOrganizationData } from "./organization-export.js";
import {
  listProductCosts,
  upsertProductCost,
  importProductCosts,
} from "./shopify-product-costs.js";
import {
  createFixedExpense,
  createShippingRule,
  deactivateFixedExpense,
  deactivateShippingRule,
  getFinancialConfig,
  upsertFinancialSettings,
} from "./financial-config.js";
import {
  createMetaConnectionAuthUrl,
  handleMetaOAuthCallback,
  listMetaAssets,
  listMetaPurchaseActionTypes,
  selectMetaPurchaseActionType,
  triggerMetaSync,
  updateMetaAssetSelection,
} from "./meta.js";
import {
  assignStoreScope,
  listStoreScope,
  type StoreScopeInput,
} from "./store-scope.js";
import {
  connectKlaviyoWithApiKey,
  createKlaviyoConnectionAuthUrl,
  getKlaviyoEmailReport,
  handleKlaviyoOAuthCallback,
  importKlaviyoTemplate,
  listKlaviyoConversionMetrics,
  listKlaviyoTemplates,
  previewKlaviyoTemplate,
  pushDraftToKlaviyoTemplate,
  selectKlaviyoConversionMetric,
  triggerKlaviyoSync,
} from "./klaviyo.js";
import {
  cancelMarketingKlaviyoCampaign,
  getMarketingKlaviyoCampaignClicks,
  getMarketingKlaviyoTemplateHtml,
  getMarketingKlaviyoWorkspace,
  scheduleMarketingKlaviyoCampaign,
  type ScheduleCampaignInput,
} from "./marketing-klaviyo.js";
import {
  createStudioDraft,
  listStudioProducts,
  sendStudioTest,
  updateStudioDraft,
} from "./marketing-studio.js";
import {
  deleteFlowDesign,
  listFlowDesigns,
  previewFlowDesign,
  pushFlowDesign,
  saveFlowDesign,
} from "./marketing-flows.js";
import { listKlaviyoReports, runKlaviyoReport } from "./klaviyo-sync.js";
import { getMetaMetrics } from "./meta-metrics.js";
import { prepareMetaAdCreationPlan } from "./meta-ad-write-plan.js";
import {
  addTaskComment,
  createTask,
  evaluateAlertRules,
  listTaskAssignees,
  listOperations,
  runAlertRulesForAllOrganizations,
  updateAlertStatus,
  updateTaskAssignment,
  updateTaskStatus,
} from "./operations.js";
import { archiveZoneNote, createZoneNote, listZoneNotes, markZoneNoteSeen } from "./zone-notes.js";
import { listAlertRules, upsertAlertRule } from "./alert-rules.js";
import { deleteReportSchedule, generatePortfolioReport, generateReportOnDemand, listReports, upsertReportSchedule } from "./reports-api.js";
import {
  getAuditLog,
  getPlatformErrors,
  retryPlatformSyncError,
} from "./platform-logs.js";
import {
  getPlatformHealth,
  monitorPlatformHealth,
  recordExternalProbe,
  recordPlatformUserHeartbeat,
  submitPlatformHealthFeedback,
  updatePlatformHealthFeedbackStatus,
} from "./platform-health.js";
import { getClientConsultant } from "./client-autonomy.js";
import {
  listConsultantPartners,
  addConsultantPartner,
  removeConsultantPartner,
} from "./consultant-partners.js";
import { listWorkSplit, updateWorkSplit } from "./work-split.js";
import {
  createCampaignCalendar,
  createCampaignCalendarItem,
  createCampaignItemsFromProposal,
  rejectCampaignPlanProposal,
  archiveCampaignCalendarItem,
  listCampaignPlanning,
  listCampaignPlanningResources,
  listKpiSnapshots,
  listCampaignPlanningAttention,
  updateCampaignCalendarExecution,
  recordCampaignOutcomeVerdict,
  updateCampaignCalendarItem,
  upsertKpiSnapshot,
} from "./campaign-planning.js";
import { getConsultora } from "./capacidad-cartera.js";
import {
  decideAgentOutput,
  createServiceClient,
  type ProposedWriteEdit,
  getConsultantChatMessages,
  getEmailAnalystDiagnostic,
  getMetricAnalystExplanation,
  runMetricAnalystAgent,
  getKlaviyoFlowArchitectDiagnostic,
  getMonitorDiagnostic,
  isMonitorDashboardScope,
  getKnowledgeManagerDiagnostic,
  getOperativaShopifyDiagnostic,
  getRetencionClientesDiagnostic,
  getAdquisicionShopifyDiagnostic,
  getPostventaShopifyDiagnostic,
  getCreatividadMetaDiagnostic,
  runCreatividadMetaAgent,
  getMedicionMetaDiagnostic,
  runMedicionMetaAgent,
  getCambiosMetaDiagnostic,
  getContenidoEmailDiagnostic,
  runContenidoEmailAgent,
  runCambiosMetaAgent,
  runRetencionClientesAgent,
  runAdquisicionShopifyAgent,
  runPostventaShopifyAgent,
  getOperativaMetaDiagnostic,
  getStockPlannerDiagnostic,
  getTaskPlannerDiagnostic,
  getPlanDiagnostic,
  runPlanAgent,
  isPlanHorizon,
  listAgentRuns,
  getAgentRunTrace,
  getA26EmailRenderCapture,
  getOrganizationDailyBudgetStatusForOrganization,
  listMarketingContentDrafts,
  listMarketingDraftPage,
  getMarketingGenerationStatus,
  listMarketingTemplatePage,
  getMarketingBrandProfile,
  saveMarketingBrandProfile,
  listInternalMailingPlaybook,
  previewInternalMailingPlaybook,
  getInternalMailingPlaybookEntry,
  saveInternalMailingPlaybookDraft,
  setInternalMailingPlaybookStatus,
  listMarketingContentDraftVersions,
  updateMarketingContentDraft,
  decideMarketingContentDraft,
  runMarketingContentDraft,
  recordA26ReviewOutcome,
  runWeeklyMailingPlanner,
  getWeeklyMailingPlanSequence,
  listWeeklyMailingPlanSequences,
  updateWeeklyMailingPlanSequenceStatus,
  analyzeInternalMailingVisualReference,
  saveManualMarketingDraft,
  submitMarketingContentDraft,
  uploadMarketingAsset,
  listConsultantChatConversations,
  submitConsultantChatFeedback,
  runCallAnalyst,
  getDiagnosticOrchestratorObservability,
  getAdminAiAgentRefreshLimits,
  setAdminAiAgentRefreshLimit,
  getAdminClientAgentRuntimeConfig,
  setAdminClientAgentRuntimeConfig,
  runConsultantChatTurn,
  runDiagnosticOrchestratorTick,
  runEmailAnalystAgent,
  runKlaviyoFlowArchitectAgent,
  runKnowledgeManagerAgent,
  runOperativaShopifyAgent,
  runOperativaMetaAgent,
  runStockPlannerAgent,
  runTaskPlannerAgent,
  runCaminoArchitectAgent,
  retryCaminoWeeklyReviewAgent,
  runCampaignStrategist,
  getCampaignPlanProposal,
  isCampaignPlanHorizon,
  getCaminoProposal,
  getCaminoProposalProgress,
  startCaminoProposalRun,
  type ConsultantChatViewContext,
  describeProviderRedundancy,
  isAgentAutorunEnabled,
} from "./ai-runtime.js";
import { processAgentJudgeQueue } from "./agent-judge-runtime.js";
import { getCopilotBalance } from "./copilot-saldo.js";
import { createStripeCheckout } from "./stripe-checkout.js";
import { createBillingPortal, getOrganizationBilling } from "./billing-overview.js";
import { handleStripeWebhookRequest } from "./stripe-webhook-handler.js";
import type { StripeWebhookHeaders } from "./stripe-webhook.js";
import {
  enqueueInstagramImage,
  listInstagramImageBank,
  getInstagramImagePreview,
  listVisualAssetStores,
  listMetaVisualImageCandidates,
  importMetaVisualImage,
  importMetaVideoFrames,
  updateInstagramImageMarkdown,
  retryInstagramImage,
  reindexInstagramImage,
  deleteInstagramImage,
  processInstagramImageQueue,
  listInstagramOverlays,
  createInstagramOverlay,
  updateInstagramOverlay,
  deleteInstagramOverlay,
  draftInstagramOverlayText,
  generatePublicationCaption,
} from "./instagram-image-bank.js";
import { getAgentEvalReadiness } from "./agent-eval-readiness.js";
import {
  evaluateAgentReleaseCandidateOffline,
  listAgentReleaseCandidates,
  promoteAgentReleaseCandidate,
} from "./agent-release-admin.js";
import {
  createKnowledgeDocument,
  updateKnowledgeDocument,
  listKnowledgeDocuments,
  getKnowledgeDocument,
  searchKnowledge,
} from "./knowledge.js";
import { approveCaminoReviewLearning, assessCaminoIntake, getCaminoIntakeContext, saveCaminoIntakeContext } from "./camino-intake.js";
import {
  listClientConstraints,
  createClientConstraint,
  updateClientConstraint,
} from "./client-constraints.js";
import {
  addInternalNote,
  createCall,
  createSummary,
  createTaskFromCall,
  decideSummary,
  listCalls,
  saveTranscript,
  updateCall,
} from "./calls.js";
import {
  listNotifications,
  markAllNotificationsRead,
  updateNotificationStatus,
  type NotificationListQuery,
} from "./notifications.js";
import {
  activateStrategicPlan,
  updatePlanCurrency,
  addMilestoneInternalNote,
  getMilestoneInternalNotes,
  getObjectives,
  createObjective,
  deactivateObjective,
  setObjectiveActual,
  updatePlanGoalTarget,
  listObjectiveDefinitions,
  createObjectiveDefinition,
  updateObjectiveDefinition,
  archiveObjectiveDefinition,
  assertCanManagePlan,
  createMilestone,
  createMilestoneTask,
  createPhase,
  createStrategicPlan,
  createStrategicPlanFromMarkdown,
  createStrategicPlanFromProposal,
  deleteMilestone,
  deletePhase,
  deleteStrategicPlan,
  getStrategicPlan,
  linkTaskToMilestone,
  reorderMilestones,
  reorderPhases,
  recordCaminoChangeProposalAction,
  updateMilestone,
  updateMilestoneTask,
  unlinkMilestoneTask,
  updateMilestoneStatus,
  updateStrategicPlan,
  updatePhase,
  previewStrategicPlanMarkdown,
  getCaminoRoutes,
  archiveStrategicPlan,
  rejectCaminoProposalOutput,
} from "./strategic-plans.js";

const logger = createLogger("api");

export function sendAuthFailure(
  reply: {
    code: (statusCode: number) => { send: (payload: unknown) => unknown };
  },
  error: AuthContextError,
) {
  if (error.statusCode >= 500 && error.detail) {
    logger.error("auth_context_failed", {
      statusCode: error.statusCode,
      error: error.error,
      detail: redactFailureDetail(error.detail),
    });

    const { detail: _internalDetail, ...publicError } = error;
    return reply.code(error.statusCode).send(publicError);
  }

  return reply.code(error.statusCode).send(error);
}

type ServiceFailure = {
  ok: false;
  statusCode: number;
  [key: string]: unknown;
};

export const redactFailureDetail = redactSensitiveText;

const READINESS_CHECK_TIMEOUT_MS = 3_000;

// BE-00: check real de dependencias (no un ping simulado). GoTrue expone
// /auth/v1/health sin tocar ninguna tabla de negocio ni RLS -- confirma que
// Supabase responde, no si un query de negocio funcionaria. Redis solo se
// comprueba si REDIS_URL esta configurado (en dev local el rate limit usa un
// store en memoria, ver registro de @fastify/rate-limit arriba).
async function checkReadiness(env: ReturnType<typeof loadApiEnv>) {
  const checks = {
    supabase: "error" as "ok" | "error" | "not_configured",
    redis: "not_configured" as "ok" | "error" | "not_configured",
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      READINESS_CHECK_TIMEOUT_MS,
    );
    try {
      const response = await fetch(`${env.SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY },
        signal: controller.signal,
      });
      checks.supabase = response.ok ? "ok" : "error";
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    checks.supabase = "error";
  }

  if (env.REDIS_URL) {
    const client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: READINESS_CHECK_TIMEOUT_MS,
      lazyConnect: true,
    });

    try {
      await client.connect();
      await client.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    } finally {
      client.disconnect();
    }
  }

  return checks;
}

// SQO-02: extrae el `sub` (user id) del JWT sin verificar su firma -- solo
// para enriquecer logs, nunca para decisiones de autorizacion (eso lo sigue
// haciendo `resolveAuthContext` en cada handler, que si verifica contra
// Supabase). Un token invalido o forjado en este punto solo puede ensuciar
// una linea de log con un user_id que no se usa para nada mas; la request en
// si sigue siendo rechazada normalmente donde corresponda.
function decodeJwtSubject(
  authorizationHeader: string | undefined,
): string | undefined {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = authorizationHeader.slice("Bearer ".length);
  const parts = token.split(".");

  if (parts.length !== 3 || !parts[1]) {
    return undefined;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as { sub?: unknown };
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

function isServiceFailure(result: { ok: boolean }): result is ServiceFailure {
  return result.ok === false;
}

export function sendServiceFailure(
  reply: {
    code: (statusCode: number) => { send: (payload: unknown) => unknown };
  },
  result: unknown,
) {
  const failure = result as ServiceFailure;

  // No expongas mensajes de Supabase, SQL ni proveedores externos al cliente.
  // Muchos servicios construyen `detail` desde `error.message`; devolverlo en
  // una respuesta 5xx filtra nombres de tablas, restricciones y detalles de
  // infraestructura. Se conserva en logs para diagnóstico operativo.
  if (failure.statusCode >= 500 && typeof failure.detail === "string") {
    logger.error("service_request_failed", {
      statusCode: failure.statusCode,
      error: failure.error,
      detail: redactFailureDetail(failure.detail),
    });

    const { detail: _internalDetail, ...publicFailure } = failure;
    return reply.code(failure.statusCode).send(publicFailure);
  }

  return reply.code(failure.statusCode).send(failure);
}

export async function buildApp(): Promise<FastifyInstance> {
  const env = loadApiEnv(process.env);
  // Tope de espera + 1 reintento en lecturas REST (parones de Supabase TEST).
  // Solo en desarrollo por defecto; SUPABASE_READ_TIMEOUT_MS=0 lo apaga.
  installSupabaseReadRetry(
    env.SUPABASE_URL,
    Number(process.env.SUPABASE_READ_TIMEOUT_MS ?? (process.env.NODE_ENV === "production" ? 0 : 8000)),
  );
  // Test y produccion separados (Shopify, datos protegidos Nivel 2). Avisa
  // siempre; solo mata el proceso con SUPABASE_ENV_GUARD=block.
  const environmentRisk = describeEnvironmentTargetRisk(process.env);
  if (environmentRisk) {
    if (shouldBlockOnEnvironmentRisk(process.env)) {
      throw new Error(`entorno_cruzado: ${environmentRisk}`);
    }
    console.warn(`entorno_cruzado: ${environmentRisk}`);
  }
  const app = Fastify({
    // SQO-00/SQO-02 (R-014): Fastify ya trae pino y ya no logea headers por
    // defecto (verificado), pero cualquier log futuro que incluya
    // request.headers/body a mano no deberia poder filtrar secretos -- estas
    // rutas se redactan pase lo que pase, en logs de request y en cualquier
    // objeto logueado con esta forma.
    logger: {
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "req.headers['x-internal-secret']",
          "headers.authorization",
          "headers.cookie",
          "*.access_token",
          "*.refresh_token",
          "*.client_secret",
          "*.api_key",
          "*.service_role_key",
        ],
        censor: "[REDACTED]",
      },
    },
    genReqId: (request) =>
      request.headers["x-request-id"]?.toString() ?? crypto.randomUUID(),
  });

  app.addContentTypeParser(
    "application/pdf",
    { parseAs: "buffer" },
    (_request, body, done) => done(null, body),
  );

  // Un cuerpo JSON vacío (p. ej. un DELETE que manda Content-Type: application/json sin cuerpo, como hace el cliente
  // móvil de forma genérica) no es un error: se lee como «sin cuerpo». El resto se parsea con el parser por defecto de
  // Fastify, que conserva la protección contra __proto__ y constructor.
  const parseJsonBody = app.getDefaultJsonParser("error", "error");
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    if (typeof body === "string" && body.trim() === "") return done(null, undefined);
    parseJsonBody(request, body as string, done);
  });
  registerInternalMailingVisualImageBodyParser(app);

  await app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    // SQO-02: sin exponerla, el navegador no puede leer `x-request-id` en una
    // respuesta cross-origin, asi que la cabecera solo servia si ya estabas
    // mirando los logs del servidor -- justo lo contrario de lo que hace falta
    // cuando un cliente reporta un error y hay que encontrarlo.
    exposedHeaders: ["x-request-id"],
    // Sin esto el navegador manda un OPTIONS de preflight ANTES DE CADA
    // peticion: el trafico real se duplica y, como el preflight no lleva
    // `Authorization`, el limitador no puede trocearlo por usuario. Con la
    // cache, el permiso se pregunta una vez y vale para el resto. Cada
    // navegador la recorta a su maximo (Chrome 2 h, Firefox 24 h).
    maxAge: 86_400,
  });

  // SQO-00: cabeceras de seguridad. API pura JSON (nunca sirve HTML), asi que
  // desactivamos la CSP de helmet (pensada para paginas) y dejamos el resto
  // de cabeceras por defecto (X-Content-Type-Options, X-Frame-Options,
  // Referrer-Policy, HSTS, etc.).
  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  // SQO-00 (gap real: "sin rate limiting a nivel de endpoint"). Limite
  // global generoso como red de seguridad basica, mas limites estrictos por
  // organizacion en los endpoints de IA (los caros de verdad, ver AI-00
  // budget por run -- esto limita frecuencia, no coste por run). `skipOnError`
  // evita que un fallo del store de rate limit tumbe la API entera.
  // Store en Redis si `REDIS_URL` esta configurado (necesario en serverless,
  // donde el estado en memoria no persiste entre invocaciones); en memoria
  // como fallback para desarrollo local.
  // @fastify/rate-limit no cierra un cliente de Redis que le pasamos nosotros
  // (asume que lo administramos externamente) -- sin este hook, `app.close()`
  // deja la conexion abierta y el proceso nunca termina limpio ante SIGTERM
  // (encontrado escribiendo be-01-cross-tenant-route-manipulation.test.ts:
  // el test colgaba indefinidamente en el cleanup, no en las aserciones).
  // `retryStrategy: () => null` (2026-07-29, mismo hallazgo repetido en la
  // misma suite): sin esto, si `.disconnect()` corre mientras la conexion
  // inicial todavia se esta estableciendo, ioredis puede dejar programado un
  // reintento de reconexion que abre un socket nuevo *despues* del
  // disconnect() -- confirmado con diagnostico real (`process._getActiveHandles()`
  // mostraba 2 sockets huerfanos tras `app.close()` incluso sin ninguna
  // request de por medio). Mismo patron que ya usaba `redis-cache.ts`.
  const rateLimitRedis = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        retryStrategy: () => null,
      })
    : undefined;

  if (rateLimitRedis) {
    // ioredis emits connection failures asynchronously. Register the listener
    // immediately so a missing/unreachable Redis in local CI never becomes an
    // unhandled error event; @fastify/rate-limit will use its configured
    // skipOnError fallback for the request.
    rateLimitRedis.on("error", (error: Error) => {
      logger.error("rate_limit_redis_unavailable_using_fallback", error);
    });
    app.addHook("onClose", async () => {
      rateLimitRedis.disconnect();
    });
  }

  // La clave por defecto de @fastify/rate-limit es la IP. Eso rompe en los dos
  // entornos que importan: en local todo (navegador, worker, SSR) sale de
  // 127.0.0.1 y comparte un unico cubo de 120/min -- una sesion normal del
  // portal lo agotaba y a partir de ahi TODA la app respondia 429; en
  // produccion, detras de Caddy y sin `trustProxy`, request.ip es la IP interna
  // del proxy, o sea que todos los clientes compartirian ese mismo cubo. Se
  // limita por usuario autenticado (sub del JWT, decodificado sin verificar --
  // sirve para trocear el cubo, no para autorizar) y solo se cae a la IP en las
  // rutas sin sesion (login, invitaciones, webhooks). El worker se salta el
  // limite: no es trafico de usuario y ya va autenticado por secreto interno.
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
    skipOnError: true,
    redis: rateLimitRedis,
    keyGenerator: (request: FastifyRequest) =>
      decodeJwtSubject(request.headers.authorization) ?? request.ip,
    // `INTERNAL_API_SECRET` es opcional en la config: sin este `Boolean(...)`,
    // cuando no esta puesto `undefined === undefined` seria true y el limite
    // quedaria desactivado para todo el mundo.
    allowList: (request: FastifyRequest) =>
      // El preflight CORS no llega a ningun handler y no lleva
      // `Authorization`, asi que `keyGenerator` caia a la IP: en local todas
      // las pestanas compartian ese cubo y, detras del proxy, lo compartirian
      // todos los clientes. Contar preflights ademas gastaba el limite por
      // duplicado sin que hubiera una sola peticion real de mas.
      request.method === "OPTIONS" ||
      internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET),
  });

  const aiEndpointRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request: { params: unknown; ip: string }) =>
          (request.params as { organizationId?: string } | undefined)
            ?.organizationId ?? request.ip,
      },
    },
  };

  const inviteRedeemRateLimit = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: (request: { ip: string }) => request.ip,
      },
    },
  };

  // SQO-02 (R-014): la mayoria de rutas (62 de las de abajo) llevan
  // `:organizationId` en el path. Sin esto, diagnosticar "los pedidos de esta
  // organizacion no aparecen" exigia leer codigo y consultar la DB a mano --
  // los logs JSON de pino no tenian forma de filtrar por organizacion. Un
  // child logger con `organization_id` fijado aqui (route params ya estan
  // parseados en `onRequest`) hace que todo log posterior de la misma
  // request (incluido el log automatico de fin de request de Fastify) lo
  // incluya, sin tocar cada handler uno a uno. `user_id` (2026-07-23) se
  // extrae del JWT sin verificar -- solo para poder filtrar logs por usuario,
  // no como decision de autorizacion.
  // AI-30: mete el resto de la peticion dentro del AsyncLocalStorage de
  // correlacion, para que el runtime de IA pueda poner el mismo request id en
  // `agent_runs.trace_id` sin que haya que pasarlo por la firma de cada agente.
  // Tiene que ser el hook de estilo callback: con `async` el contexto se
  // cerraria al volver del hook y no cubriria al handler.
  app.addHook("onRequest", (request, _reply, done) => {
    beginApiHttpRequest();
    runWithRequestCorrelation({ requestId: String(request.id) }, done);
  });

  app.addHook("onRequest", async (request, reply) => {
    // SQO-02: permite correlacionar el error que ve el cliente con los logs
    // JSON de Fastify sin incluir datos de negocio en la respuesta.
    reply.header("x-request-id", request.id);

    const organizationId = (
      request.params as { organizationId?: string } | undefined
    )?.organizationId;
    const userId = decodeJwtSubject(request.headers.authorization);
    const bindings: Record<string, string> = {};

    if (organizationId) {
      bindings.organization_id = organizationId;
    }
    if (userId) {
      bindings.user_id = userId;
    }

    if (Object.keys(bindings).length > 0) {
      request.log = request.log.child(bindings);
    }
  });

  // INT-00: el allowlist de integraciones es una guarda de runtime, no solo
  // una señal visual del catálogo. Mantenerla aquí evita que un cliente llame
  // directamente a OAuth/sync/metrics cuando el proveedor está desactivado.
  app.addHook("onRequest", async (request, reply) => {
    const path = (request.url ?? "").split("?")[0] ?? "";
    const provider = path.includes("/meta/")
      ? "meta_ads"
      : path.includes("/klaviyo/")
        ? "klaviyo"
        : null;
    if (
      provider &&
      !isIntegrationFeatureEnabled(provider, env.INTEGRATION_FEATURE_FLAGS)
    ) {
      return reply.code(404).send({
        error: "integration_feature_disabled",
        provider,
      });
    }
  });

  // Solo lectura, permisos del consultor y 2FA obligatoria, en un solo sitio.
  registerOrgAccessGuard(app, env);
  registerOrganizationSettingsRoutes(app, env, { sendAuthFailure, sendServiceFailure });
  registerConsultoraSettingsRoutes(app, env, { sendAuthFailure, sendServiceFailure });
  registerMeetingRoutes(app, env, { sendAuthFailure, sendServiceFailure });

  // El "request completed" automatico de Fastify usa el logger capturado al
  // crear la request, antes de que corra el onRequest de arriba -- nunca
  // lleva organization_id/user_id aunque el resto de logs de la misma
  // request si (confirmado en vivo con app.inject). Este resumen explicito
  // en onResponse si usa el logger ya enriquecido, para que exista al menos
  // una linea por request filtrable por organizacion o usuario sin tener que
  // buscar en logs internos.
  app.addHook("onResponse", async (request, reply) => {
    const route =
      request.routeOptions.url ?? request.url.split("?")[0] ?? "unknown";
    apiMetrics.increment("http_requests_total", {
      method: request.method,
      route,
      status_code: reply.statusCode,
    });
    apiMetrics.observe(
      "http_request_duration_ms",
      {
        method: request.method,
        route,
        status_code: reply.statusCode,
      },
      reply.elapsedTime,
      [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000],
    );
    recordApiHttpSample(reply.statusCode, reply.elapsedTime, route);
    finishApiHttpRequest();

    const organizationId = (
      request.params as { organizationId?: string } | undefined
    )?.organizationId;
    const userId = decodeJwtSubject(request.headers.authorization);

    if (organizationId || userId) {
      request.log.info(
        { statusCode: reply.statusCode, responseTimeMs: reply.elapsedTime },
        "request_completed_with_org",
      );
    }
  });

  // BE-00: /health (y su alias /health/live) es liveness -- responde "ok" en
  // cuanto el proceso esta arriba, sin tocar dependencias. Es lo que decide
  // si un orquestador debe reiniciar el contenedor: si el proceso puede
  // responder HTTP, reiniciarlo no arreglaria nada. Se mantiene sin cambios
  // de comportamiento porque el HEALTHCHECK de apps/api/Dockerfile ya
  // apunta aqui.
  app.get("/health", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/health/live", async () =>
    healthResponseSchema.parse({
      status: "ok",
      service: "api",
      timestamp: new Date().toISOString(),
    }),
  );

  app.get("/health/metrics", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    return reply
      .type("text/plain; version=0.0.4; charset=utf-8")
      .send(`${apiMetrics.toPrometheus()}\n`);
  });

  app.get("/health/slo", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    return evaluateHttpSlo(apiMetrics.snapshot());
  });

  app.post<{
    Body: {
      ok?: unknown;
      checked_at?: unknown;
      latency_ms?: unknown;
      dns_ok?: unknown;
      tls_days_remaining?: unknown;
      http_status?: unknown;
    };
  }>("/health/external-probe", async (request, reply) => {
    const expectedToken = process.env.PLATFORM_MONITOR_TOKEN;
    const providedToken = request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
    const expectedBytes = Buffer.from(expectedToken ?? "");
    const providedBytes = Buffer.from(providedToken);
    if (
      !expectedToken ||
      expectedBytes.length !== providedBytes.length ||
      !timingSafeEqual(expectedBytes, providedBytes)
    ) return reply.code(401).send({ error: "invalid_monitor_token" });

    const body = request.body;
    if (
      typeof body.ok !== "boolean" ||
      typeof body.dns_ok !== "boolean" ||
      typeof body.checked_at !== "string" ||
      !Number.isFinite(Date.parse(body.checked_at)) ||
      (body.latency_ms != null && (typeof body.latency_ms !== "number" || body.latency_ms < 0)) ||
      (body.tls_days_remaining != null && typeof body.tls_days_remaining !== "number") ||
      (body.http_status != null && typeof body.http_status !== "number")
    ) return reply.code(400).send({ error: "invalid_probe_payload" });
    const saved = await recordExternalProbe(env, {
      ok: body.ok,
      checked_at: new Date(body.checked_at).toISOString(),
      latency_ms: body.latency_ms as number | null ?? null,
      dns_ok: body.dns_ok,
      tls_days_remaining: body.tls_days_remaining as number | null ?? null,
      http_status: body.http_status as number | null ?? null,
    });
    return saved ? { ok: true } : reply.code(503).send({ error: "probe_store_unavailable" });
  });

  // Readiness: puede el proceso servir trafico de verdad ahora mismo. A
  // diferencia de liveness, esto si toca dependencias externas y puede
  // fallar sin que el proceso este roto (Supabase caido, Redis caido) --
  // es la senal que decide si un balanceador debe sacar esta instancia del
  // pool, no si debe reiniciarla.
  app.get("/health/ready", async (_request, reply) => {
    const checks = await checkReadiness(env);
    const degraded = checks.supabase !== "ok" || checks.redis === "error";

    if (degraded) {
      reply.code(503);
    }

    return readinessResponseSchema.parse({
      status: degraded ? "degraded" : "ok",
      service: "api",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  app.get("/v1/bootstrap", async (request, reply) => {
    const result = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(result)) {
      return sendAuthFailure(reply, result.error);
    }

    return {
      ...result.context,
      memberships: [
        ...result.context.memberships,
        ...(result.context.storeMemberships ?? []),
      ].sort((a, b) =>
        (a.organization?.display_name ?? "").localeCompare(
          b.organization?.display_name ?? "",
          "es",
        ),
      ),
    };
  });

  // Estado público del runtime para que la UI pueda explicar la ausencia de
  // credenciales sin exponer claves ni obligar al usuario a descubrirlo al
  // enviar el primer brief.
  app.get("/v1/ai/status", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    return {
      configured: Boolean(env.ANTHROPIC_API_KEY || env.OPENAI_API_KEY),
      primary_provider: env.ANTHROPIC_API_KEY
        ? "anthropic"
        : env.OPENAI_API_KEY
          ? "openai"
          : null,
      // Con el autorun apagado, CADA agente responde 409 en cuanto se le
      // pregunta. El dashboard preguntaba a los nueve en cada montaje para
      // enterarse nueve veces de lo mismo; sabiendolo de antemano se ahorra
      // el abanico entero y ademas puede explicarlo en vez de pintar un
      // "no se pudo cargar" que suena a averia.
      agent_autorun: isAgentAutorunEnabled(env),
    } as const;
  });

  app.get("/v1/actions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listAccountActions(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/organizations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantOrganizations(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Genera un codigo de vinculacion suelto (no requiere platform_admin). El
  // cliente crea su propia organizacion en /planes -- ver §16 del plan de
  // organizacion consultora.
  app.post<{ Body: { email?: string } }>(
    "/v1/consultant/clients",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await generateClientInviteCode(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // La consultora de quien pide y sus plazas (Configuración › Plan y plazas).
  app.get("/v1/consultant/consultora", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (!["consultant", "platform_admin"].includes(auth.context.profile.platform_role)) {
      return reply.code(403).send({ error: "consultant_access_required" });
    }
    const result = await getConsultora(createServiceClient(env), auth.context);
    return result.data;
  });

  // Con quien comparte cartera un consultor. Emparejarse reparte las tiendas
  // que ya tienen los dos y hace que las nuevas nazcan compartidas.
  app.get("/v1/consultant/partners", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listConsultantPartners(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Body: { email?: string } }>(
    "/v1/consultant/partners",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await addConsultantPartner(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Sin sesion: lo abre quien llega por `/r/<code>` antes de registrarse.
  app.get<{ Params: { code: string } }>(
    "/v1/referidos/:code",
    async (request, reply) => {
      const result = await getPublicReferralCode(env, request.params.code);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/consultant/referidos", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getMyReferralProgram(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Body: { code?: string } }>(
    "/v1/consultant/referidos",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await createMyReferralCode(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{ Body: { is_active?: unknown } }>(
    "/v1/consultant/referidos/code",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await setMyReferralCodeActive(env, auth.context, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{ Params: { referralId: string }; Body: { contacted?: unknown } }>(
    "/v1/consultant/referidos/:referralId/contacted",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await setReferralContacted(
        env,
        auth.context,
        request.params.referralId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/referidos", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listReferralProgramAdmin(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Params: { userId: string } }>(
    "/v1/admin/referidos/:userId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await listConsultantReferralsAdmin(
        env,
        auth.context,
        request.params.userId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.put<{
    Params: { userId: string };
    Body: {
      code?: string;
      discount_percent?: number;
      discount_months?: number;
      is_active?: boolean;
    };
  }>("/v1/admin/referidos/:userId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await upsertReferralCodeAdmin(
      env,
      auth.context,
      request.params.userId,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.delete(
    "/v1/mi-organizacion/referido-consentimiento",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await revokeReferralConsent(env, auth.context);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Body: {
      business_name?: string;
      invite_code?: string;
      referral_code?: string;
      referral_contact_consent?: boolean;
    };
  }>("/v1/mi-organizacion", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await ensureOwnOrganization(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/billing/plans", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listPlans(env);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Catalogo de tools del copiloto: que sabe hacer y que agente puede usarlo.
  app.get("/v1/admin/tools", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getToolCatalog(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Bandeja de la IA: funciones y datos que piden los agentes.
  app.get("/v1/admin/capability-proposals", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listCapabilityProposals(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Params: { proposalId: string }; Body: { status?: unknown; note?: unknown } }>(
    "/v1/admin/capability-proposals/:proposalId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await decideCapabilityProposal(env, auth.context, request.params.proposalId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/report-templates", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    return { templates: listReportTemplates() };
  });

  app.get<{ Params: { templateId: string } }>("/v1/admin/report-templates/:templateId/preview", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    const templateId = resolveReportTemplateId(request.params.templateId);
    if (!templateId) return reply.code(404).send({ error: "report_template_not_found" });
    const pdf = await renderReportPdf(buildSampleReportDocument(templateId));
    return reply
      .header("Content-Type", "application/pdf")
      .header("Content-Disposition", `inline; filename="${templateId}-muestra.pdf"`)
      .header("Cache-Control", "no-store")
      .send(pdf);
  });

  app.get<{
    Params: { organizationId: string; reportId: string };
    Querystring: { file_name?: string };
  }>(
    "/v1/organizations/:organizationId/copilot-reports/:reportId/link",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCopilotReportShareLink(
        env,
        auth.context,
        request.params.organizationId,
        request.params.reportId,
        request.query.file_name,
      );
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; reportId: string };
    Body: { email?: string; file_name?: string };
  }>(
    "/v1/organizations/:organizationId/copilot-reports/:reportId/email",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await emailCopilotReport(
        env,
        auth.context,
        request.params.organizationId,
        request.params.reportId,
        request.body?.email,
        request.body?.file_name,
      );
      if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
      return reply.send(result.data);
    },
  );

  // Informes: historial, generación desde la pantalla, envío mensual y cartera.
  app.get<{ Params: { organizationId: string } }>("/v1/organizations/:organizationId/reports", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listReports(env, auth.context, request.params.organizationId);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Params: { organizationId: string }; Body: { template_id?: unknown; store_id?: unknown; period_start?: unknown; period_end?: unknown } }>(
    "/v1/organizations/:organizationId/reports",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await generateReportOnDemand(env, auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.put<{ Params: { organizationId: string }; Body: { template_id?: unknown; store_id?: unknown; recipients?: unknown; is_active?: unknown } }>(
    "/v1/organizations/:organizationId/report-schedules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await upsertReportSchedule(env, auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; scheduleId: string } }>(
    "/v1/organizations/:organizationId/report-schedules/:scheduleId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteReportSchedule(env, auth.context, request.params.organizationId, request.params.scheduleId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: { days?: unknown } }>("/v1/consultant/portfolio-report", aiEndpointRateLimit, async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await generatePortfolioReport(env, authorization, auth.context, request.body?.days);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/subscriptions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listPlatformSubscriptions(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Querystring: { days?: string } }>(
    "/v1/admin/financial-dashboard",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const requestedDays = Number.parseInt(request.query.days ?? "30", 10);
      const result = await getPlatformFinancialDashboard(
        env,
        auth.context,
        requestedDays,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Querystring: { days?: string } }>(
    "/v1/admin/expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const requestedDays = Number.parseInt(request.query.days ?? "30", 10);
      const result = await listPlatformExpenses(
        env,
        auth.context,
        requestedDays,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: PlatformExpenseInput }>(
    "/v1/admin/expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createPlatformExpense(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{ Params: { expenseId: string }; Body: PlatformExpenseInput }>(
    "/v1/admin/expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updatePlatformExpense(
        env,
        auth.context,
        request.params.expenseId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { expenseId: string } }>(
    "/v1/admin/expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await archivePlatformExpense(
        env,
        auth.context,
        request.params.expenseId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/billing-settings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    const result = await getPlatformBillingSettings(env);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{ Body: Record<string, unknown> }>(
    "/v1/admin/billing-settings",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await upsertPlatformBillingSettings(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/invoices", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listPlatformInvoices(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getPlatformInvoice(
        env,
        auth.context,
        request.params.invoiceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId/verifactu/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await retryInvoiceVerifactu(
        env,
        auth.context,
        request.params.invoiceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { invoiceId: string } }>(
    "/v1/admin/invoices/:invoiceId/email/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      const result = await sendInvoiceEmailForInvoice(
        env,
        request.params.invoiceId,
      );
      if (!result.ok) return reply.code(result.statusCode).send(result);
      return result;
    },
  );

  app.post<{ Body: GrantInput }>(
    "/v1/admin/subscriptions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await grantSubscription(
        env,
        auth.context,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { subscriptionId: string } }>(
    "/v1/admin/subscriptions/:subscriptionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await revokeSubscription(
        env,
        auth.context,
        request.params.subscriptionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Body: {
      price_id?: string;
      organization_id?: string;
      success_url?: string;
      cancel_url?: string;
      customer_tax_id?: string;
    };
  }>("/v1/billing/stripe/checkout", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await createStripeCheckout(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/agent-release-candidates", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") {
      return reply.code(403).send({ error: "platform_admin_required" });
    }
    try {
      return reply.send({ candidates: await listAgentReleaseCandidates(env) });
    } catch (error) {
      request.log.error({ err: error }, "agent_release_candidates_load_failed");
      return reply.code(503).send({ error: "agent_release_candidates_unavailable" });
    }
  });

  app.get<{ Querystring: { split?: string; datasetVersion?: string; page?: string } }>("/v1/admin/agent-judge-dataset/cases", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const split = request.query.split === "holdout" || request.query.split === "calibration" ? request.query.split : "development";
    const page = request.query.page === undefined ? 0 : Number(request.query.page);
    const result = await listAgentJudgeEvalQueue(env, auth.context, split, request.query.datasetVersion, page);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
    return reply.send(result.data);
  });

  app.get<{ Querystring: { split?: string; datasetVersion?: string; agentCode?: string; page?: string } }>("/v1/admin/agent-release-eval-fixtures", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const page = request.query.page === undefined ? 0 : Number(request.query.page);
    const result = await listAgentReleaseEvalFixtures(env, auth.context, {
      ...(request.query.split === undefined ? {} : { split: request.query.split }),
      ...(request.query.datasetVersion === undefined ? {} : { dataset_version: request.query.datasetVersion }),
      ...(request.query.agentCode === undefined ? {} : { agent_code: request.query.agentCode }),
      page,
    });
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
    return reply.send(result.data);
  });

  app.post<{ Body: unknown }>("/v1/admin/agent-release-eval-fixtures", { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await createAgentReleaseEvalFixture(env, auth.context, request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, detail: "detail" in result ? result.detail : undefined });
    return reply.code(201).send(result.data);
  });

  app.post<{ Body: unknown }>("/v1/admin/agent-release-eval-fixtures/run", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    if (auth.context.profile.platform_role !== "platform_admin") return reply.code(403).send({ error: "platform_admin_required" });
    const body = request.body && typeof request.body === "object" && !Array.isArray(request.body)
      ? request.body as Record<string, unknown> : {};
    const candidateVersionId = typeof body.candidate_version_id === "string" ? body.candidate_version_id.trim() : "";
    const fixtureIds = Array.isArray(body.fixture_ids) && body.fixture_ids.every((id) => typeof id === "string")
      ? body.fixture_ids as string[] : [];
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidateVersionId)
      || fixtureIds.length < 1 || fixtureIds.length > 100
      || fixtureIds.some((id) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) {
      return reply.code(400).send({ error: "invalid_release_eval_run_request" });
    }
    try {
      const run = await runAgentReleaseEvalAsPlatformAdmin(env, auth.context, { candidateVersionId, fixtureIds });
      if (!run.ok) return reply.code(run.statusCode).send({ error: run.error });
      const result = run.result;
      return reply.send({
        evaluation_id: result.evaluationId,
        status: result.payload.evaluation.status,
        release_eligible: result.payload.evaluation.evidence.release_eligible === true,
        evidence: result.payload.evaluation.evidence,
        results: result.results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "agent_release_eval_run_failed";
      const invalid = /fixture_(ids_invalid|ids_missing|invalid|agent_mismatch|rubric_mismatch|dataset_version_mismatch|mixed_dataset_versions)|candidate_agent_mismatch/.test(message);
      request.log.error({ err: error }, "agent_release_eval_run_failed");
      return reply.code(invalid ? 400 : 503).send({ error: invalid ? message : "agent_release_eval_unavailable" });
    }
  });

  app.post<{ Body: unknown }>("/v1/admin/agent-judge-dataset/cases", { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await createAgentJudgeEvalCase(env, auth.context, request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, detail: "detail" in result ? result.detail : undefined });
    return reply.code(201).send(result.data);
  });

  app.post<{ Params: { caseId: string }; Body: unknown }>("/v1/admin/agent-judge-dataset/cases/:caseId/reviews", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await submitAgentJudgeEvalReview(env, auth.context, request.params.caseId, request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, detail: "detail" in result ? result.detail : undefined });
    return reply.code(201).send(result.data);
  });

  app.post<{ Params: { caseId: string }; Body: unknown }>("/v1/admin/agent-judge-dataset/cases/:caseId/adjudication", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await adjudicateAgentJudgeEvalCase(env, auth.context, request.params.caseId, request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, detail: "detail" in result ? result.detail : undefined });
    return reply.code(201).send(result.data);
  });

  app.get<{ Querystring: { datasetVersion?: string } }>("/v1/admin/agent-judge-dataset/holdout", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await loadApprovedAgentJudgeHoldout(env, auth.context, request.query.datasetVersion ?? "");
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
    return reply.send(result.data);
  });

  app.get<{ Querystring: { datasetVersion?: string } }>("/v1/admin/agent-judge-dataset/holdout-state", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await getAgentJudgeHoldoutState(env, auth.context, request.query.datasetVersion ?? "");
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error });
    return reply.send(result.data);
  });

  app.post<{ Body: unknown }>("/v1/admin/agent-judge-dataset/calibrate", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await runAgentJudgeDatasetEvaluation(env, auth.context, "calibration", request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, ...( "detail" in result ? { detail: result.detail } : {} ), ...( "case_id" in result ? { case_id: result.case_id } : {} ), ...( "maximum_cost_usd" in result ? { maximum_cost_usd: result.maximum_cost_usd } : {} ) });
    return reply.code(201).send(result.data);
  });

  app.post<{ Body: unknown }>("/v1/admin/agent-judge-dataset/certify", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await runAgentJudgeDatasetEvaluation(env, auth.context, "holdout", request.body);
    if (!result.ok) return reply.code(result.statusCode).send({ error: result.error, ...( "detail" in result ? { detail: result.detail } : {} ), ...( "case_id" in result ? { case_id: result.case_id } : {} ), ...( "maximum_cost_usd" in result ? { maximum_cost_usd: result.maximum_cost_usd } : {} ) });
    return reply.code(201).send(result.data);
  });

  app.post<{ Params: { agentVersionId: string } }>(
    "/v1/admin/agent-release-candidates/:agentVersionId/evaluate-offline",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.agentVersionId)) {
        return reply.code(400).send({ error: "agent_version_id_invalid" });
      }
      try {
        const result = await evaluateAgentReleaseCandidateOffline(env, request.params.agentVersionId);
        if (!result) return reply.code(404).send({ error: "agent_release_candidate_not_found" });
        return reply.send({ evaluation: result });
      } catch (error) {
        request.log.error({ err: error }, "agent_release_offline_evaluation_failed");
        return reply.code(422).send({ error: "agent_release_offline_evaluation_failed" });
      }
    },
  );

  app.post<{ Params: { agentVersionId: string } }>(
    "/v1/admin/agent-release-candidates/:agentVersionId/promote",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.agentVersionId)) {
        return reply.code(400).send({ error: "agent_version_id_invalid" });
      }
      try {
        await promoteAgentReleaseCandidate(env, request.params.agentVersionId);
        return reply.send({ ok: true, agent_version_id: request.params.agentVersionId });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.includes("agent_release_gate:evaluation_missing_or_failed")) {
          return reply.code(409).send({ error: "agent_release_evidence_required" });
        }
        request.log.error({ err: error }, "agent_release_promotion_failed");
        return reply.code(422).send({ error: "agent_release_promotion_failed" });
      }
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { idempotency_key?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/generation-status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMarketingGenerationStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.query.idempotency_key,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
  }>(
    "/v1/organizations/:organizationId/billing",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getOrganizationBilling(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/billing/portal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await createBillingPortal(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { partnerUserId: string } }>(
    "/v1/consultant/partners/:partnerUserId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await removeConsultantPartner(
        env,
        auth.context,
        request.params.partnerUserId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Reparto de trabajo entre los consultores de cada tienda: quien es el
  // principal y que parte de las tareas automaticas le toca a cada uno.
  app.get("/v1/consultant/work-split", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listWorkSplit(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{
    Body: {
      organization_ids?: string[];
      shares?: Array<{ user_id: string; work_share: number }>;
      primary_user_id?: string;
    };
  }>("/v1/consultant/work-split", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await updateWorkSplit(env, auth.context, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Accesos de un cliente para su consultor: ver quien entra, invitar a otra
  // persona y cambiar roles. Antes solo existia la version platform_admin, que
  // ademas devuelve el directorio de perfiles de toda la plataforma.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/client-access",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getClientAccess(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { markdown?: string; fileName?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/import/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const access = assertCanManagePlan(
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(access)) return sendServiceFailure(reply, access);
      const markdown = request.body?.markdown;
      if (typeof markdown !== "string") {
        return reply.code(400).send({ error: "missing_markdown" });
      }
      return reply.send({
        ...previewStrategicPlanMarkdown(markdown),
        fileName: request.body?.fileName ?? null,
      });
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      markdown?: string;
      fileName?: string;
      connectionId?: string | null;
      currencyCode?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const markdown = request.body?.markdown;
      if (typeof markdown !== "string") {
        return reply.code(400).send({ error: "missing_markdown" });
      }
      const result = await createStrategicPlanFromMarkdown(
        env,
        auth.context,
        request.params.organizationId,
        markdown,
        typeof request.body?.connectionId === "string" &&
          request.body.connectionId
          ? request.body.connectionId
          : null,
        request.body?.currencyCode ?? null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      email?: string;
      full_name?: string;
      role?: string;
      access_scope?: "organization" | "store";
      store_id?: string | null;
      store_ids?: string[];
    };
  }>(
    "/v1/consultant/organizations/:organizationId/client-access/invite",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await inviteClientMember(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; userId: string };
    Body: {
      role?: string;
      isActive?: boolean;
      access_scope?: "organization" | "store";
      store_id?: string | null;
      store_ids?: string[];
    };
  }>(
    "/v1/consultant/organizations/:organizationId/client-access/:userId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await setClientMemberRole(
        env,
        auth.context,
        request.params.organizationId,
        request.params.userId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{
    Params: { organizationId: string; inviteId: string };
  }>(
    "/v1/consultant/organizations/:organizationId/client-access/invites/:inviteId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await revokeClientAccessInvite(
        env,
        auth.context,
        request.params.organizationId,
        request.params.inviteId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { inviteId: string } }>(
    "/v1/consultant/invites/:inviteId/regenerate",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await regenerateClientInvite(
        env,
        auth.context,
        request.params.inviteId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Vista previa publica de un codigo: sin auth (el cliente aun no tiene
  // sesion). Un codigo suelto (§16) manda a /registro; uno de cliente ya
  // existente devuelve `requires_signup: false` y sigue por /v1/invites/redeem.
  app.post<{ Body: { code?: string; email?: string } }>(
    "/v1/invites/preview",
    inviteRedeemRateLimit,
    async (request, reply) => {
      const result = await previewClientInvite(env, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: { code?: string; email?: string } }>(
    "/v1/invites/redeem",
    inviteRedeemRateLimit,
    async (request, reply) => {
      const result = await redeemClientInvite(env, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Solicitudes de acceso (solicitudes.ts). Enviarla es publico: /solicitar no
  // tiene sesion y no dice cuantas plazas quedan.

  // Sin sesion el cubo es la IP, y detras del proxy esa IP puede ser la misma
  // para todos: 30/min deja pasar el pico de un anuncio sin abrir la puerta a
  // un script.
  const solicitudRateLimit = {
    config: { rateLimit: { max: 30, timeWindow: "1 minute", keyGenerator: (request: { ip: string }) => request.ip } },
  };
  app.post("/v1/solicitudes", solicitudRateLimit, async (request, reply) => {
    const result = await crearSolicitud(env, request.body);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.get("/v1/consultant/declared-clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listarDeclarados(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post("/v1/consultant/declared-clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await declararCliente(env, auth.context, request.body);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.get("/v1/admin/solicitudes", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listarSolicitudes(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{ Body: { client?: unknown; consultant?: unknown } }>(
    "/v1/admin/solicitudes/plazas",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await actualizarPlazas(env, auth.context, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post("/v1/admin/solicitudes/invitar-aprobadas", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await invitarAprobadas(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.patch<{
    Params: { requestId: string };
    Body: { status?: unknown; admin_note?: unknown; client_slots?: unknown };
  }>("/v1/admin/solicitudes/:requestId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await actualizarSolicitud(env, auth.context, request.params.requestId, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Params: { requestId: string }; Body: { client_slots?: unknown } }>(
    "/v1/admin/solicitudes/:requestId/aprobar",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await aprobarSolicitud(env, auth.context, request.params.requestId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/v1/admin/solicitudes/:requestId/invitar",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await invitarSolicitud(env, auth.context, request.params.requestId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/v1/admin/solicitudes/:requestId/comprobar",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await recomprobarTienda(env, auth.context, request.params.requestId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Mesa de trabajo diaria: la lectura unica desde la que el consultor decide
  // donde intervenir. Con `organizationId` devuelve ademas la ficha de ese
  // cliente (y 403 si no es de su cartera). Solo lee: no dispara agentes ni
  // cambia estados.
  app.get<{ Querystring: { days?: string; organizationId?: string; connectionId?: string } }>(
    "/v1/consultant/daily-workbench",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getDailyWorkbench(env, authorization, auth.context, {
        days: Number(request.query.days ?? "30"),
        organizationId: request.query.organizationId,
        connectionId: request.query.connectionId,
      });

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // "Marcar como revisado": accion explicita del consultor, nunca un efecto de
  // abrir la ficha. Acota el "desde mi ultima revision" de la mesa.
  app.post<{
    Params: { organizationId: string };
    Body: { note?: string };
  }>(
    "/v1/consultant/organizations/:organizationId/review",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await markClientReviewed(
        env,
        authorization,
        auth.context,
        {
          organizationId: request.params.organizationId,
          note: request.body?.note,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { days?: string } }>(
    "/v1/consultant/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getConsultantOverview(
        env,
        authorization,
        auth.context,
        Number(request.query.days ?? "30"),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { from?: string; to?: string; scope?: string } }>(
    "/v1/consultant/agenda",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantAgenda(
        env,
        authorization,
        auth.context,
        {
          from: request.query.from,
          to: request.query.to,
          scope: request.query.scope || "all",
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { from?: string; to?: string } }>(
    "/v1/consultant/orders",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const toMs = Date.parse(request.query.to ?? "") || now;
      const fromMs = Date.parse(request.query.from ?? "") || toMs - dayMs;
      // Rango sano: from < to y como mucho ~13 meses.
      if (fromMs >= toMs || toMs - fromMs > 400 * dayMs) {
        return reply.code(400).send({ error: "invalid_date_range" });
      }

      const result = await listConsultantOrders(
        env,
        authorization,
        auth.context,
        new Date(fromMs).toISOString(),
        new Date(toMs).toISOString(),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Campañas del consultor (Marketing -> Campañas): cartera, cliente y tienda
  // con la misma lectura. Solo lee.
  app.get<{ Querystring: { organizationId?: string; storeId?: string; connectionId?: string } }>(
    "/v1/consultant/campaigns/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await getConsultantCampaignsOverview(env, authorization, auth.context, {
        organizationId: request.query.organizationId,
        storeId: request.query.storeId,
        connectionId: request.query.connectionId,
      });
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Hilo de revision de una campaña: notas, correcciones, propuestas de la IA.
  app.get<{ Params: { organizationId: string; itemId: string } }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/thread",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listCampaignThread(env, auth.context, request.params.organizationId, request.params.itemId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; itemId: string };
    Body: { body?: string; kind?: string; target?: string | null; visibleToClient?: boolean; fromAi?: boolean };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/thread",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await addCampaignThreadNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string; itemId: string; noteId: string } }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/thread/:noteId/resolve",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await resolveCampaignThreadNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.params.noteId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // El consultor da por revisada la campaña o pide cambios al cliente.
  app.post<{
    Params: { organizationId: string; itemId: string };
    Body: { status?: string; message?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/review",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await setCampaignReviewStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // El cliente devuelve la campaña a revision tras hacer lo que se le pedia.
  app.post<{ Params: { organizationId: string; itemId: string } }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/review/request",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await requestCampaignReview(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Editar con IA: A05 propone cambios por campo; nada se escribe hasta aplicarlos.
  app.post<{
    Params: { organizationId: string; itemId: string };
    Body: { instruction?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/ai-edit",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await proposeCampaignEdit(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; itemId: string; noteId: string };
    Body: { fields?: string[]; dismiss?: boolean };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/ai-edit/:noteId/apply",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await applyCampaignEditProposal(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.params.noteId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Acciones rapidas de Campañas: el staff las gestiona, el cliente lee las compartidas.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/campaign-quick-actions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listQuickActions(env, auth.context, request.params.organizationId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: QuickActionInput }>(
    "/v1/organizations/:organizationId/campaign-quick-actions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createQuickAction(env, auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.put<{ Params: { organizationId: string }; Body: { ids?: string[] } }>(
    "/v1/organizations/:organizationId/campaign-quick-actions/order",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await reorderQuickActions(env, auth.context, request.params.organizationId, request.body?.ids ?? []);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{ Params: { organizationId: string; actionId: string }; Body: QuickActionInput }>(
    "/v1/organizations/:organizationId/campaign-quick-actions/:actionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateQuickAction(
        env,
        auth.context,
        request.params.organizationId,
        request.params.actionId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; actionId: string } }>(
    "/v1/organizations/:organizationId/campaign-quick-actions/:actionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteQuickAction(
        env,
        auth.context,
        request.params.organizationId,
        request.params.actionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Rentabilidad del consultor (/panel). Sin organizationId devuelve la cartera
  // entera tienda a tienda; con el, las tiendas de ese cliente. Solo lee.
  app.get<{ Querystring: { days?: string; organizationId?: string } }>(
    "/v1/consultant/profitability",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getConsultantProfitability(
        env,
        authorization,
        auth.context,
        {
          days: request.query.days,
          organizationId: request.query.organizationId,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { compare?: string } }>(
    "/v1/consultant/meta-portfolio",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantMetaPortfolio(
        env,
        authorization,
        auth.context,
        request.query.compare ?? "month",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { window?: string } }>(
    "/v1/consultant/klaviyo-portfolio",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listConsultantKlaviyoPortfolio(
        env,
        authorization,
        auth.context,
        request.query.window ?? "30d",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/consultant/proposed-tasks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantProposedTasks(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Querystring: { days?: string } }>(
    "/v1/consultant/own-stores",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listOwnStoresOverview(
        env,
        auth.context,
        Number(request.query.days ?? "30"),
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Body: { display_name?: string; timezone?: string; currency_code?: string };
  }>("/v1/consultant/own-stores", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createOwnStore(env, auth.context, request.body ?? {});

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.get("/v1/consultant/marketing", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMarketing(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string; draftId: string } }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listMarketingDraftNotes(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
    Body: { body?: string; from_ai?: boolean };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addMarketingDraftNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string; outputId: string } }>(
    "/v1/organizations/:organizationId/ai/outputs/:outputId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listAgentOutputNotes(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; outputId: string };
    Body: { body?: string; from_ai?: boolean };
  }>(
    "/v1/organizations/:organizationId/ai/outputs/:outputId/notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await addAgentOutputNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // --- Canal de mensajería consultor <-> cliente -------------------------

  app.get<{ Params: { organizationId: string }; Querystring: { status?: string } }>(
    "/v1/organizations/:organizationId/consultant-chat/escalations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listAgentEscalations(env, auth.context, request.params.organizationId, request.query.status);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/consultant-chat/escalations/owners",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listAgentEscalationOwners(env, auth.context, request.params.organizationId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; escalationId: string };
    Body: { status?: string; owner_user_id?: string | null; resolution?: string | null };
  }>(
    "/v1/organizations/:organizationId/consultant-chat/escalations/:escalationId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateAgentEscalation(env, auth.context, request.params.organizationId, request.params.escalationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/consultant/message-threads", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }
    const result = await listClientMessageThreads(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{
    Params: { organizationId: string };
    Querystring: { limit?: string; mark_read?: string };
  }>(
    "/v1/organizations/:organizationId/consultant-messages",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }
      const result = await listThreadMessages(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        {
          limit: request.query.limit ? Number(request.query.limit) : undefined,
          markRead: request.query.mark_read === "0" ? false : undefined,
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/consultant-messages/read",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await markThreadRead(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      filename?: string;
      content_type?: string;
      content_base64?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-messages/attachments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await uploadThreadAttachment(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { body?: string; attachments?: unknown[] };
  }>(
    "/v1/organizations/:organizationId/consultant-messages",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await postThreadMessage(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; draftId: string };
    Body: { scheduled_for?: string | null };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/schedule",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await setMarketingDraftSchedule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/consultant/knowledge", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantKnowledge(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/stores", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantStores(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Cartera de Meta ordenada por urgencia. Distinta de /meta-portfolio, que
  // compara rendimiento entre periodos: esta responde a que cuenta hay que
  // mirar hoy.
  app.get("/v1/consultant/meta-accounts", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMetaAccounts(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Cartera de email ordenada por urgencia: que cuenta de Klaviyo hay que
  // mirar hoy. Determinista, igual que la de Meta.
  app.get("/v1/consultant/klaviyo-accounts", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantKlaviyoAccounts(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/integrations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const { organizationId } = request.query as { organizationId?: string };

    const result = await listConsultantIntegrations(
      env,
      authorization,
      auth.context,
      organizationId,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D01. La calidad del dato de cada fuente, antes de que nadie interprete
  // una variacion como cambio del negocio. La escribe el motor de
  // `data-quality-engine.ts`; aqui solo se lee, y con el token del usuario para
  // que quien decida que organizaciones entran sea la RLS y no este codigo.
  // F3/D02. Las lecturas contextuales: contra que se compara cada senal, si la
  // comparacion aguanta y si lo que se movio fue el rendimiento o el peso de
  // los segmentos. Solo consultor: es razonamiento a medio hacer.
  app.get("/v1/consultant/context-readings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantContextReadings(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D03. De que es capaz el negocio: que capacidades demuestra el dato, cuales
  // no se pueden ver y con que numero. Solo consultor -- decirle a un cliente
  // "tu retencion es ad_hoc" sin acompanamiento es un juicio, no una ayuda.
  app.get("/v1/consultant/maturity", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantMaturity(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D04. Contra que se juzga cada metrica en cada tienda. Es la declaracion
  // que el guardrail 11 exige y que hasta ahora no tenia donde escribirse: sin
  // ella, D04 y D10 contestan "falta un dato" en vez de diagnosticar.
  app.get("/v1/consultant/health-references", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantHealthReferences(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D02. El contexto que declara el cliente (y su consultor): hechos de su
  // negocio y cambios internos. Es la materia prima de los pasos 9 y 13 del
  // runtime de D02 (cambios internos y declarado contra observado).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/context",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getTenantContext(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/context/facts",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await declareContextFact(
        env,
        auth.context,
        request.params.organizationId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/context/events",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await declareChangeEvent(
        env,
        auth.context,
        request.params.organizationId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; eventId: string } }>(
    "/v1/organizations/:organizationId/context/events/:eventId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteChangeEvent(
        env,
        auth.context,
        request.params.organizationId,
        request.params.eventId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // F3/D03. El consultor declara lo que el dato no ve: si la medida de una
  // capacidad cambia decisiones y si tiene responsable. Tras guardar se pasa el
  // motor de esa organizacion para que el nivel lo refleje ya.
  app.post("/v1/consultant/maturity/declarations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const body = (request.body ?? {}) as Record<string, unknown>;
    const parsed = maturityDeclarationSchema.safeParse(body);
    if (!parsed.success || typeof body.organization_id !== "string") {
      return reply.code(400).send({
        error: "invalid_maturity_declaration",
        detail: parsed.success
          ? "organization_id_required"
          : parsed.error.message,
      });
    }

    const result = await declareConsultantCapabilityMaturity(
      env,
      authorization,
      auth.context,
      { ...parsed.data, organization_id: body.organization_id },
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);

    try {
      await runMaturityEngine(env, body.organization_id);
    } catch (error) {
      // La declaracion ya esta guardada; la proxima pasada programada la aplica.
      request.log.warn({ error }, "maturity_engine_after_declaration_failed");
    }
    return reply.code(201).send(result.data);
  });

  app.post("/v1/consultant/health-references", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const parsed = healthReferenceInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_health_reference",
        detail: parsed.error.message,
      });
    }

    const result = await createConsultantHealthReference(
      env,
      authorization,
      auth.context,
      parsed.data,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.delete("/v1/consultant/health-references/:id", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const { id } = request.params as { id: string };
    const result = await retireConsultantHealthReference(
      env,
      authorization,
      auth.context,
      id,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D07. Las rutas causales candidatas de un caso: las que apoya, las que
  // contradice y las que nadie ha podido comprobar. Van **todas**, incluidas las
  // contradichas -- una rama podada dice donde no esta el problema, y eso es la
  // mitad de un diagnostico (guardrail 49). Solo consultor: son candidatas.
  app.get("/v1/consultant/causal-paths", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCausalPaths(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D08. Las explicaciones que se han barajado para un caso, **incluidas las
  // descartadas con su motivo**: filtrarlas es como se repite el mes que viene
  // una busqueda que ya se hizo. Y el test siguiente de cada una, que es la
  // parte accionable. Solo consultor.
  app.get("/v1/consultant/hypotheses", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantHypotheses(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D09. Causa raiz y constraint, dos preguntas independientes. Casi todo
  // llega "unresolved" o "latent" y se ensena tal cual: no cerrar es la
  // respuesta correcta cuando la evidencia es co-movimiento. Solo consultor.
  app.get("/v1/consultant/root-causes", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantRootCauses(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D12. El consultor ve la contraexplicación, todos los confusores,
  // checks obligatorios y sensibilidad; no se presenta como dato accionable
  // al cliente sin una traducción posterior.
  app.post(
    "/v1/consultant/diagnostic-revisions/:requestId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const { requestId } = request.params as { requestId: string };
      const { decision } = (request.body ?? {}) as { decision?: string };
      if (decision !== "confirm" && decision !== "decline") {
        return reply.code(400).send({ error: "invalid_revision_decision" });
      }
      const result = await decideDiagnosticRevision(
        env,
        authorization,
        auth.context,
        requestId,
        decision,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/consultant/adversarial", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });

    const result = await listConsultantDiagnosticRobustness(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D13. Película temporal para revisión del consultor.
  app.get("/v1/consultant/temporal", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantTemporalDiagnoses(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D14. Registro administrativo validado, con snapshot, evidencia y checks.
  app.get("/v1/consultant/diagnostic-outputs", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDiagnosticOutputs(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F4/P00. La primera pantalla deja visible si P0 puede empezar o debe
  // esperar a P1; no transforma la ausencia de contexto en una prioridad.
  app.get("/v1/consultant/prioritization", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPrioritizationRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F4/P01. El contexto se expone como snapshot y la declaración solo entra
  // por la frontera de consultor; el worker es quien evalúa y persiste P1.
  app.get("/v1/consultant/decision-context", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDecisionContexts(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Body: unknown }>(
    "/v1/consultant/decision-context",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createConsultantDecisionContextDeclaration(
        env,
        auth.context,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get("/v1/consultant/temporal-urgency", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantTemporalUrgency(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/decision-impact", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDecisionImpact(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/constraints", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantConstraints(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/feasibility", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantFeasibility(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/risk", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantRisk(env, authorization, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/allocation", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantAllocation(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/strategic-fit", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantStrategicFit(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/ranking", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantRanking(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/portfolio", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPortfolio(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/decision-outputs", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDecisionOutputs(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/playbooks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPlaybookRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/acquisition", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantAcquisitionRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/paid-media", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPaidMediaRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/conversion", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantConversionRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/offer-pricing", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantOfferPricingRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/retention-crm", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantRetentionCrmRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/unit-economics", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantUnitEconomicsRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/product-inventory", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantProductInventoryRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/operations-cx", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantOperationsCxRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/measurement-experimentation",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listConsultantMeasurementExperimentationRuns(
        env,
        authorization,
        auth.context,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/scalability", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantScalabilityRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/recovery-crisis", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantRecoveryCrisisRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/ai-playbook-insights", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantAiPlaybookInsights(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/benchmark-guardrails", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantBenchmarkGuardrailsRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/cohort-context", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantCohortContextRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/data-quality-reliability", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantDataQualityReliabilityRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/acquisition-demand", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantAcquisitionDemandRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/paid-media-benchmarks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantPaidMediaBenchmarksRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/conversion-cro-benchmarks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listConsultantConversionCroBenchmarksRuns(
        env,
        authorization,
        auth.context,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/offer-pricing-benchmarks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantOfferPricingBenchmarksRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/retention-crm-benchmarks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantRetentionCrmBenchmarksRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/unit-economics-benchmarks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listConsultantUnitEconomicsBenchmarksRuns(
        env,
        authorization,
        auth.context,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/operations-cx-benchmarks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantOperationsCxBenchmarksRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/product-inventory-benchmarks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listConsultantProductInventoryBenchmarksRuns(
        env,
        authorization,
        auth.context,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/scalability-benchmarks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantScalabilityBenchmarksRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/anomalies-red-flags", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantAnomaliesRedFlagsRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/benchmark-confidence", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listConsultantBenchmarkConfidenceRuns(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-eligibility", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionEligibilityRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-matching", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionMatchingRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-prioritization", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionPrioritizationRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-impact", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionImpactRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-feasibility", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionFeasibilityRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-risk", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionRiskRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/intervention-sequencing", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionSequencingRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/intervention-test-execute",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const query = request.query as { organizationId?: string };
      const result = await listConsultantInterventionTestExecuteRuns(
        env,
        authorization,
        auth.context,
        query.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/intervention-intensity", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantInterventionIntensityRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get("/v1/consultant/maturity-recommendations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantMaturityRecommendationRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.get(
    "/v1/consultant/constraint-recommendations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const query = request.query as { organizationId?: string };
      const result = await listConsultantConstraintRecommendationRuns(
        env,
        authorization,
        auth.context,
        query.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get("/v1/consultant/recommendation-portfolio", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantRecommendationPortfolioRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/dynamic-decisions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantDynamicDecisionRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/restraint-decisions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantRestraintDecisionRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/expected-outcomes", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantExpectedOutcomeRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get(
    "/v1/consultant/recommendation-confidence",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const query = request.query as { organizationId?: string };
      const result = await listConsultantRecommendationConfidenceRuns(
        env,
        authorization,
        auth.context,
        query.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get(
    "/v1/consultant/recommendation-communication",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const query = request.query as { organizationId?: string };
      const result = await listConsultantRecommendationCommunicationRuns(
        env,
        authorization,
        auth.context,
        query.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/consultant/execution-lifecycle", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantExecutionLifecycleStates(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get(
    "/v1/consultant/execution-lifecycle/transitions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const query = request.query as {
        organizationId?: string;
        interventionId?: string;
      };
      const result = await listConsultantExecutionLifecycleTransitions(
        env,
        authorization,
        auth.context,
        query.organizationId,
        query.interventionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post(
    "/v1/consultant/execution-lifecycle/commands",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const body = request.body as {
        organizationId?: string;
        interventionId?: string;
        command?: string;
        planVersion?: number;
      };
      const result = await applyConsultantLifecycleCommand(
        env,
        authorization,
        auth.context,
        body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/consultant/hitl-approval", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantHitlApprovalRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/closure-handoff", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantClosureHandoffRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/continuous-learning", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantContinuousLearningRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/execution-plans", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantExecutionPlans(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/readiness", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantReadinessRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/action-envelope", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantActionEnvelopeRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/consultant/execution-supervision", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const query = request.query as { organizationId?: string };
    const result = await listConsultantExecutionSupervisionRuns(
      env,
      authorization,
      auth.context,
      query.organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D07. Declarar una relacion causal propia de una tienda. Es lo que
  // desbloquea el bloque: el grafo global trae cinco aristas, y todo lo demas
  // que un consultor sabe de una tienda concreta no tenia donde escribirse.
  app.post("/v1/consultant/causal-edges", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const parsed = causalEdgeInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_causal_edge",
        detail: parsed.error.message,
      });
    }

    const result = await createConsultantCausalEdge(
      env,
      authorization,
      auth.context,
      parsed.data,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });
  // F3/D11. Cuanto se puede afirmar de cada cosa, capa por capa, y que falta
  // para afirmar mas. Es lo unico que impide leer un caso descrito como un caso
  // explicado. Solo consultor.
  app.get("/v1/consultant/confidence", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantConfidence(
      env,
      authorization,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // F3/D10. Cuanto dano hay, medido: cuanto se movio, sobre que base y con que
  // supuestos. **Ninguna severidad**: la fuente no define formula ni umbral.
  // Solo consultor -- una cifra de perdida sin causa es un susto sin salida.
  // Pixel propio (extensions/ecomscaling-pixel). Publica: la llama el
  // navegador del comprador. El cuerpo llega como text/plain para que el
  // navegador no haga preflight; la respuesta no la lee nadie. El limite va por
  // tienda y no por IP: detras de Caddy todas las IP son la del proxy.
  app.post(
    "/v1/pixel/events",
    {
      config: {
        rateLimit: {
          max: 1200,
          timeWindow: "1 minute",
          keyGenerator: (request: FastifyRequest) =>
            `pixel:${String((request.query as { s?: string }).s ?? "")}`,
        },
      },
      bodyLimit: 4096,
    },
    async (request, reply) => {
      const { s: storeId } = request.query as { s?: string };
      if (!isPixelStoreId(storeId))
        return reply.code(400).send({ error: "invalid_store" });
      const result = await ingestPixelEvent(env, storeId, request.body);
      return reply.code(result.stored ? 202 : 204).send();
    },
  );

  // F3/D10. Umbrales de gravedad de una tienda (por defecto o propios).
  app.get("/v1/consultant/severity-thresholds", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const { organizationId } = request.query as { organizationId?: string };
    if (!organizationId)
      return reply.code(400).send({ error: "organization_id_required" });
    const result = await getSeverityThresholds(
      env,
      authorization,
      auth.context,
      organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put("/v1/consultant/severity-thresholds", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const body = (request.body ?? {}) as Record<string, unknown>;
    if (typeof body.organization_id !== "string") {
      return reply.code(400).send({ error: "organization_id_required" });
    }
    // thresholds: null vuelve a los de por defecto.
    const parsed =
      body.thresholds === null
        ? null
        : severityThresholdsSchema.safeParse(body.thresholds);
    if (parsed && !parsed.success) {
      return reply
        .code(400)
        .send({
          error: "invalid_severity_thresholds",
          detail: parsed.error.issues[0]?.message,
        });
    }
    const result = await setSeverityThresholds(
      env,
      authorization,
      auth.context,
      body.organization_id,
      parsed ? parsed.data : null,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    // Se recalcula ya: el consultor cambia el umbral para ver el efecto.
    void runSeverityEngine(env, body.organization_id).catch(() => undefined);
    return result.data;
  });

  // F8: metrica objetivo y efecto medido de cada intervencion cerrada.
  app.get("/v1/consultant/intervention-effects", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const authorization = request.headers.authorization;
    if (!authorization)
      return reply.code(401).send({ error: "missing_bearer_token" });
    const { organizationId } = request.query as { organizationId?: string };
    if (!organizationId)
      return reply.code(400).send({ error: "organization_id_required" });
    const result = await listInterventionEffects(
      env,
      authorization,
      auth.context,
      organizationId,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{ Params: { interventionId: string } }>(
    "/v1/consultant/intervention-effects/:interventionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });
      const body = (request.body ?? {}) as Record<string, unknown>;
      if (typeof body.organization_id !== "string") {
        return reply.code(400).send({ error: "organization_id_required" });
      }
      const parsed = interventionEffectTargetSchema.safeParse(body);
      if (!parsed.success) {
        return reply
          .code(400)
          .send({
            error: "invalid_intervention_effect",
            detail: parsed.error.issues[0]?.message,
          });
      }
      const storeId =
        typeof body.store_id === "string" && body.store_id
          ? body.store_id
          : null;
      const result = await declareInterventionEffect(
        env,
        authorization,
        auth.context,
        body.organization_id,
        request.params.interventionId,
        { ...parsed.data, store_id: storeId },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      // Se mide ya: el consultor declara para ver el efecto, no para esperar a la noche.
      await runInterventionEffectEngine(env, body.organization_id).catch(
        () => undefined,
      );
      return result.data;
    },
  );

  app.get("/v1/consultant/severity", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSeverity(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D04. Como esta cada capacidad hoy, y cuando no se puede saber, que falta
  // declarar para poder saberlo. Solo consultor: el estado de una capacidad es
  // una etiqueta sin la conversacion que la acompana.
  app.get("/v1/consultant/capability-health", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCapabilityHealth(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D05. Las senales en crudo: que ha cambiado, cuanto y desde cuando, sin
  // interpretar por que. Solo consultor -- el guardrail 2 de D05 dice que no
  // toda senal es un problema, y una lista de desviaciones delante del cliente
  // es una alarma permanente.
  app.get("/v1/consultant/signals", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSignals(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D06. El mapa de sintomas activos: que patron empresarial forman las
  // senales coherentes entre si, con que se sostiene y que lo contradice. Solo
  // consultor: un sintoma es un patron sin causa, y ensenarselo al cliente le da
  // el susto sin la salida.
  app.get("/v1/consultant/symptoms", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantSymptomMap(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/data-quality", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantDataQuality(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/calls", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantCalls(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/plans", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantPlans(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // "Mi trabajo": proximas llamadas con lo que hay que preparar, tareas
  // internas del consultor y clientes sin nada agendado. Compone datos que ya
  // existen; no hay tabla nueva detras.
  app.get("/v1/consultant/work", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantWork(env, authorization, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/consultant/operations", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listConsultantOperations(
      env,
      authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get("/v1/admin/consultants", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await listConsultants(env, auth.context);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.post<{
    Body: {
      email?: string;
      full_name?: string;
      grant_plan?: {
        plan_code?: string;
        store_limit?: number | string | null;
        member_limit?: number | string | null;
        ends_at?: string | null;
      } | null;
    };
  }>("/v1/admin/consultants", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await inviteConsultant(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.patch<{
    Params: { userId: string };
    Body: { full_name?: string; is_active?: boolean };
  }>("/v1/admin/consultants/:userId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await updateConsultant(
      env,
      auth.context,
      request.params.userId,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{ Params: { userId: string } }>(
    "/v1/admin/consultants/:userId/resend-invite",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await resendConsultantInvite(
        env,
        auth.context,
        request.params.userId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { userId: string } }>(
    "/v1/admin/consultants/:userId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteConsultant(
        env,
        auth.context,
        request.params.userId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await listAdminClients(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/admin/clients/:organizationId/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getClientOverview(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // /admin/logs: el rastro de auditoria (61 puntos del codigo lo escriben y
  // no habia una sola lectura) y lo que se ha roto en la plataforma.
  app.get<{
    Querystring: {
      organizationId?: string;
      action?: string;
      actorUserId?: string;
      before?: string;
      limit?: string;
    };
  }>("/v1/admin/audit-log", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAuditLog(env, auth.context, request.query ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Querystring: { days?: string; limit?: string } }>(
    "/v1/admin/platform-errors",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await getPlatformErrors(
        env,
        auth.context,
        request.query ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { runId: string } }>(
    "/v1/admin/sync-errors/:runId/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await retryPlatformSyncError(
        env,
        auth.context,
        request.params.runId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Tarifa de modelos de IA: la ve el panel y el boton la actualiza desde LiteLLM.
  app.get("/v1/admin/ai-model-prices", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminModelPrices(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post("/v1/admin/ai-model-prices/sync", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await runAdminModelPriceSync(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Consumo de IA por agente (veces que corre y tokens), sin el copiloto.
  app.get<{ Querystring: { range?: string } }>("/v1/admin/ai-usage", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminAiUsage(env, auth.context, request.query.range);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Simulador de coste de IA: tokens por ejecucion, ejecuciones/dia y precios.
  app.get<{ Params: { agentCode?: string } }>("/v1/admin/ai-model-lab/:agentCode?", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await getAdminAiModelLab(env, auth.context, request.params.agentCode);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/a06-stock-events", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await getAdminA06StockEvents(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });
  app.put<{ Body: unknown }>("/v1/admin/a06-stock-events/settings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await setAdminA06StockEventSettings(env, auth.context, request.body);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/ai-cost-model", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminAiCostModel(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Aplica la cadencia y el modelo de cada agente (lo leen orquestador y runtime).
  app.put<{ Body: unknown }>("/v1/admin/ai-agent-settings", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await setAdminAiAgentSettings(env, auth.context, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/ai-agent-refresh-limits", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminAiAgentRefreshLimits(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{
    Body: { agent_code?: string; daily_manual_refresh_limit?: number };
  }>("/v1/admin/ai-agent-refresh-limits", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await setAdminAiAgentRefreshLimit(
      env,
      auth.context,
      request.body?.agent_code ?? "",
      request.body?.daily_manual_refresh_limit ?? Number.NaN,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{
    Querystring: { organizationId?: string };
  }>("/v1/admin/client-agent-runtime", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminClientAgentRuntimeConfig(
      env,
      auth.context,
      request.query?.organizationId ?? "",
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.put<{
    Body: {
      organization_id?: string;
      active_agent_codes?: string[];
      model_id?: string;
    };
  }>("/v1/admin/client-agent-runtime", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await setAdminClientAgentRuntimeConfig(
      env,
      auth.context,
      request.body?.organization_id ?? "",
      request.body?.active_agent_codes ?? [],
      request.body?.model_id ?? "",
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Playbook privado de mailing: endpoints exclusivos de platform admin.
  app.post(
    "/v1/admin/marketing-playbook/extract-pdf",
    { bodyLimit: MAX_INTERNAL_PLAYBOOK_PDF_BYTES },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      try {
        return await extractInternalPlaybookPdfText(request.body as Buffer);
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        const statusCode =
          code === "marketing_playbook_pdf_invalid" ? 400 : 422;
        return reply.code(statusCode).send({
          error: code || "marketing_playbook_pdf_parse_failed",
        });
      }
    },
  );

  app.post(
    "/v1/admin/marketing-playbook/analyze-image",
    { bodyLimit: 1_400_000 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (auth.context.profile.platform_role !== "platform_admin") {
        return reply.code(403).send({ error: "platform_admin_required" });
      }
      if (request.headers["x-reference-rights-confirmed"] !== "true") {
        return reply
          .code(400)
          .send({ error: "reference_rights_confirmation_required" });
      }
      if (!Buffer.isBuffer(request.body)) {
        return reply
          .code(400)
          .send({ error: "reference_image_binary_required" });
      }
      const result = await analyzeInternalMailingVisualReference(env, {
        actorUserId: auth.context.user.id,
        imageBytes: request.body,
        contentType:
          (request.headers["content-type"] ?? "").split(";")[0]?.trim() ?? "",
        rightsConfirmed: true,
      });
      if (result.ok === false)
        return reply.code(result.statusCode).send({ error: result.error });
      return result.data;
    },
  );

  app.get<{ Querystring: { include_drafts?: string } }>(
    "/v1/admin/marketing-playbook",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listInternalMailingPlaybook(
        env,
        auth.context,
        request.query.include_drafts !== "false",
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: unknown }>(
    "/v1/admin/marketing-playbook/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await previewInternalMailingPlaybook(
        env,
        auth.context,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { entryId: string } }>(
    "/v1/admin/marketing-playbook/:entryId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getInternalMailingPlaybookEntry(
        env,
        auth.context,
        request.params.entryId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Body: Record<string, unknown> }>(
    "/v1/admin/marketing-playbook",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveInternalMailingPlaybookDraft(
        env,
        auth.context,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { entryId: string }; Body: Record<string, unknown> }>(
    "/v1/admin/marketing-playbook/:entryId/versions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveInternalMailingPlaybookDraft(
        env,
        auth.context,
        request.body,
        request.params.entryId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { entryId: string } }>(
    "/v1/admin/marketing-playbook/:entryId/publish",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await setInternalMailingPlaybookStatus(
        env,
        auth.context,
        request.params.entryId,
        "published",
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { entryId: string } }>(
    "/v1/admin/marketing-playbook/:entryId/retire",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await setInternalMailingPlaybookStatus(
        env,
        auth.context,
        request.params.entryId,
        "retired",
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/admin/observability", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getAdminObservability(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get("/v1/admin/platform-health", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getPlatformHealth(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result;
  });

  app.post("/v1/platform-presence/heartbeat", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await recordPlatformUserHeartbeat(env, auth.context);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result;
  });

  app.post<{
    Params: { organizationId: string };
    Body: {
      category?: unknown;
      satisfaction?: unknown;
      message?: unknown;
      pagePath?: unknown;
    };
  }>(
    "/v1/organizations/:organizationId/platform-feedback",
    {
      bodyLimit: 4_096,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
          keyGenerator: (request: FastifyRequest) => {
            const organizationId = (
              request.params as { organizationId?: string }
            ).organizationId;
            return `platform-feedback:${organizationId ?? "unknown"}`;
          },
        },
      },
    },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const body = request.body ?? {};
      const categories = ["bug", "slow", "sync", "other"] as const;
      const message = typeof body.message === "string" ? body.message.trim() : "";
      const satisfaction = body.satisfaction ?? null;
      if (
        !categories.includes(body.category as (typeof categories)[number]) ||
        message.length < 8 ||
        message.length > 2_000 ||
        (satisfaction !== null &&
          (typeof satisfaction !== "number" || !Number.isInteger(satisfaction) || satisfaction < 1 || satisfaction > 5))
      ) {
        return reply.code(400).send({ error: "invalid_feedback" });
      }

      const rawPagePath = body.pagePath;
      const pagePath = typeof rawPagePath === "string" && rawPagePath.startsWith("/")
        ? rawPagePath.split("?")[0]!.slice(0, 300)
        : null;
      const result = await submitPlatformHealthFeedback(env, auth.context, {
        organizationId: request.params.organizationId,
        category: body.category as (typeof categories)[number],
        satisfaction: satisfaction as number | null,
        message,
        pagePath,
        requestId: request.id,
      });
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { feedbackId: string };
    Body: { status?: unknown };
  }>("/v1/admin/platform-feedback/:feedbackId/status", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const status = request.body?.status;
    if (status !== "open" && status !== "triaged" && status !== "resolved") {
      return reply.code(400).send({ error: "invalid_feedback_status" });
    }
    const result = await updatePlatformHealthFeedbackStatus(
      env,
      auth.context,
      request.params.feedbackId,
      status,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  // Fase 4: tarjeta del orquestador de diagnosticos IA (gasto de plataforma,
  // ejecuciones de hoy, decisiones del gate). Solo platform_admin.
  app.get("/v1/admin/ai-orchestrator", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await getDiagnosticOrchestratorObservability(
      env,
      auth.context,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.post<{
    Body: {
      display_name?: string;
      owner_email?: string;
      owner_full_name?: string;
      timezone?: string;
      currency_code?: string;
      grant_plan?: {
        plan_code?: string;
        store_limit?: number | string | null;
        member_limit?: number | string | null;
        ends_at?: string | null;
      } | null;
    };
  }>("/v1/admin/clients", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

    const result = await createClientOrganization(
      env,
      auth.context,
      request.body ?? {},
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(201).send(result.data);
  });

  app.get<{
    Params: { organizationId: string };
    Querystring: { year?: string; storeId?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const planningFilters: { year?: number; storeId?: string | null; connectionId?: string | null } = {
        storeId: request.query.storeId || null,
        connectionId: request.query.connectionId || null,
      };
      if (request.query.year) planningFilters.year = Number(request.query.year);
      const result = await listCampaignPlanning(
        env,
        auth.context,
        request.params.organizationId,
        planningFilters,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/resources",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listCampaignPlanningResources(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string; period?: string; limit?: string };
  }>(
    "/v1/organizations/:organizationId/kpi-snapshots",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKpiSnapshots(
        env,
        auth.context,
        request.params.organizationId,
        {
          storeId: request.query.storeId || null,
          ...(request.query.period ? { period: request.query.period } : {}),
          ...(request.query.limit
            ? { limit: Number(request.query.limit) }
            : {}),
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      year?: number;
      storeId?: string | null;
      description?: string | null;
      isVisibleToClient?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/calendars",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCampaignCalendar(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      calendarId?: string;
      title?: string;
      description?: string | null;
      channel?: string;
      itemType?: string;
      startsAt?: string;
      endsAt?: string | null;
      storeId?: string | null;
      status?: string;
      isVisibleToClient?: boolean;
      createTask?: boolean;
      milestoneId?: string | null;
      marketingDraftId?: string | null;
      metaCampaignId?: string | null;
      klaviyoCampaignId?: string | null;
      clientSuggestion?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.delete<{
    Params: { organizationId: string; itemId: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await archiveCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; itemId: string };
    Body: {
      title?: string;
      channel?: string;
      startsAt?: string;
      endsAt?: string | null;
      status?: string;
      marketingDraftId?: string | null;
      metaCampaignId?: string | null;
      klaviyoCampaignId?: string | null;
      acceptSuggestion?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateCampaignCalendarItem(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      storeId?: string | null;
      period?: string;
      periodStart?: string;
      periodEnd?: string;
      netSales?: number | null;
      ordersCount?: number | null;
      aov?: number | null;
      adSpend?: number | null;
      roas?: number | null;
      cac?: number | null;
      netProfit?: number | null;
      notes?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/kpi-snapshots",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await upsertKpiSnapshot(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/access",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getOrganizationAccess(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { user_id?: string; role?: string; is_active?: boolean };
  }>(
    "/v1/consultant/organizations/:organizationId/members",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertOrganizationMember(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      connectionId?: string;
      type?:
        | "campaign-values-report"
        | "flow-values-report"
        | "form-values-report"
        | "segment-values-report";
      statistics?: string[];
      periodStart?: string;
      periodEnd?: string;
      filter?: string;
      group_by?: string[];
      interval?: "hourly" | "daily" | "weekly" | "monthly";
    };
  }>(
    "/v1/organizations/:organizationId/klaviyo/reporting",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const body = request.body ?? {};
      if (
        !body.connectionId ||
        !body.type ||
        !body.statistics?.length ||
        !body.periodStart ||
        !body.periodEnd
      ) {
        return reply
          .code(400)
          .send({ error: "invalid_klaviyo_reporting_request" });
      }
      const access = requireOwnOrganizationAccess(
        auth.context,
        request.params.organizationId,
      );
      if (isOperationalOrganizationError(access)) {
        return reply
          .code(access.statusCode)
          .send({ error: access.error, message: access.message });
      }
      try {
        const result = await runKlaviyoReport(
          env,
          request.params.organizationId,
          body.connectionId,
          {
            type: body.type,
            statistics: body.statistics,
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            ...(body.filter ? { filter: body.filter } : {}),
            ...(body.group_by ? { group_by: body.group_by } : {}),
            ...(body.interval ? { interval: body.interval } : {}),
          },
        );
        return result;
      } catch (error) {
        return reply.code(502).send({
          error: "klaviyo_reporting_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; limit?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/reporting",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const access = requireOwnOrganizationAccess(
        auth.context,
        request.params.organizationId,
      );
      if (isOperationalOrganizationError(access)) {
        return reply
          .code(access.statusCode)
          .send({ error: access.error, message: access.message });
      }
      if (!request.query.connectionId) {
        return reply.code(400).send({ error: "missing_klaviyo_connection_id" });
      }
      try {
        return await listKlaviyoReports(
          env,
          request.params.organizationId,
          request.query.connectionId,
          Number(request.query.limit ?? 25),
        );
      } catch (error) {
        return reply.code(502).send({
          error: "klaviyo_reporting_load_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      consultant_user_id?: string;
      is_primary?: boolean;
      is_active?: boolean;
    };
  }>(
    "/v1/consultant/organizations/:organizationId/assignments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertConsultantAssignment(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // CRUD de consultoria: tiendas de un cliente, borrar tienda, borrar cliente
  // entero. Las escrituras (borrados) son solo platform_admin (irreversibles).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOrganizationStores(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; connectionId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores/:connectionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deleteOrganizationStore(
        env,
        auth.context,
        request.params.organizationId,
        request.params.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; connectionId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores/:connectionId/restore",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await restoreOrganizationStore(
        env,
        auth.context,
        request.params.organizationId,
        request.params.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; connectionId: string } }>(
    "/v1/consultant/organizations/:organizationId/stores/:connectionId/hard-delete",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await hardDeleteOrganizationStore(
        env,
        auth.context,
        request.params.organizationId,
        request.params.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deleteOrganization(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  for (const [suffix, handler] of [
    ["pause", pauseConsultantClient],
    ["resume", resumeConsultantClient],
    ["unlink", unlinkConsultantClient],
    ["hard-delete", hardDeleteOrganization],
  ] as const) {
    app.post<{ Params: { organizationId: string } }>(
      `/v1/consultant/organizations/:organizationId/${suffix}`,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

        const result = await handler(
          env,
          auth.context,
          request.params.organizationId,
        );
        if (isServiceFailure(result)) return sendServiceFailure(reply, result);
        return result.data;
      },
    );
  }

  app.post<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/restore",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await restoreOrganization(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string };
    Body: {
      display_name?: string;
      status?: string;
      timezone?: string;
      currency_code?: string;
    };
  }>("/v1/consultant/organizations/:organizationId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await updateOrganization(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // F3/D01, vista de cliente. Solo lo que ocurre en sus sistemas y ya esta
  // verificado: la regla vive en `data-quality.ts` y en la RLS, no aqui.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/data-quality",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOrganizationDataQuality(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/integrations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listIntegrations(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/overview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyOverview(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; cursor_created_at?: string; cursor_id?: string; limit?: string };
  }>("/v1/organizations/:organizationId/marketing/drafts/page", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const { cursor_created_at: cursorCreatedAt, cursor_id: cursorId } = request.query;
    if ((cursorCreatedAt || cursorId) && (!cursorCreatedAt || !cursorId || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(cursorCreatedAt) || !/^[-0-9a-f]{36}$/i.test(cursorId))) {
      return reply.code(400).send({ error: "marketing_draft_cursor_invalid" });
    }
    const requestedLimit = Number(request.query.limit ?? 30);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) return reply.code(400).send({ error: "marketing_draft_limit_invalid" });
    const authorization = request.headers.authorization;
    if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
    const result = await listMarketingDraftPage(env, authorization, auth.context, request.params.organizationId, {
      ...(request.query.connectionId ? { connectionId: request.query.connectionId } : {}),
      ...(cursorCreatedAt ? { cursorCreatedAt } : {}), ...(cursorId ? { cursorId } : {}), limit: requestedLimit,
    });
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; q?: string; status?: string; page?: string; sort?: string; filter?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/catalog/products",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listShopifyCatalogProducts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; q?: string; page?: string; filter?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/inventory",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listShopifyInventory(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; q?: string; status?: string; page?: string; sort?: string; filter?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/catalog/discounts",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listShopifyCatalogDiscounts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; discountId: string };
    Querystring: { connectionId?: string; page?: string; targetsPage?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/catalog/discounts/:discountId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await getShopifyCatalogDiscount(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.discountId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId: string };
  }>(
    "/v1/organizations/:organizationId/shopify/discount-proposals",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listShopifyDiscountProposals(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId: string };
    Body: unknown;
  }>(
    "/v1/organizations/:organizationId/shopify/discount-proposals",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createShopifyDiscountProposal(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; proposalId: string };
  }>(
    "/v1/organizations/:organizationId/shopify/discount-proposals/:proposalId/apply",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await approveAndApplyShopifyDiscountProposal(
        env,
        auth.context,
        request.params.organizationId,
        request.params.proposalId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; productId: string };
    Querystring: { connectionId?: string; page?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/catalog/products/:productId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await getShopifyCatalogProduct(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.productId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Lista liviana de conexiones, para el selector de tienda del header global
  // (evita pedir el overview completo -- ~20 queries de conteo -- en cada
  // cambio de cliente activo).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/shopify/connections",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyConnections(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyMetrics(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // "Hoy" de la app movil: desde las 00:00 de la tienda frente al mismo tramo de hace una semana.
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
    "/v1/organizations/:organizationId/shopify/today",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }
      const result = await getShopifyToday(env, request.headers.authorization!, auth.context, request.params.organizationId, request.query.connectionId);
      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }
      return result.data;
    },
  );

  // Previsión de stock de la app móvil: solo productos que se venden y se agotan pronto (o ya lo están).
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
    "/v1/organizations/:organizationId/shopify/stock-forecast",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }
      const result = await getStockForecast(env, request.headers.authorization!, auth.context, request.params.organizationId, request.query.connectionId);
      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }
      return result.data;
    },
  );

  // A29: una recomendación de la explicación pasa a tarea al pulsar "Crear tarea" (el toque es la aprobación).
  app.post<{
    Params: { organizationId: string; metric: string };
    Body: { outputId?: string; rating?: "helpful" | "incorrect"; correction?: string };
  }>("/v1/organizations/:organizationId/metric-analysis/:metric/feedback", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const { metric } = request.params;
    if (!Object.hasOwn(METRIC_SPECS, metric)) return reply.code(404).send({ error: "metric_not_found" });
    if (typeof request.body?.outputId !== "string" || !["helpful", "incorrect"].includes(request.body.rating ?? "") || (request.body.correction !== undefined && typeof request.body.correction !== "string")) {
      return reply.code(400).send({ error: "invalid_metric_feedback" });
    }
    const result = await recordMetricAnalysisFeedback(
      env, auth.context, request.params.organizationId, metric,
      request.body.outputId, request.body.rating!, request.body.correction,
    );
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.code(200).send(result.data);
  });

  app.post<{
    Params: { organizationId: string; metric: string };
    Querystring: { days?: string; connectionId?: string };
    Body: { index?: number; outputId?: string; action?: string };
  }>(
    "/v1/organizations/:organizationId/metric-analysis/:metric/actions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (!Object.hasOwn(METRIC_SPECS, request.params.metric)) return reply.code(404).send({ error: "metric_not_found" });
      const outputId = request.body?.outputId;
      const action = request.body?.action;
      if (typeof outputId !== "string" || typeof action !== "string" || !Number.isInteger(request.body?.index) || Number(request.body?.index) < 0) return reply.code(400).send({ error: "metric_action_identity_required" });
      const result = await createMetricActionTask(
        env,
        auth.context,
        request.params.organizationId,
        request.params.metric,
        request.body.index!,
        metricExplanationDays(request.query.days),
        outputId,
        action,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(result.data.created ? 201 : 200).send(result.data);
    },
  );

  // Analista de metricas (ADR-0027): veredicto bien/vigilar/mal de cada
  // metrica de la ficha, determinista y sin IA. Lo leen la web y el movil.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/metric-analysis",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await getMetricAnalysis(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // A29: explicacion de UNA metrica. GET solo lee la guardada; POST la genera
  // al pulsar si la guardada tiene mas de una hora: abrir la metrica otra vez
  // antes no vuelve a llamar al agente.
  app.get<{
    Params: { organizationId: string; metric: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/metric-analysis/:metric/explanation",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      if (!Object.hasOwn(METRIC_SPECS, request.params.metric)) return reply.code(404).send({ error: "metric_not_found" });
      const result = await getMetricAnalystExplanation(
        env,
        auth.context,
        request.params.organizationId,
        request.params.metric,
        metricExplanationDays(request.query.days),
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return withRenewal(result.data, auth.context);
    },
  );
  app.post<{
    Params: { organizationId: string; metric: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/metric-analysis/:metric/explanation",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const metric = request.params.metric;
      if (!Object.hasOwn(METRIC_SPECS, metric)) return reply.code(404).send({ error: "metric_not_found" });
      const days = metricExplanationDays(request.query.days);
      const { organizationId } = request.params;

      const cached = await getMetricAnalystExplanation(env, auth.context, organizationId, metric, days, request.query.connectionId);
      if (!isServiceFailure(cached) && !cached.data.stale && Date.now() - new Date(cached.data.generated_at).getTime() < METRIC_EXPLANATION_FRESH_MS) {
        return withRenewal(cached.data, auth.context);
      }

      const analysis = await getMetricAnalysis(env, authorization, auth.context, organizationId, String(days), request.query.connectionId, { includeMethodology: true, targetMetric: metric as keyof typeof METRIC_SPECS });
      if (isServiceFailure(analysis)) return sendServiceFailure(reply, analysis);
      const target = analysis.data.analyses.find((item) => item.metric === metric);
      if (!target) return reply.code(404).send({ error: "metric_not_found" });
      const result = await runMetricAnalystAgent(env, auth.context, organizationId, target, days, request.query.connectionId);
      if (isServiceFailure(result) && ["manual_refresh_in_progress", "manual_refresh_request_already_seen"].includes(result.error)) {
        // A concurrent identical request joins the in-flight result instead of
        // consuming another quota slot or returning a misleading failure.
        for (let attempt = 0; attempt < 45; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const joined = await getMetricAnalystExplanation(env, auth.context, organizationId, metric, days, request.query.connectionId);
          if (!isServiceFailure(joined) && !joined.data.stale && Date.now() - new Date(joined.data.generated_at).getTime() < METRIC_EXPLANATION_FRESH_MS) {
            return reply.code(200).send(withRenewal(joined.data, auth.context));
          }
        }
      }
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(withRenewal(result.data, auth.context));
    },
  );

  // Recurrencia, cohortes, atribucion, devoluciones, entregas, carritos y
  // promociones. Van juntas en una llamada porque la pagina las pinta a la
  // vez y cada RPC ya falla por su cuenta dentro.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getShopifyInsights(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );
  // Creatividades, veredictos de subasta, aprendizaje, pixel, publicos y el
  // impacto de los cambios. Una sola llamada porque la pagina los pinta a la
  // vez, y cada RPC falla por su cuenta dentro.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/meta/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMetaInsights(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );
  // /meta/campanas: listado y ficha de campaña, con su estructura, serie
  // diaria propia, conjuntos, anuncios y cambios (todo ya existia a nivel de
  // cuenta; aqui se filtra por campaña).
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; q?: string; status?: string; filter?: string; sort?: string; page?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/meta/campaigns",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listMetaCampaigns(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; q?: string; page?: string };
  }>(
    "/v1/organizations/:organizationId/meta/creatives",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listMetaCreativeLibrary(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get<{
    Params: { organizationId: string; campaignId: string };
    Querystring: { connectionId?: string; periodDays?: string };
  }>(
    "/v1/organizations/:organizationId/meta/campaigns/:campaignId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await getMetaCampaignDetail(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.campaignId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  // Modulo de Klaviyo: inventario de emails, salud de la medicion y
  // rendimiento mensual, en una llamada porque la pagina los pinta juntos.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/insights",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getKlaviyoInsights(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/shopify/product-costs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listProductCosts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      sku?: string;
      inventoryItemId?: string;
      unitCost: number;
      currencyCode?: string;
      validFrom?: string;
    };
  }>(
    "/v1/organizations/:organizationId/shopify/product-costs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertProductCost(
        env,
        auth.context,
        request.params.organizationId,
        request.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/financial-config",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getFinancialConfig(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      currencyCode?: string;
      klaviyoRevenueCurrencyCode?: string | null;
      paymentFeePct?: number;
      paymentFeeFixed?: number;
      defaultShippingCost?: number;
      vatPct?: number;
      notes?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/settings",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertFinancialSettings(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      category?: string | null;
      amount?: number;
      currencyCode?: string;
      billingPeriod?: string;
      validFrom?: string;
      validUntil?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/fixed-expenses",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createFixedExpense(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; expenseId: string } }>(
    "/v1/organizations/:organizationId/financial-config/fixed-expenses/:expenseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateFixedExpense(
        env,
        auth.context,
        request.params.organizationId,
        request.params.expenseId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      countryCode?: string | null;
      costPerOrder?: number;
      currencyCode?: string;
      minOrderTotal?: number;
      maxOrderTotal?: number | null;
    };
  }>(
    "/v1/organizations/:organizationId/financial-config/shipping-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createShippingRule(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.delete<{ Params: { organizationId: string; ruleId: string } }>(
    "/v1/organizations/:organizationId/financial-config/shipping-rules/:ruleId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateShippingRule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.ruleId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      rows?: Array<{ sku?: string; unitCost?: number; currencyCode?: string }>;
      dryRun?: boolean;
    };
  }>(
    "/v1/organizations/:organizationId/shopify/product-costs/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await importProductCosts(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      // 200 y no 201: con `dryRun` no se crea nada, y sin el la respuesta
      // interesante es el desglose por linea, no un recurso nuevo.
      return result.data;
    },
  );

  // Los objetivos ya no se escriben desde Configuracion: Mi Camino es la unica
  // fuente (/objectives y /strategic-plan/:planId/goal).

  app.post<{
    Params: { organizationId: string };
    Body: {
      shopDomain: string;
      appMode?: "public" | "custom";
      returnTo?: string;
    };
  }>(
    "/v1/organizations/:organizationId/integrations/shopify/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!request.body?.shopDomain) {
        return reply.code(400).send({ error: "missing_shop_domain" });
      }

      const result = await createShopifyConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
        request.body.shopDomain,
        request.body.appMode === "custom" ? "custom" : "public",
        request.body.returnTo === "/admin/onboarding"
          ? request.body.returnTo
          : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Headers: { "idempotency-key"?: string };
  }>(
    "/v1/organizations/:organizationId/shopify/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await triggerShopifySync(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(202).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { returnTo?: string };
  }>(
    "/v1/organizations/:organizationId/integrations/meta/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createMetaConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.returnTo === "/admin/onboarding"
          ? request.body.returnTo
          : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { returnTo?: string };
  }>(
    "/v1/organizations/:organizationId/integrations/klaviyo/connect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createKlaviyoConnectionAuthUrl(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.returnTo === "/admin/onboarding"
          ? request.body.returnTo
          : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { apiKey?: string };
  }>(
    "/v1/organizations/:organizationId/integrations/klaviyo/connect-api-key",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const apiKey = request.body?.apiKey;
      if (typeof apiKey !== "string" || !apiKey.trim()) {
        return reply.code(400).send({ error: "missing_klaviyo_api_key" });
      }
      const result = await connectKlaviyoWithApiKey(
        env,
        auth.context,
        request.params.organizationId,
        apiKey,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Desconectar Meta Ads o Klaviyo: retira el permiso en el proveedor cuando se
  // puede, borra las credenciales y lo deja en la auditoria.
  app.post<{ Params: { organizationId: string; provider: string; connectionId: string } }>(
    "/v1/organizations/:organizationId/integrations/:provider/connections/:connectionId/disconnect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const provider = request.params.provider === "meta" ? "meta_ads" : request.params.provider;
      if (provider !== "meta_ads" && provider !== "klaviyo") {
        return reply.code(404).send({ error: "disconnect_not_supported" });
      }
      const result = await disconnectIntegration(
        env,
        auth.context,
        request.params.organizationId,
        provider,
        request.params.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/klaviyo/templates",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKlaviyoTemplates(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; templateId: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/:templateId/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await previewKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        request.params.templateId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { templateId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const templateId = request.body?.templateId;
      if (typeof templateId !== "string" || !templateId.trim()) {
        return reply.code(400).send({ error: "missing_template_id" });
      }
      const result = await importKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        templateId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { draftId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/templates/push",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const draftId = request.body?.draftId;
      if (typeof draftId !== "string" || !draftId.trim()) {
        return reply.code(400).send({ error: "missing_draft_id" });
      }
      const result = await pushDraftToKlaviyoTemplate(
        env,
        auth.context,
        request.params.organizationId,
        draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Marketing con Klaviyo dentro de NORA (Hoy, Campañas, Flows, Plantillas,
  // Audiencias, Rendimiento) y las escrituras de campaña.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>("/v1/organizations/:organizationId/marketing/klaviyo", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await getMarketingKlaviyoWorkspace(env, auth.context, request.params.organizationId, {
      ...(request.query.days === undefined ? {} : { days: request.query.days }),
      ...(request.query.connectionId === undefined ? {} : { connectionId: request.query.connectionId }),
    });
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.get<{ Params: { organizationId: string; templateId: string } }>(
    "/v1/organizations/:organizationId/marketing/klaviyo/templates/:templateId/html",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMarketingKlaviyoTemplateHtml(env, auth.context, request.params.organizationId, request.params.templateId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; campaignId: string } }>(
    "/v1/organizations/:organizationId/marketing/klaviyo/campaigns/:campaignId/clicks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMarketingKlaviyoCampaignClicks(env, auth.context, request.params.organizationId, request.params.campaignId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: ScheduleCampaignInput }>(
    "/v1/organizations/:organizationId/marketing/klaviyo/campaigns",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await scheduleMarketingKlaviyoCampaign(env, auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; campaignId: string }; Body: { action?: string } }>(
    "/v1/organizations/:organizationId/marketing/klaviyo/campaigns/:campaignId/cancel",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await cancelMarketingKlaviyoCampaign(env, auth.context, request.params.organizationId, request.params.campaignId, request.body?.action);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Estudio de contenido (Marketing → Crear): autoguardado de piezas, prueba
  // al correo propio y productos para los bloques.
  app.post<{ Params: { organizationId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/studio/drafts",
    { bodyLimit: 2 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createStudioDraft(env, auth.context, request.params.organizationId, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.put<{ Params: { organizationId: string; draftId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/studio/drafts/:draftId",
    { bodyLimit: 2 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateStudioDraft(env, auth.context, request.params.organizationId, request.params.draftId, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/studio/test-send",
    { bodyLimit: 1024 * 1024, ...aiEndpointRateLimit },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await sendStudioTest(env, auth.context, request.params.organizationId, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string }; Querystring: { source?: string; q?: string; connection_id?: string } }>(
    "/v1/organizations/:organizationId/marketing/studio/products",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listStudioProducts(env, request.headers.authorization ?? "", auth.context, request.params.organizationId, request.query);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Chat con la IA del estudio: contesta y devuelve cambios para el email abierto.
  app.post<{ Params: { organizationId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/studio/ai-chat",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await chatStudioEdit(env, request.headers.authorization ?? "", auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Marketing → Flows: flows diseñados a mano y su creación en Klaviyo.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/marketing/flow-designs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listFlowDesigns(env, auth.context, request.params.organizationId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/flow-designs",
    { bodyLimit: 512 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveFlowDesign(env, auth.context, request.params.organizationId, null, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/flow-designs/preview",
    { bodyLimit: 512 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await previewFlowDesign(env, auth.context, request.params.organizationId, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.put<{ Params: { organizationId: string; designId: string }; Body: unknown }>(
    "/v1/organizations/:organizationId/marketing/flow-designs/:designId",
    { bodyLimit: 512 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveFlowDesign(env, auth.context, request.params.organizationId, request.params.designId, request.body);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; designId: string } }>(
    "/v1/organizations/:organizationId/marketing/flow-designs/:designId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteFlowDesign(env, auth.context, request.params.organizationId, request.params.designId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; designId: string } }>(
    "/v1/organizations/:organizationId/marketing/flow-designs/:designId/klaviyo",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await pushFlowDesign(env, auth.context, request.params.organizationId, request.params.designId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
    "/v1/organizations/:organizationId/klaviyo/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKlaviyoConversionMetrics(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/email-report",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getKlaviyoEmailReport(
        env,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // /klaviyo/emails: listado y ficha de un email (campaña o flujo), sobre el
  // mismo klaviyo_email_report del panel de rendimiento.
  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string; kind?: string; q?: string; sort?: string; page?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/emails",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listKlaviyoEmails(
        env,
        auth.context,
        request.params.organizationId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );
  app.get<{
    Params: { organizationId: string; emailId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/emails/:emailId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getKlaviyoEmailDetail(
        env,
        auth.context,
        request.params.organizationId,
        request.params.emailId,
        request.query,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/klaviyo/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await triggerKlaviyoSync(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(202).send(result.data);
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: {
      metricId?: string;
      connectionId?: string;
      source?: "shopify" | "klaviyo" | "custom" | "other";
    };
  }>(
    "/v1/organizations/:organizationId/klaviyo/conversion-metric",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await selectKlaviyoConversionMetric(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.metricId ?? "",
        request.body?.source ?? "klaviyo",
        request.body?.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get("/v1/meta/oauth/callback", async (request, reply) => {
    const result = await handleMetaOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  app.get("/v1/klaviyo/oauth/callback", async (request, reply) => {
    const result = await handleKlaviyoOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/assets",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listMetaAssets(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { businessIds?: unknown; pageIds?: unknown; adAccountIds?: unknown };
  }>(
    "/v1/organizations/:organizationId/meta/assets/selection",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMetaAssetSelection(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Que cuenta de Meta y de Klaviyo pertenece a que tienda Shopify. Con una
  // sola tienda la migracion ya lo resolvio sola; esto existe para el cliente
  // con varias, donde adivinarlo seria inventarse la atribucion.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/store-scope",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listStoreScope(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: StoreScopeInput;
  }>(
    "/v1/organizations/:organizationId/store-scope",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await assignStoreScope(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/purchase-action-types",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await listMetaPurchaseActionTypes(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: { adAccountId?: string; actionType?: string };
  }>(
    "/v1/organizations/:organizationId/meta/purchase-action-types",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await selectMetaPurchaseActionType(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.adAccountId ?? "",
        request.body?.actionType ?? "",
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/meta/ad-creation-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = prepareMetaAdCreationPlan(
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { days?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/meta/metrics",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMetaMetrics(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.days,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/meta/sync",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await triggerMetaSync(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(202).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
    "/v1/organizations/:organizationId/operations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listOperations(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/operations/run-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await evaluateAlertRules(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      title?: string;
      description?: string;
      priority?: string;
      category?: string;
      dueAt?: string;
      isVisibleToClient?: boolean;
      milestoneId?: string | null;
      assignedTo?: string | null;
      connectionId?: string | null;
    };
  }>("/v1/organizations/:organizationId/tasks", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createTask(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/task-assignees",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listTaskAssignees(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; taskId: string };
    Body: { assignedTo?: string | null; dueAt?: string | null };
  }>(
    "/v1/organizations/:organizationId/tasks/:taskId/assignment",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateTaskAssignment(
        env,
        auth.context,
        request.params.organizationId,
        request.params.taskId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; taskId: string };
    Body: { status?: string; reason?: string; outcome?: unknown };
  }>(
    "/v1/organizations/:organizationId/tasks/:taskId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateTaskStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.taskId,
        request.body?.status,
        request.body?.reason,
        request.body?.outcome,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; taskId: string };
    Body: { body?: string; isInternal?: boolean };
  }>(
    "/v1/organizations/:organizationId/tasks/:taskId/comments",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addTaskComment(
        env,
        auth.context,
        request.params.organizationId,
        request.params.taskId,
        request.body?.body,
        request.body?.isInternal,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Notas del consultor ancladas a tarjetas del panel (zone-notes.ts).
  app.get<{ Params: { organizationId: string }; Querystring: { connectionId?: string } }>(
    "/v1/organizations/:organizationId/zone-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listZoneNotes(env, auth.context, request.params.organizationId, request.query?.connectionId ?? null);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: { anchor?: string; body?: string; expiresAt?: string | null; connectionId?: string | null };
  }>(
    "/v1/organizations/:organizationId/zone-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createZoneNote(env, auth.context, request.params.organizationId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string; noteId: string } }>(
    "/v1/organizations/:organizationId/zone-notes/:noteId/seen",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await markZoneNoteSeen(env, auth.context, request.params.organizationId, request.params.noteId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; noteId: string } }>(
    "/v1/organizations/:organizationId/zone-notes/:noteId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await archiveZoneNote(env, auth.context, request.params.organizationId, request.params.noteId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; alertId: string };
    Body: { status?: string };
  }>(
    "/v1/organizations/:organizationId/alerts/:alertId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateAlertStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.alertId,
        request.body?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Configuracion de avisos por cliente. El motor (`runAlertRules`) ya lee
  // `organization_alert_rules`; estas son las rutas que faltaban para poder
  // escribir en ella.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/alert-rules",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listAlertRules(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string; templateId: string };
    Body: {
      isEnabled?: boolean;
      severity?: string | null;
      threshold?: number | null;
    };
  }>(
    "/v1/organizations/:organizationId/alert-rules/:templateId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await upsertAlertRule(
        env,
        auth.context,
        request.params.organizationId,
        request.params.templateId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Querystring: { status?: string } }>(
    "/v1/notifications",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listNotifications(
        env,
        authorization,
        request.query?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{ Params: { notificationId: string }; Body: { status?: string } }>(
    "/v1/notifications/:notificationId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await updateNotificationStatus(
        env,
        authorization,
        request.params.notificationId,
        request.body?.status,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post("/v1/notifications/read-all", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await markAllNotificationsRead(env, authorization);

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/routes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getCaminoRoutes(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getStrategicPlan(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/weekly-review/retry",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await retryCaminoWeeklyReviewAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.query.connectionId,
      );
      if ("skipped" in result) return result;
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string; proposalId: string };
    Body: {
      action?: string;
      reason?: string;
      expected_last_event_id?: string | null;
      edited_proposal?: {
        description?: string;
        reason?: string;
        evidence?: string;
        target_id?: string | null;
      };
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/proposals/:proposalId/action",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await recordCaminoChangeProposalAction(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.params.proposalId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      name?: string;
      description?: string | null;
      storeId?: string | null;
      connectionId?: string | null;
      phases?: Array<{
        name?: string;
        description?: string | null;
        milestones?: Array<{
          name?: string;
          description?: string | null;
          targetDate?: string | null;
        }>;
      }>;
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createStrategicPlan(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string };
    Body: { name?: string; description?: string | null };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/phases",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createPhase(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        {
          name: request.body?.name,
          description: request.body?.description,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; planId: string };
    Body: { orderedIds?: string[] };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/phases/reorder",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await reorderPhases(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.body?.orderedIds,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; phaseId: string };
    Body: { orderedIds?: string[] };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId/milestones/reorder",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await reorderMilestones(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        request.body?.orderedIds,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; phaseId: string };
    Body: {
      name?: string;
      description?: string | null;
      targetDate?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId/milestones",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createMilestone(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        {
          name: request.body?.name,
          description: request.body?.description,
          targetDate: request.body?.targetDate,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; planId: string };
    Body: { currency_code?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/currency",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updatePlanCurrency(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.body?.currency_code,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; planId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/archive",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await archiveStrategicPlan(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/activate",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await activateStrategicPlan(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; planId: string };
    Body: { name?: string; description?: string | null };
  }>("/v1/organizations/:organizationId/strategic-plan/:planId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await updateStrategicPlan(env, auth.context, request.params.organizationId, request.params.planId, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.delete<{ Params: { organizationId: string; planId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteStrategicPlan(env, auth.context, request.params.organizationId, request.params.planId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; milestoneId: string };
    Body: { status?: string; completion_note?: string; completion_mode?: string };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMilestoneStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        request.body?.status,
        request.body?.completion_note,
        request.headers.authorization,
        request.body?.completion_mode,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; phaseId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deletePhase(env, auth.context, request.params.organizationId, request.params.phaseId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; milestoneId: string } }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getMilestoneInternalNotes(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; milestoneId: string };
    Body: { body?: string };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addMilestoneInternalNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        request.body?.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string; connectionId?: string };
  }>("/v1/organizations/:organizationId/objectives", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await getObjectives(
      env,
      authorization,
      auth.context,
      request.params.organizationId,
      request.query.storeId || null,
      request.query.connectionId || undefined,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.post<{
    Params: { organizationId: string };
    Body: {
      metricKey?: string;
      targetValue?: number;
      period?: string;
      storeId?: string | null;
      milestoneId?: string | null;
    };
  }>("/v1/organizations/:organizationId/objectives", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createObjective(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.delete<{ Params: { organizationId: string; targetId: string } }>(
    "/v1/organizations/:organizationId/objectives/:targetId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await deactivateObjective(
        env,
        auth.context,
        request.params.organizationId,
        request.params.targetId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; targetId: string };
    Body: { value?: number };
  }>(
    "/v1/organizations/:organizationId/objectives/:targetId/actual",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await setObjectiveActual(
        env,
        auth.context,
        request.params.organizationId,
        request.params.targetId,
        request.body?.value,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; planId: string };
    Body: { target?: number | null; reason?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/goal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updatePlanGoalTarget(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; milestoneId: string } }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await deleteMilestone(env, auth.context, request.params.organizationId, request.params.milestoneId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; milestoneId: string; taskId: string };
    Body: { title?: string; description?: string | null; priority?: string; dueAt?: string | null };
  }>("/v1/organizations/:organizationId/strategic-plan/milestones/:milestoneId/tasks/:taskId", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await updateMilestoneTask(env, auth.context, request.params.organizationId, request.params.milestoneId, request.params.taskId, request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return result.data;
  });

  app.delete<{ Params: { organizationId: string; milestoneId: string; taskId: string } }>(
    "/v1/organizations/:organizationId/strategic-plan/milestones/:milestoneId/tasks/:taskId", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await unlinkMilestoneTask(env, auth.context, request.params.organizationId, request.params.milestoneId, request.params.taskId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Tipos de objetivo (catalogo editable del consultor) --------------------
  app.get("/v1/consultant/objective-definitions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }
    if (!request.headers.authorization) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }

    const result = await listObjectiveDefinitions(
      env,
      request.headers.authorization,
      auth.context,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  app.post<{
    Body: {
      label?: string;
      unit?: string;
      direction?: string;
      source?: string;
      metricKey?: string | null;
      organizationId?: string | null;
    };
  }>("/v1/consultant/objective-definitions", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createObjectiveDefinition(
      env,
      auth.context,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.patch<{
    Params: { definitionId: string };
    Body: { label?: string; unit?: string; direction?: string };
  }>(
    "/v1/consultant/objective-definitions/:definitionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateObjectiveDefinition(
        env,
        auth.context,
        request.params.definitionId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.delete<{ Params: { definitionId: string } }>(
    "/v1/consultant/objective-definitions/:definitionId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await archiveObjectiveDefinition(
        env,
        auth.context,
        request.params.definitionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; milestoneId: string };
    Body: {
      taskId?: string;
      title?: string;
      description?: string | null;
      priority?: string;
      dueAt?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId/tasks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      // Dos modos: enlazar una tarea ya existente (taskId) o crearla directamente
      // con el contexto del hito (title) -- el consultor/IA que compone Mi Camino
      // usa el segundo para no tener que crear la tarea aparte y volver a enlazarla.
      const result = request.body?.taskId
        ? await linkTaskToMilestone(
            env,
            auth.context,
            request.params.organizationId,
            request.params.milestoneId,
            request.body.taskId,
          )
        : await createMilestoneTask(
            env,
            auth.context,
            request.params.organizationId,
            request.params.milestoneId,
            {
              title: request.body?.title,
              description: request.body?.description,
              priority: request.body?.priority,
              dueAt: request.body?.dueAt,
            },
          );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; phaseId: string };
    Body: { name?: string; description?: string | null };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/phases/:phaseId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updatePhase(
        env,
        auth.context,
        request.params.organizationId,
        request.params.phaseId,
        {
          name: request.body?.name,
          description: request.body?.description,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; milestoneId: string };
    Body: {
      name?: string;
      description?: string | null;
      targetDate?: string | null;
      successCriteria?: string | null;
      rationale?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/milestones/:milestoneId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateMilestone(
        env,
        auth.context,
        request.params.organizationId,
        request.params.milestoneId,
        {
          name: request.body?.name,
          description: request.body?.description,
          targetDate: request.body?.targetDate,
          successCriteria: request.body?.successCriteria,
          rationale: request.body?.rationale,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get("/v1/agents/eval-readiness", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }
    if (
      !["platform_admin", "consultant"].includes(
        auth.context.profile.platform_role,
      )
    ) {
      return reply
        .code(403)
        .send({ error: "agent_eval_readiness_access_denied" });
    }
    return reply.send(await getAgentEvalReadiness(env));
  });

  // A02: GET es de solo lectura. Devuelve el último resultado aunque esté
  // obsoleto; el cron o la acción POST explícita son quienes pueden generarlo.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string; view?: string };
  }>("/v1/organizations/:organizationId/ai/monitor", async (request, reply) => {
    if (request.query.view && !isMonitorDashboardScope(request.query.view)) {
      return reply.code(400).send({ error: "invalid_monitor_dashboard_scope" });
    }
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await getMonitorDiagnostic(
      env,
      auth.context,
      request.params.organizationId,
      request.query.connectionId,
      request.query.days ? Number(request.query.days) : null,
      request.query.view && isMonitorDashboardScope(request.query.view)
        ? request.query.view
        : "overview",
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return result.data;
  });

  // Compatibilidad: la generación manual de A02 está deshabilitada; solo corre el orquestador.
  app.post<{
    Params: { organizationId: string };
  }>("/v1/organizations/:organizationId/ai/monitor-run", async (_request, reply) =>
    reply.code(410).send({ error: "monitor_manual_refresh_disabled" }),
  );

  // AI-05 (A04): plan de tareas automatico, mismo patron de cache/regenerar que A02.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/task-planner",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getTaskPlannerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/task-planner-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const rawIdempotencyKey = request.headers["idempotency-key"];
      if (Array.isArray(rawIdempotencyKey) || (rawIdempotencyKey && rawIdempotencyKey.trim().length > 128)) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }
      const idempotencyKey = rawIdempotencyKey?.trim() || null;

      const result = await runTaskPlannerAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
        { manualRequestKey: idempotencyKey },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Planes semanal (A17) y mensual (A18): mismo par de rutas que A04, con el
  // horizonte en la ruta. El reparto dia/semana/mes lo enseña el prompt de cada
  // agente; aqui solo se elige cual corre.
  app.get<{
    Params: { organizationId: string; horizon: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/plan/:horizon",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!isPlanHorizon(request.params.horizon)) {
        return reply.code(400).send({ error: "invalid_plan_horizon" });
      }

      const result = await getPlanDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.params.horizon,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; horizon: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/plan/:horizon/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (!isPlanHorizon(request.params.horizon)) {
        return reply.code(400).send({ error: "invalid_plan_horizon" });
      }

      const rawIdempotencyKey = request.headers["idempotency-key"];
      if (Array.isArray(rawIdempotencyKey) || (rawIdempotencyKey && rawIdempotencyKey.trim().length > 128)) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }
      const idempotencyKey = rawIdempotencyKey?.trim() || null;

      const result = await runPlanAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.params.horizon,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
        request.params.horizon === "day" ? { manualRequestKey: idempotencyKey } : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // A19: propuesta de CAMINO (plan estrategico completo) para un horizonte.
  // No se autogenera al abrir la pantalla como los diagnosticos: el GET solo
  // recupera la propuesta que ya exista, el POST es el que gasta modelo.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-context",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getCaminoIntakeContext(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Body: unknown;
  }>(
    "/v1/organizations/:organizationId/ai/camino-context",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveCaminoIntakeContext(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Body: unknown;
  }>(
    "/v1/organizations/:organizationId/ai/camino-context/assessment",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await assessCaminoIntake(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; planId: string; reviewId: string; learningIndex: string };
    Querystring: { connectionId?: string };
    Body: { decision?: string; title?: string; learning?: string; applies_to?: string };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/:planId/weekly-review/:reviewId/learnings/:learningIndex/approve",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await approveCaminoReviewLearning(
        env,
        auth.context,
        request.params.organizationId,
        request.params.planId,
        request.query.connectionId,
        request.params.reviewId,
        Number(request.params.learningIndex),
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { horizonMonths?: string; connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const horizonMonths =
        request.query.horizonMonths === undefined
          ? undefined
          : parseCaminoDurationMonths(request.query.horizonMonths);
      if (request.query.horizonMonths !== undefined && horizonMonths === null) {
        return reply.code(400).send({ error: "invalid_camino_horizon" });
      }
      const result = await getCaminoProposal(
        env,
        auth.context,
        request.params.organizationId,
        horizonMonths ?? undefined,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; since?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-proposal/progress",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const since = Number(request.query.since);
      const result = await getCaminoProposalProgress(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        Number.isFinite(since) && since > 0 ? since : undefined,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; async?: string };
    Body: { horizon?: string; horizon_months?: number; brief?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-proposal/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const requestedHorizon =
        request.body?.horizon_months ?? request.body?.horizon ?? "";
      const horizonMonths = parseCaminoDurationMonths(requestedHorizon);
      if (horizonMonths === null) {
        return reply.code(400).send({ error: "invalid_camino_horizon" });
      }

      // Con ?async=1 el run corre en segundo plano y la pantalla consulta el
      // progreso: un camino tarda minutos y una peticion abierta tanto tiempo
      // la corta cualquier proxy.
      if (request.query.async === "1") {
        const started = await startCaminoProposalRun(
          env,
          auth.context,
          request.params.organizationId,
          horizonMonths,
          request.query.connectionId,
          typeof request.body?.brief === "string" ? request.body.brief.slice(0, 2000) : null,
        );
        if (isServiceFailure(started)) return sendServiceFailure(reply, started);
        return reply.code(202).send(started.data);
      }

      const result = await runCaminoArchitectAgent(
        env,
        auth.context,
        request.params.organizationId,
        horizonMonths,
        request.query.connectionId,
        undefined,
        typeof request.body?.brief === "string"
          ? request.body.brief.slice(0, 2000)
          : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; outputId: string };
    Body: { reason?: string };
  }>(
    "/v1/organizations/:organizationId/ai/camino-proposal/:outputId/reject",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await rejectCaminoProposalOutput(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
        typeof request.body?.reason === "string" ? request.body.reason : "",
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Aceptar la propuesta: crea el plan real en estado borrador. Activarlo
  // sigue siendo un segundo gesto humano (activateStrategicPlan).
  app.post<{
    Params: { organizationId: string };
    Body: {
      output_id?: string;
      horizon_months?: number;
      goal_target?: number | null;
      currency_code?: string;
      replace_plan_id?: string;
      /** Campañas de A05 (borrador) que se llevan al calendario y al Camino al aceptarlo. */
      campaign_output_id?: string;
      campaign_selected_indexes?: number[];
    };
  }>(
    "/v1/organizations/:organizationId/strategic-plan/from-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const outputId = request.body?.output_id;
      if (!outputId) {
        return reply.code(400).send({ error: "output_id_requerido" });
      }

      const result = await createStrategicPlanFromProposal(
        env,
        auth.context,
        request.params.organizationId,
        outputId,
        {
          horizonMonths: request.body?.horizon_months,
          currencyCode: request.body?.currency_code,
          replacePlanId: request.body?.replace_plan_id,
          ...(Object.prototype.hasOwnProperty.call(
            request.body ?? {},
            "goal_target",
          )
            ? { goalTarget: request.body?.goal_target }
            : {}),
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      // Las campañas aprobadas junto al Camino entran en el calendario y, ya
      // existiendo el plan, tambien como tareas de sus hitos. Un fallo aqui no
      // deshace el Camino: se devuelve para que la pantalla lo cuente.
      let campaigns: unknown = null;
      if (request.body?.campaign_output_id) {
        const applied = await createCampaignItemsFromProposal(env, auth.context, request.params.organizationId, {
          outputId: request.body.campaign_output_id,
          selectedIndexes: request.body.campaign_selected_indexes,
          expectedStoreId: result.data.store_id,
        });
        campaigns = isServiceFailure(applied)
          ? { ok: false, error: applied.error, message: (applied as { message?: string }).message ?? null }
          : { ok: true, ...applied.data };
      }

      return reply.code(201).send({ ...result.data, campaigns });
    },
  );

  // A05: propuesta de PLAN DE CAMPANAS para un horizonte. Mismo patron que el
  // camino: el GET solo recupera lo que ya exista, el POST gasta modelo, y una
  // tercera ruta materializa lo aprobado -- aqui, como items del calendario.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/campaign-plan",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getCampaignPlanProposal(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Body: {
      horizon?: string;
      brief?: string;
      start_date?: string;
      end_date?: string;
      market?: string;
    };
  }>(
    "/v1/organizations/:organizationId/ai/campaign-plan/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const horizon = request.body?.horizon ?? "";
      if (!isCampaignPlanHorizon(horizon)) {
        return reply.code(400).send({ error: "invalid_campaign_plan_horizon" });
      }

      const rawIdempotencyKey = request.headers["idempotency-key"];
      if (Array.isArray(rawIdempotencyKey) || (rawIdempotencyKey && rawIdempotencyKey.trim().length > 128)) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }

      const result = await runCampaignStrategist(
        env,
        auth.context,
        request.params.organizationId,
        horizon,
        request.query.connectionId,
        { manualRequestKey: rawIdempotencyKey?.trim() || null },
        typeof request.body?.brief === "string"
          ? request.body.brief.slice(0, 2000)
          : null,
        {
          startDate: request.body?.start_date ?? null,
          endDate: request.body?.end_date ?? null,
          market: request.body?.market ?? null,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; outputId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/campaign-plan/:outputId/reject",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await rejectCampaignPlanProposal(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // Guardado automático tras proponer: solo deja las iniciativas fechadas en
  // el calendario interno, sin aprobar ni publicar la salida del agente.
  app.post<{
    Params: { organizationId: string };
    Body: { output_id?: string; calendar_id?: string; selected_indexes?: number[] };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/from-proposal/drafts",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await createCampaignItemsFromProposal(
        env,
        auth.context,
        request.params.organizationId,
        {
          outputId: request.body?.output_id,
          calendarId: request.body?.calendar_id,
          selectedIndexes: request.body?.selected_indexes,
          mode: "draft",
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Aceptar (total o parcialmente): crea las campañas elegidas y aprueba el plan.
  app.post<{
    Params: { organizationId: string };
    Body: {
      output_id?: string;
      calendar_id?: string;
      selected_indexes?: number[];
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/from-proposal",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createCampaignItemsFromProposal(
        env,
        auth.context,
        request.params.organizationId,
        {
          outputId: request.body?.output_id,
          calendarId: request.body?.calendar_id,
          selectedIndexes: request.body?.selected_indexes,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-05 (A06): plan de reposicion de stock automatico, mismo patron.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/stock-planner",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getStockPlannerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string; days?: string };
  }>(
    "/v1/organizations/:organizationId/ai/stock-planner-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const rawIdempotencyKey = request.headers["idempotency-key"];
      if (Array.isArray(rawIdempotencyKey) || (rawIdempotencyKey && rawIdempotencyKey.trim().length > 128)) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }

      const result = await runStockPlannerAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
        request.query.days ? Number(request.query.days) : null,
        { manualRequestKey: rawIdempotencyKey?.trim() || null },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-05 (A08): gestor de conocimiento automatico, mismo patron.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/knowledge-manager",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getKnowledgeManagerDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/knowledge-manager-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const rawIdempotencyKey = request.headers["idempotency-key"];
      if (Array.isArray(rawIdempotencyKey) || (rawIdempotencyKey && rawIdempotencyKey.trim().length > 128)) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }
      const result = await runKnowledgeManagerAgent(
        env,
        auth.context,
        request.params.organizationId,
        { manualRequestKey: rawIdempotencyKey?.trim() || null },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI (A12): analista de email marketing (Klaviyo), mismo patron read-only.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/email-analyst",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getEmailAnalystDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId || null,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Headers: { "idempotency-key"?: string };
  }>(
    "/v1/organizations/:organizationId/ai/email-analyst-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const idempotencyKey = request.headers["idempotency-key"]?.trim();
      if (idempotencyKey && idempotencyKey.length > 128) {
        return reply.code(400).send({ error: "invalid_idempotency_key" });
      }

      const result = await runEmailAnalystAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId || null,
        {
          trigger: "manual",
          enforceManualRefreshCap: true,
          manualRequestKey: idempotencyKey ?? null,
        },
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // A28: arquitectura propuesta de flows; lectura e informe, sin mutaciones Klaviyo.
  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/ai/klaviyo-flow-architect",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getKlaviyoFlowArchitectDiagnostic(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId || null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
    Headers: { "idempotency-key"?: string };
  }>(
    "/v1/organizations/:organizationId/ai/klaviyo-flow-architect-run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const idempotencyKey = request.headers["idempotency-key"]?.trim() || null;
      if (idempotencyKey && idempotencyKey.length > 128) return reply.code(400).send({ error: "invalid_idempotency_key" });
      const result = await runKlaviyoFlowArchitectAgent(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connectionId || null,
        { trigger: "manual", enforceManualRefreshCap: true, manualRequestKey: idempotencyKey },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // AI (A13/A14): operativa por canal para el consultor. Mismo patron: GET
  // sirve cache (lo regenera el orquestador), POST -run fuerza una ejecucion.
  for (const agent of [
    {
      slug: "operativa-shopify",
      get: getOperativaShopifyDiagnostic,
      run: runOperativaShopifyAgent,
    },
    {
      slug: "operativa-meta",
      get: getOperativaMetaDiagnostic,
      run: runOperativaMetaAgent,
    },
    // A20/A21/A22: especialistas del modulo de Shopify. Mismo contrato que la
    // operativa por canal, asi que entran en el mismo bucle en vez de repetir
    // seis endpoints identicos.
    {
      slug: "retencion-clientes",
      get: getRetencionClientesDiagnostic,
      run: runRetencionClientesAgent,
    },
    {
      slug: "adquisicion-shopify",
      get: getAdquisicionShopifyDiagnostic,
      run: runAdquisicionShopifyAgent,
    },
    {
      slug: "postventa-shopify",
      get: getPostventaShopifyDiagnostic,
      run: runPostventaShopifyAgent,
    },
    // A23/A24/A25: especialistas del modulo de Meta, mismo contrato.
    {
      slug: "creatividad-meta",
      get: getCreatividadMetaDiagnostic,
      run: runCreatividadMetaAgent,
    },
    {
      slug: "medicion-meta",
      get: getMedicionMetaDiagnostic,
      run: runMedicionMetaAgent,
    },
    {
      slug: "cambios-meta",
      get: getCambiosMetaDiagnostic,
      run: runCambiosMetaAgent,
    },
    // A26: contenido del email. Mismo contrato que los especialistas de Meta.
    {
      slug: "contenido-email",
      get: getContenidoEmailDiagnostic,
      run: runContenidoEmailAgent,
    },
  ] as const) {
    app.get<{
      Params: { organizationId: string };
      Querystring: { connectionId?: string };
    }>(
      `/v1/organizations/:organizationId/ai/${agent.slug}`,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) {
          return sendAuthFailure(reply, auth.error);
        }
        const fallbackGet = (
          agent as unknown as {
            get: (
              apiEnv: Parameters<typeof getMedicionMetaDiagnostic>[0],
              authContext: Parameters<typeof getMedicionMetaDiagnostic>[1],
              orgId: string,
            ) => Promise<any>;
          }
        ).get;
        const result =
          agent.slug === "operativa-shopify"
            ? await getOperativaShopifyDiagnostic(
                env,
                auth.context,
                request.params.organizationId,
                request.query.connectionId,
              )
            : agent.slug === "operativa-meta"
              ? await getOperativaMetaDiagnostic(
                  env,
                  auth.context,
                  request.params.organizationId,
                  request.query.connectionId,
                )
              : agent.slug === "adquisicion-shopify"
                ? await getAdquisicionShopifyDiagnostic(
                    env,
                    auth.context,
                    request.params.organizationId,
                    request.query.connectionId,
                  )
                : agent.slug === "retencion-clientes"
                  ? await getRetencionClientesDiagnostic(
                      env,
                      auth.context,
                      request.params.organizationId,
                      request.query.connectionId,
                    )
                  : agent.slug === "postventa-shopify"
                    ? await getPostventaShopifyDiagnostic(
                        env,
                        auth.context,
                        request.params.organizationId,
                        request.query.connectionId,
                      )
                    : agent.slug === "contenido-email"
                      ? await getContenidoEmailDiagnostic(
                          env,
                          auth.context,
                          request.params.organizationId,
                          request.query.connectionId,
                        )
                      : agent.slug === "creatividad-meta"
                        ? await getCreatividadMetaDiagnostic(
                            env,
                            auth.context,
                            request.params.organizationId,
                            request.query.connectionId,
                          )
                        : agent.slug === "medicion-meta"
                          ? await getMedicionMetaDiagnostic(
                              env,
                              auth.context,
                              request.params.organizationId,
                              request.query.connectionId,
                            )
                          : agent.slug === "cambios-meta"
                            ? await getCambiosMetaDiagnostic(
                                env,
                                auth.context,
                                request.params.organizationId,
                                request.query.connectionId,
                              )
                            : await fallbackGet(
                                env,
                                auth.context,
                                request.params.organizationId,
                              );
        if (isServiceFailure(result)) {
          return sendServiceFailure(reply, result);
        }
        return result.data;
      },
    );

    app.post<{
      Params: { organizationId: string };
      Querystring: { connectionId?: string };
      Headers: { "idempotency-key"?: string };
    }>(
      `/v1/organizations/:organizationId/ai/${agent.slug}-run`,
      aiEndpointRateLimit,
      async (request, reply) => {
        const auth = await resolveAuthContext(
          env,
          request.headers.authorization,
        );
        if (isAuthContextError(auth)) {
          return sendAuthFailure(reply, auth.error);
        }
        const idempotencyKey = request.headers["idempotency-key"]?.trim() || null;
        if (idempotencyKey && idempotencyKey.length > 128) {
          return reply.code(400).send({ error: "invalid_idempotency_key" });
        }
        const fallbackRun = (
          agent as unknown as {
            run: (
              apiEnv: Parameters<typeof runMedicionMetaAgent>[0],
              authContext: Parameters<typeof runMedicionMetaAgent>[1],
              orgId: string,
            ) => Promise<any>;
          }
        ).run;
        const result =
          agent.slug === "operativa-shopify"
            ? await runOperativaShopifyAgent(
                env,
                auth.context,
                request.params.organizationId,
                { manualRequestKey: idempotencyKey },
                request.query.connectionId,
              )
            : agent.slug === "operativa-meta"
              ? await runOperativaMetaAgent(
                  env,
                  auth.context,
                  request.params.organizationId,
                  { manualRequestKey: idempotencyKey },
                  request.query.connectionId,
                )
              : agent.slug === "adquisicion-shopify"
                ? await runAdquisicionShopifyAgent(
                    env,
                    auth.context,
                    request.params.organizationId,
                    undefined,
                    request.query.connectionId,
                  )
                : agent.slug === "retencion-clientes"
                  ? await runRetencionClientesAgent(
                      env,
                      auth.context,
                      request.params.organizationId,
                      undefined,
                      request.query.connectionId,
                    )
                  : agent.slug === "postventa-shopify"
                    ? await runPostventaShopifyAgent(
                        env,
                        auth.context,
                        request.params.organizationId,
                        undefined,
                        request.query.connectionId,
                      )
                    : agent.slug === "contenido-email"
                      ? await runContenidoEmailAgent(
                          env,
                          auth.context,
                          request.params.organizationId,
                          { manualRequestKey: idempotencyKey },
                          request.query.connectionId,
                        )
                      : agent.slug === "creatividad-meta"
                        ? await runCreatividadMetaAgent(
                            env,
                            auth.context,
                            request.params.organizationId,
                            { manualRequestKey: idempotencyKey },
                            request.query.connectionId,
                          )
                        : agent.slug === "medicion-meta"
                          ? await runMedicionMetaAgent(
                              env,
                              auth.context,
                              request.params.organizationId,
                              { manualRequestKey: idempotencyKey },
                              request.query.connectionId,
                            )
                          : agent.slug === "cambios-meta"
                            ? await runCambiosMetaAgent(
                                env,
                                auth.context,
                                request.params.organizationId,
                                { manualRequestKey: idempotencyKey },
                                request.query.connectionId,
                              )
                            : await fallbackRun(
                                env,
                                auth.context,
                                request.params.organizationId,
                              );
        if (isServiceFailure(result)) {
          return sendServiceFailure(reply, result);
        }
        return reply.code(201).send(result.data);
      },
    );
  }

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/budget",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (
        !auth.context.memberships.some(
          (membership) =>
            membership.organization_id === request.params.organizationId,
        )
  ) {
        return reply.code(403).send({ error: "organization_access_denied" });
      }

      const result = await getOrganizationDailyBudgetStatusForOrganization(
        env,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/ai/runs",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listAgentRuns(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; runId: string } }>(
    "/v1/organizations/:organizationId/ai/runs/:runId/trace",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await getAgentRunTrace(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.runId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; runId: string; judgmentId: string };
    Body: unknown;
  }>(
    "/v1/organizations/:organizationId/ai/runs/:runId/judgments/:judgmentId/feedback",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await submitAgentJudgeFeedback(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.runId,
        request.params.judgmentId,
        request.body,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.post<{ Params: { organizationId: string; reviewId: string }; Body: Record<string, unknown> }>(
    "/v1/organizations/:organizationId/ai/content-reviews/:reviewId/outcome",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await recordA26ReviewOutcome(env, auth.context, request.params.organizationId, request.params.reviewId, request.body ?? {});
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.get<{
    Params: { organizationId: string; runId: string; fileName: string };
  }>(
    "/v1/organizations/:organizationId/ai/runs/:runId/email-render/:fileName",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await getA26EmailRenderCapture(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.runId,
        request.params.fileName,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply
        .header("Cache-Control", "private, no-store")
        .header("X-Content-Type-Options", "nosniff")
        .type("image/png")
        .send(result.data.capture);
    },
  );

  app.post<{
    Params: { organizationId: string; outputId: string };
    // `edits`: el consultor reescribe o descarta propuestas sueltas antes de
    // que se creen como tareas reales (ver ProposedWriteEdit en ai-runtime).
    Body: {
      decision?: string;
      reason?: string;
      reason_category?: string;
      edits?: ProposedWriteEdit[];
    };
  }>(
    "/v1/organizations/:organizationId/ai/outputs/:outputId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await decideAgentOutput(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
        request.body?.decision,
        request.body?.reason,
        Array.isArray(request.body?.edits) ? request.body.edits : undefined,
        request.body?.reason_category,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Propuesta de la IA en solo lectura, con su decision (destino de los avisos).
  app.get<{ Params: { organizationId: string; outputId: string } }>(
    "/v1/organizations/:organizationId/ai/outputs/:outputId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }
      const result = await getAgentOutputDetail(
        env,
        auth.context,
        request.params.organizationId,
        request.params.outputId,
      );
      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }
      return result.data;
    },
  );

  // AI-11 Fase A: borradores Klaviyo sanitizados. No conecta, publica ni
  // envía contenido al proveedor; requiere aprobación antes de quedar listos
  // para copiar manualmente.
  app.post<{
    Params: { organizationId: string };
    Body: {
      content_type?: string;
      channel?: string;
      brief?: string;
      idempotency_key?: string;
      camino_task_id?: string;
      campaign_item_id?: string;
      mailing_sequence_id?: string;
      mailing_email_number?: number;
      store_id?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await runMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { store_connection_id?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/brand-profile",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMarketingBrandProfile(
        env,
        auth.context,
        request.params.organizationId,
        request.query.store_connection_id || null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/brand-profile",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await saveMarketingBrandProfile(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string }; Querystring: {
    store_connection_id?: string; before_created_at?: string; before_id?: string;
  } }>("/v1/organizations/:organizationId/marketing/weekly-mailing-plan", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await listWeeklyMailingPlanSequences(env, auth.context, request.params.organizationId, request.query);
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.send(result.data);
  });

  // A27 decide el arco de una secuencia de email con el historial de la
  // tienda. Esta ruta solo crea un output de plan pendiente de aprobacion; el
  // cliente sigue usando A11 para transformar cada paso en un borrador y no
  // existe ningun envio ni publicacion desde aqui.
  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await runWeeklyMailingPlanner(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send({
        ...result.data,
        mailing_graph_enabled: isMailingGraphEnabled(env, request.params.organizationId),
      });
    },
  );

  app.get<{
    Params: { organizationId: string; sequenceId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getWeeklyMailingPlanSequence(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send({
        ...result.data,
        mailing_graph_enabled: isMailingGraphEnabled(env, request.params.organizationId),
      });
    },
  );

  app.get<{ Params: { organizationId: string; sequenceId: string } }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/delivery", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMailingDelivery(env, auth.context, request.params.organizationId, request.params.sequenceId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    });
  app.get<{ Params: { organizationId: string; sequenceId: string }; Querystring: { after_id?: string } }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/delivery-candidates", async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listMailingDeliveryCandidates(env, auth.context, request.params.organizationId, request.params.sequenceId, request.query.after_id);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    });
  app.post<{ Params: { organizationId: string; sequenceId: string; sequenceNumber: string }; Body: {
    revision?: unknown; draft_id?: unknown; draft_version?: unknown; message_id?: unknown;
  } }>("/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/emails/:sequenceNumber/delivery", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);
    if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
    const result = await linkMailingDelivery(env, auth.context, request.params.organizationId, request.params.sequenceId,
      Number(request.params.sequenceNumber), request.body ?? {});
    if (isServiceFailure(result)) return sendServiceFailure(reply, result);
    return reply.send(result.data);
  });

  // ADR-0025: campaña de mailing orquestada con LangGraph (flag
  // MAILING_GRAPH_ENABLED). Arranca tras aprobar la estrategia de A27; cada
  // borrador se aprueba por la ruta de borradores de siempre.
  app.post<{
    Params: { organizationId: string; sequenceId: string };
    Body: { scheduled_for?: unknown; revision?: unknown };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/run",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await startMailingCampaign(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(202).send(result.data);
    },
  );

  app.get<{
    Params: { organizationId: string; sequenceId: string };
    Querystring: { store_id?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/campaign",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getMailingCampaign(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
        request.query.store_id || null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; sequenceId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/resume",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await resumeMailingCampaign(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(202).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; sequenceId: string; sequenceNumber: string };
    Body: { decision?: unknown; reason?: unknown };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/emails/:sequenceNumber/review",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const sequenceNumber = Number(request.params.sequenceNumber);
      if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 7) {
        return reply.code(400).send({ error: "mailing_sequence_number_invalid" });
      }
      const result = await reviewMailingCampaignEmail(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
        sequenceNumber,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  // ADR-0025: reintentar o descartar un email que fallo (A11, presupuesto, programar).
  app.post<{
    Params: { organizationId: string; sequenceId: string; sequenceNumber: string };
    Body: { decision?: unknown };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/emails/:sequenceNumber/retry",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const sequenceNumber = Number(request.params.sequenceNumber);
      if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1 || sequenceNumber > 7) {
        return reply.code(400).send({ error: "mailing_sequence_number_invalid" });
      }
      const result = await decideFailedMailingEmail(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
        sequenceNumber,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; sequenceId: string };
    Body: { status?: unknown; revision?: unknown };
  }>(
    "/v1/organizations/:organizationId/marketing/weekly-mailing-plan/:sequenceId/status",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const status = request.body?.status;
      if (
        status !== "in_progress" &&
        status !== "completed" &&
        status !== "abandoned"
      ) {
        return reply
          .code(400)
          .send({ error: "weekly_mailing_sequence_status_invalid" });
      }
      const result = await updateWeeklyMailingPlanSequenceStatus(
        env,
        auth.context,
        request.params.organizationId,
        request.params.sequenceId,
        status,
        request.body?.revision,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.send(result.data);
    },
  );

  // Guardar una plantilla del editor visual como borrador (sin IA).
  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/manual",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await saveManualMarketingDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // Subir una imagen (base64) desde el ordenador para un bloque del editor.
  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/assets",
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await uploadMarketingAsset(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  // --- Banco de imágenes de Instagram (módulo Marketing, vista cliente) ---

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank",
    { bodyLimit: 8 * 1024 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await enqueueInstagramImage(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank-stores",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) return reply.code(401).send({ error: "missing_bearer_token" });
      const result = await listVisualAssetStores(env, authorization, auth.context, request.params.organizationId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { store_id?: string; store_connection_id?: string; cursor?: string; limit?: string; search?: string };
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listInstagramImageBank(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        {
          ...(request.query.store_id ? { storeId: request.query.store_id } : {}),
          ...(request.query.store_connection_id ? { storeConnectionId: request.query.store_connection_id } : {}),
          ...(request.query.cursor ? { cursor: request.query.cursor } : {}),
          ...(request.query.limit ? { limit: Number(request.query.limit) } : {}),
          ...(request.query.search ? { search: request.query.search } : {}),
        },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId/preview",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await getInstagramImagePreview(env, auth.context, request.params.organizationId, request.params.imageId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string }; Querystring: { store_id?: string; cursor?: string; limit?: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/meta-assets",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listMetaVisualImageCandidates(
        env,
        auth.context,
        request.params.organizationId,
        request.query.store_id ?? null,
        { ...(request.query.cursor ? { cursor: request.query.cursor } : {}), ...(request.query.limit ? { limit: Number(request.query.limit) } : {}) },
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank/meta-import",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await importMetaVisualImage(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(result.data.deduped ? 200 : 201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank/meta-video-frames",
    { bodyLimit: 16 * 1024 },
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await importMetaVideoFrames(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; imageId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateInstagramImageMarkdown(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId/retry",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await retryInstagramImage(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId/reindex",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await reindexInstagramImage(env, auth.context, request.params.organizationId, request.params.imageId);
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; imageId: string } }>(
    "/v1/organizations/:organizationId/instagram/image-bank/:imageId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteInstagramImage(
        env,
        auth.context,
        request.params.organizationId,
        request.params.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  // --- Piezas estáticas: texto sobre una imagen del banco ---

  app.get<{
    Params: { organizationId: string };
    Querystring: { imageId?: string };
  }>(
    "/v1/organizations/:organizationId/instagram/overlays",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listInstagramOverlays(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.imageId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await createInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.delete<{ Params: { organizationId: string; overlayId: string } }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await deleteInstagramOverlay(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId/ai-draft",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await draftInstagramOverlayText(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; overlayId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/instagram/overlays/:overlayId/caption",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await generatePublicationCaption(
        env,
        auth.context,
        request.params.organizationId,
        request.params.overlayId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { connectionId?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const result = await listMarketingContentDrafts(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.query.connectionId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { cursor_created_at?: string; cursor_id?: string; store_id?: string };
  }>(
    "/v1/organizations/:organizationId/marketing/templates",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization)
        return reply.code(401).send({ error: "missing_bearer_token" });

      const { cursor_created_at: createdAt, cursor_id: id, store_id: templateStoreConnectionId } = request.query;
      const hasCursor = Boolean(createdAt || id);
      const validCursor =
        !hasCursor ||
        (typeof createdAt === "string" &&
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
            createdAt,
          ) &&
          typeof id === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          ));
      if (!validCursor)
        return reply.code(400).send({ error: "invalid_template_cursor" });

      const result = await listMarketingTemplatePage(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        hasCursor ? { createdAt: createdAt!, id: id! } : null,
        templateStoreConnectionId ?? null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; draftId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/versions",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const authorization = request.headers.authorization;
      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listMarketingContentDraftVersions(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; draftId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await updateMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/submit",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await submitMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; draftId: string };
    Body: { decision?: string; reason?: string; expected_version?: number };
  }>(
    "/v1/organizations/:organizationId/marketing/drafts/:draftId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await decideMarketingContentDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
        request.body?.decision,
        request.body?.reason,
        request.body?.expected_version,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      // ADR-0025: si el borrador es de una campaña del grafo, la decision ya
      // registrada la reanuda (en segundo plano; nunca falla la peticion).
      await advanceMailingCampaignForDraft(
        env,
        auth.context,
        request.params.organizationId,
        request.params.draftId,
      );
      return result.data;
    },
  );

  const parseConsultantChatRequest = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const body = value as Record<string, unknown>;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 8000) return null;
    if (body.conversation_id !== undefined && (typeof body.conversation_id !== "string" || !uuidPattern.test(body.conversation_id))) return null;
    if (body.client_turn_id !== undefined && (typeof body.client_turn_id !== "string" || !uuidPattern.test(body.client_turn_id))) return null;
    if (body.model !== undefined && (typeof body.model !== "string" || body.model.length > 100)) return null;
    if (body.view_context !== undefined) {
      if (!body.view_context || typeof body.view_context !== "object" || Array.isArray(body.view_context)) return null;
      if (Buffer.byteLength(JSON.stringify(body.view_context), "utf8") > 24_576) return null;
    }
    let evidenceReference: CopilotEvidenceReference | undefined;
    if (body.evidence_reference !== undefined) {
      const parsed = copilotEvidenceReferenceSchema.safeParse(body.evidence_reference);
      if (!parsed.success) return null;
      evidenceReference = parsed.data;
    }
    return {
      message: body.message,
      conversation_id: body.conversation_id as string | undefined,
      view_context: body.view_context as ConsultantChatViewContext | undefined,
      model: body.model as string | undefined,
      evidence_reference: evidenceReference,
      client_turn_id: body.client_turn_id as string | undefined,
    };
  };

  // AI-05: Consultor IA (A09). Chat de solo lectura sobre las tools de lectura
  // del tenant. Una propuesta explicita requiere aprobacion antes de escribir.
  // `view_context`
  // es la pantalla desde la que se pregunta (modulo, tienda, periodo, cifras
  // visibles): se sanea en runConsultantChatTurn y nunca amplia el alcance de
  // datos, que lo sigue fijando `organizationId` + membership.
  app.post<{
    Params: { organizationId: string };
    Body: {
      message?: string;
      conversation_id?: string;
      view_context?: ConsultantChatViewContext;
      model?: string;
      evidence_reference?: CopilotEvidenceReference;
      client_turn_id?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-chat",
    aiEndpointRateLimit,
    async (request, reply) => {
      const body = parseConsultantChatRequest(request.body);
      if (!body) return reply.code(400).send({ error: "consultant_chat_request_invalid" });
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runConsultantChatTurn(
        env,
        auth.context,
        request.params.organizationId,
        body.message,
        body.conversation_id,
        body.view_context,
        body.model,
        body.evidence_reference,
        request.headers.authorization,
        undefined,
        body.client_turn_id,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Same chat turn and persistence path as the JSON endpoint, with live events.
  app.post<{
    Params: { organizationId: string };
    Body: {
      message?: string;
      conversation_id?: string;
      view_context?: ConsultantChatViewContext;
      model?: string;
      evidence_reference?: CopilotEvidenceReference;
      client_turn_id?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-chat/stream",
    aiEndpointRateLimit,
    async (request, reply) => {
      const body = parseConsultantChatRequest(request.body);
      if (!body) return reply.code(400).send({ error: "consultant_chat_request_invalid" });
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      reply.header("Content-Type", "application/x-ndjson; charset=utf-8");
      reply.header("Cache-Control", "no-cache, no-transform");
      reply.header("X-Accel-Buffering", "no");
      for (const [name, value] of Object.entries(reply.getHeaders())) {
        if (value !== undefined) reply.raw.setHeader(name, value);
      }
      const turnController = new AbortController();
      const abortOnClientDisconnect = () => {
        if (!reply.raw.writableEnded) {
          turnController.abort(new DOMException("Client disconnected", "AbortError"));
        }
      };
      reply.raw.on("close", abortOnClientDisconnect);
      reply.hijack();
      reply.raw.writeHead(200);
      reply.raw.flushHeaders();
      const emit = (event: unknown) => {
        if (!reply.raw.destroyed && !reply.raw.writableEnded) {
          reply.raw.write(`${JSON.stringify(event)}\n`);
        }
      };
      const heartbeat = setInterval(() => emit({ type: "heartbeat" }), 15_000);
      heartbeat.unref();
      try {
        const result = await runConsultantChatTurn(
          env,
          auth.context,
          request.params.organizationId,
        body.message,
        body.conversation_id,
        body.view_context,
        body.model,
        body.evidence_reference,
          request.headers.authorization,
          emit,
        body.client_turn_id,
          turnController.signal,
        );
        emit(result.ok ? { type: "done", data: result.data } : { type: "error", error: result });
      } catch {
        emit({ type: "error", error: { error: "chat_turn_failed", statusCode: 500 } });
      } finally {
        clearInterval(heartbeat);
        reply.raw.off("close", abortOnClientDisconnect);
        if (!reply.raw.destroyed && !reply.raw.writableEnded) reply.raw.end();
      }
    },
  );

  // El saldo del copiloto. Solo se lee al abrir el panel: despues viaja en la
  // respuesta de cada mensaje, que es cuando cambia.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/copilot/saldo",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getCopilotBalance(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.send(result.data);
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: {
      connection_id?: string;
      search?: string;
      before_created_at?: string;
      before_id?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-chat/conversations",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (Boolean(request.query.before_created_at) !== Boolean(request.query.before_id)) {
        return reply.code(400).send({ error: "conversation_cursor_invalid" });
      }

      const result = await listConsultantChatConversations(
        env,
        auth.context,
        request.params.organizationId,
        request.query.connection_id,
        request.query.search,
        request.query.before_created_at && request.query.before_id
          ? { created_at: request.query.before_created_at, id: request.query.before_id }
          : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string; conversationId: string };
    Querystring: {
      connection_id?: string;
      before_created_at?: string;
      before_id?: string;
    };
  }>(
    "/v1/organizations/:organizationId/consultant-chat/conversations/:conversationId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      if (Boolean(request.query.before_created_at) !== Boolean(request.query.before_id)) {
        return reply.code(400).send({ error: "message_cursor_invalid" });
      }

      const result = await getConsultantChatMessages(
        env,
        auth.context,
        request.params.organizationId,
        request.params.conversationId,
        request.query.connection_id,
        request.query.before_created_at && request.query.before_id
          ? { created_at: request.query.before_created_at, id: request.query.before_id }
          : undefined,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; messageId: string };
    Body: { rating?: string; comment?: string };
  }>(
    "/v1/organizations/:organizationId/consultant-chat/messages/:messageId/feedback",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await submitConsultantChatFeedback(
        env,
        auth.context,
        request.params.organizationId,
        request.params.messageId,
        request.body?.rating,
        request.body?.comment,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // AI-04: conocimiento (RAG). Ingestion por organizacion; con "global" en la
  // ruta se crea metodologia compartida (solo platform admin).
  app.post<{
    Params: { organizationId: string };
    Body: {
      title?: string;
      description?: string;
      content?: string;
      source_type?: string;
      audience?: string;
    };
  }>(
    "/v1/organizations/:organizationId/knowledge/documents",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const organizationId =
        request.params.organizationId === "global"
          ? null
          : request.params.organizationId;

      const result = await createKnowledgeDocument(
        env,
        auth.context,
        organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // Reescribe un documento existente (mismo titulo, contenido nuevo): re-embebe
  // y sube version, en vez de acumular un documento distinto cada vez que se
  // corrige una respuesta (cuestionario de tienda, perfil editable).
  app.patch<{
    Params: { organizationId: string; documentId: string };
    Body: { content?: string };
  }>(
    "/v1/organizations/:organizationId/knowledge/documents/:documentId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateKnowledgeDocument(
        env,
        auth.context,
        request.params.organizationId,
        request.params.documentId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/knowledge/documents",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listKnowledgeDocuments(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.get<{ Params: { organizationId: string; documentId: string } }>(
    "/v1/organizations/:organizationId/knowledge/documents/:documentId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getKnowledgeDocument(
        env,
        auth.context,
        request.params.organizationId,
        request.params.documentId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{ Params: { organizationId: string }; Body: { query?: string } }>(
    "/v1/organizations/:organizationId/knowledge/search",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await searchKnowledge(
        env,
        auth.context,
        request.params.organizationId,
        request.body?.query,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Quien acompaña a este cliente. Sin esto el portal no puede distinguir un
  // cliente con consultor de uno que se apoya solo en los agentes: la relacion
  // solo se consultaba consultor -> organizaciones, nunca al reves.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/my-consultant",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await getClientConsultant(
        env,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // Reglas del cliente: lo que el copiloto tiene SIEMPRE delante, frente a los
  // documentos, que solo usa si salen en la busqueda. La tabla y su inyeccion
  // existian desde AI-07; estas son las tres rutas que faltaban para poder
  // crear una.
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/knowledge/constraints",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listClientConstraints(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: {
      category?: string;
      statement?: string;
      storeId?: string | null;
      validUntil?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/knowledge/constraints",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createClientConstraint(
        env,
        auth.context,
        request.params.organizationId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.patch<{
    Params: { organizationId: string; constraintId: string };
    Body: {
      status?: string;
      statement?: string;
      category?: string;
      validUntil?: string | null;
    };
  }>(
    "/v1/organizations/:organizationId/knowledge/constraints/:constraintId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateClientConstraint(
        env,
        auth.context,
        request.params.organizationId,
        request.params.constraintId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  // BE-05: llamadas de consultoria (registro, transcripcion, resumen aprobado).
  app.get<{ Params: { organizationId: string } }>(
    "/v1/organizations/:organizationId/calls",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const authorization = request.headers.authorization;

      if (!authorization) {
        return reply.code(401).send({ error: "missing_bearer_token" });
      }

      const result = await listCalls(
        env,
        authorization,
        auth.context,
        request.params.organizationId,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string };
    Body: Record<string, unknown>;
  }>("/v1/organizations/:organizationId/calls", async (request, reply) => {
    const auth = await resolveAuthContext(env, request.headers.authorization);

    if (isAuthContextError(auth)) {
      return sendAuthFailure(reply, auth.error);
    }

    const result = await createCall(
      env,
      auth.context,
      request.params.organizationId,
      request.body ?? {},
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.code(201).send(result.data);
  });

  app.patch<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await updateCall(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.put<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/transcript",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await saveTranscript(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/summary",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createSummary(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  // AI-01: genera el resumen estructurado de la llamada con el agente A01 a
  // partir de su transcripcion actual. Queda pending_approval como el manual.
  app.post<{
    Params: { organizationId: string; callId: string };
    Body: { focus?: string };
  }>(
    "/v1/organizations/:organizationId/calls/:callId/analyze",
    aiEndpointRateLimit,
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await runCallAnalyst(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body?.focus,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; summaryId: string };
    Body: {
      decision?: string;
      reason?: string;
      selectedTaskIndexes?: number[];
      taskMilestones?: Record<string, string>;
    };
  }>(
    "/v1/organizations/:organizationId/call-summaries/:summaryId/decision",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await decideSummary(
        env,
        auth.context,
        request.params.organizationId,
        request.params.summaryId,
        request.body?.decision,
        request.body?.reason,
        request.body?.selectedTaskIndexes,
        request.body?.taskMilestones,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: { body?: string };
  }>(
    "/v1/organizations/:organizationId/calls/:callId/internal-notes",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await addInternalNote(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body?.body,
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.post<{
    Params: { organizationId: string; callId: string };
    Body: Record<string, unknown>;
  }>(
    "/v1/organizations/:organizationId/calls/:callId/tasks",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);

      if (isAuthContextError(auth)) {
        return sendAuthFailure(reply, auth.error);
      }

      const result = await createTaskFromCall(
        env,
        auth.context,
        request.params.organizationId,
        request.params.callId,
        request.body ?? {},
      );

      if (isServiceFailure(result)) {
        return sendServiceFailure(reply, result);
      }

      return reply.code(201).send(result.data);
    },
  );

  app.get("/v1/shopify/oauth/callback", async (request, reply) => {
    const result = await handleShopifyOAuthCallback(
      env,
      request.query as Record<string, string | string[] | undefined>,
    );

    if (isServiceFailure(result)) {
      return sendServiceFailure(reply, result);
    }

    return reply.redirect(result.data.redirectUrl);
  });

  await app.register(async (webhookScope) => {
    // El parser JSON del padre ya no es el de fábrica; este ámbito necesita el cuerpo crudo para firmar webhooks.
    webhookScope.removeContentTypeParser("application/json");
    webhookScope.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    webhookScope.post<{ Params: { connectionId: string } }>("/v1/klaviyo/webhooks/:connectionId", {
      bodyLimit: 2 * 1024 * 1024,
      config: { rateLimit: { max: 1200, timeWindow: "1 minute", keyGenerator: (request: FastifyRequest) => `webhook:klaviyo:${request.ip}` } },
    }, async (request, reply) => {
      const result = await handleKlaviyoWebhookRequest(env, request.params.connectionId, request.headers, request.body as Buffer);
      return reply.code(result.statusCode).send(result.body);
    });

    webhookScope.post("/v1/shopify/webhooks", {
      bodyLimit: 2 * 1024 * 1024,
      config: { rateLimit: { max: 1200, timeWindow: "1 minute", keyGenerator: (request: FastifyRequest) => `webhook:shopify:${request.ip}` } },
    }, async (request, reply) => {
      const result = await handleShopifyWebhookRequest(
        env,
        request.headers as Record<string, string | string[] | undefined>,
        request.body as Buffer,
      );

      return reply.code(result.statusCode).send(result.body);
    });

    webhookScope.post("/v1/stripe/webhooks", async (request, reply) => {
      const result = await handleStripeWebhookRequest(
        env,
        request.headers as StripeWebhookHeaders,
        request.body as Buffer,
      );
      return reply.code(result.statusCode).send(result.body);
    });

    webhookScope.post<{ Params: { connectionId: string } }>(
      "/v1/fathom/webhooks/:connectionId",
      async (request, reply) => {
        const result = await handleFathomWebhookRequest(
          env,
          request.params.connectionId,
          request.headers as FathomWebhookHeaders,
          request.body as Buffer,
        );
        return reply.code(result.statusCode).send(result.body);
      },
    );
  });

  app.post("/v1/internal/operations/run-rules", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    void internalPass("alert-rules", () => runAlertRulesForAllOrganizations(env)).catch((error: unknown) => {
      logger.error("Alert rules pass failed", error);
    });

    return reply.code(202).send({ status: "alert_rules_started" });
  });

  app.post("/v1/internal/shopify/reconcile", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }

    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }

    void internalPass("shopify-reconcile", () => reconcileAllShopifyConnections(env)).catch((error: unknown) => {
      logger.error("Shopify reconciliation pass failed", error);
    });

    return reply.code(202).send({ status: "reconciliation_started" });
  });

  app.post("/v1/internal/fathom/process-queued", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await processQueuedFathomWebhookEvents(env, 10);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "fathom_queue_processing_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.post(
    "/v1/internal/instagram/process-image-queue",
    async (request, reply) => {
      if (!env.INTERNAL_API_SECRET) {
        return reply
          .code(503)
          .send({ error: "internal_api_secret_not_configured" });
      }
      if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
        return reply.code(401).send({ error: "invalid_internal_secret" });
      }
      try {
        const result = await processInstagramImageQueue(env);
        if (result.status === "error") {
          return reply.code(503).send({ error: "instagram_image_queue_processing_failed", detail: result.detail });
        }
        return reply.code(200).send(result);
      } catch (error) {
        return reply.code(503).send({
          error: "instagram_image_queue_processing_failed",
          detail: error instanceof Error ? error.message : "unknown_error",
        });
      }
    },
  );

  app.post("/v1/internal/webhooks/purge-retained", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await purgeProcessedWebhookEvents(env);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "webhook_retention_purge_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.post("/v1/internal/ai/purge-retained-context", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await purgeExpiredAiContext(env);
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "ai_context_retention_purge_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  // Fase 3: pasada del orquestador de diagnosticos de fondo. La dispara el
  // worker por cron (2x/dia). Sincrono: son ~15 runs como mucho y el worker
  // quiere el resumen en su log.
  app.post("/v1/internal/ai/a06-stock-events/tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) return reply.code(503).send({ error: "internal_api_secret_not_configured" });
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET))
      return reply.code(401).send({ error: "invalid_internal_secret" });
    return runA06StockEventTick(env);
  });

  app.post("/v1/internal/ai/diagnostics/tick", async (request, reply) => {
    if (!env.INTERNAL_API_SECRET) {
      return reply
        .code(503)
        .send({ error: "internal_api_secret_not_configured" });
    }
    if (!internalSecretMatches(request.headers["x-internal-secret"], env.INTERNAL_API_SECRET)) {
      return reply.code(401).send({ error: "invalid_internal_secret" });
    }
    try {
      const result = await runDiagnosticOrchestratorTick(env);
      if (result.ok === false) {
        return reply.code(result.statusCode).send({
          error: result.error,
          detail: result.message,
        });
      }
      return reply.code(200).send(result);
    } catch (error) {
      return reply.code(503).send({
        error: "ai_diagnostics_tick_failed",
        detail: error instanceof Error ? error.message : "unknown_error",
      });
    }
  });

  app.get<{ Params: { organizationId: string } }>(
    "/v1/consultant/organizations/:organizationId/export",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);

      const result = await exportOrganizationData(
        env,
        auth.context,
        request.params.organizationId,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);

      reply.header("content-type", "application/json; charset=utf-8");
      reply.header(
        "content-disposition",
        `attachment; filename="ecomscaling-organization-${request.params.organizationId}-export.json"`,
      );
      return result.data;
    },
  );

  app.patch<{
    Params: { organizationId: string; itemId: string };
    Body: {
      status?: string;
      ownerUserId?: string | null;
      executionNotes?: string | null;
      blockedReason?: string | null;
      resultData?: Record<string, unknown>;
    };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/execution",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await updateCampaignCalendarExecution(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.post<{
    Params: { organizationId: string; itemId: string };
    Body: { verdict?: string; reason?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/items/:itemId/verdict",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await recordCampaignOutcomeVerdict(
        env,
        auth.context,
        request.params.organizationId,
        request.params.itemId,
        request.body ?? {},
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  app.get<{
    Params: { organizationId: string };
    Querystring: { storeId?: string };
  }>(
    "/v1/organizations/:organizationId/campaign-planning/attention",
    async (request, reply) => {
      const auth = await resolveAuthContext(env, request.headers.authorization);
      if (isAuthContextError(auth)) return sendAuthFailure(reply, auth.error);
      const result = await listCampaignPlanningAttention(
        env,
        auth.context,
        request.params.organizationId,
        request.query.storeId || null,
      );
      if (isServiceFailure(result)) return sendServiceFailure(reply, result);
      return result.data;
    },
  );

  return app;
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

// BE-00: sin esto, un SIGTERM (docker stop, redeploy, scale-down) mata el
// proceso a mitad de request en vez de drenar las conexiones en vuelo --
// `app.close()` deja de aceptar conexiones nuevas y espera a que las
// existentes terminen (Fastify), ademas de correr los hooks `onClose` ya
// registrados en `buildApp()` (desconectar el Redis del rate-limit). Timeout
// de seguridad: un `app.close()` colgado (encontrado 2026-07-29 en tests,
// ver BE-00) no debe dejar el proceso zombie en produccion esperando un
// SIGKILL del orquestador -- forzamos la salida si no cierra a tiempo.
const SHUTDOWN_TIMEOUT_MS = 10_000;

// `exit`/`timeoutMs` inyectables solo para poder probar el timeout y el
// guard de senal duplicada sin depender de un SIGTERM real del SO (Windows
// no entrega SIGTERM real a procesos hijos, ver be-00-graceful-shutdown.test.ts)
// ni de registrar listeners reales de `process` en el proceso de test.
export function createShutdownHandler(
  app: { close: () => Promise<unknown> },
  {
    exit = process.exit,
    timeoutMs = SHUTDOWN_TIMEOUT_MS,
  }: { exit?: (code: number) => void; timeoutMs?: number } = {},
) {
  let shuttingDown = false;

  return async function shutdown(signal: string) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down gracefully`);

    const forceExitTimer = setTimeout(() => {
      logger.error(
        `Graceful shutdown did not complete within ${timeoutMs}ms, forcing exit`,
      );
      exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    try {
      await app.close();
      clearTimeout(forceExitTimer);
      logger.info("Shutdown complete");
      exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      logger.error("Error during shutdown", error);
      exit(1);
    }
  };
}

function registerGracefulShutdown(app: FastifyInstance) {
  const shutdown = createShutdownHandler(app);
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (isDirectRun) {
  const env = loadApiEnv(process.env);
  const app = await buildApp();

  try {
      await app.listen({ host: env.API_HOST, port: env.API_PORT });
      logger.info(`API listening on ${env.API_HOST}:${env.API_PORT}`);
      if (env.AI_JUDGE_MODE && env.AI_JUDGE_MODE !== "off" && env.SUPABASE_SERVICE_ROLE_KEY) {
        const judgeQueueClient = createServiceClient(env);
        void processAgentJudgeQueue(env, judgeQueueClient);
        setInterval(() => void processAgentJudgeQueue(env, judgeQueueClient), 10_000).unref();
        logger.info("Agent judge recovery worker enabled (10s poll)");
      }
      if (process.env.PLATFORM_ALERT_WEBHOOK_URL && env.REDIS_URL) {
        void monitorPlatformHealth(env);
        setInterval(() => void monitorPlatformHealth(env), 60_000).unref();
        logger.info("Platform alert monitor enabled (60s interval)");
      }

    // AI-30: decir en voz alta si la IA tiene red de seguridad. No aborta el
    // arranque -- un solo proveedor es una configuracion valida -- pero deja de
    // ser invisible, que es lo que costo una semana de ejecuciones muertas.
    const redundancy = describeProviderRedundancy(env);
    if (redundancy.level === "redundant") {
      logger.info(redundancy.message);
    } else {
      logger.error(`ai_provider_redundancy: ${redundancy.message}`);
    }

    registerGracefulShutdown(app);
  } catch (error) {
    logger.error("API failed to start", error);
    process.exit(1);
  }
}
