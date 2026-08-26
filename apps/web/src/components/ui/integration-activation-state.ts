const GATE_LABELS: Record<string, string> = {
  credentialsValid: "Credenciales del servidor",
  redirectUriExact: "Callback exacta",
  scopesGranted: "Permisos concedidos",
  providerResponseValid: "Respuesta del proveedor",
  assetSelected: "Cuenta o activo seleccionado",
  initialSyncSucceeded: "Primera sincronización",
  freshnessAvailable: "Datos actualizados",
  reauthorizationVerified: "Reautorización verificada",
  recoverableErrorVerified: "Recuperación de errores",
};

export function getIntegrationActivationGateLabel(gate: string) {
  return GATE_LABELS[gate] ?? gate;
}
