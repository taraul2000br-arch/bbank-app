/**
 * INSTITUTION BRANDING CONFIGURATION
 *
 * Central configuration file for institution identity.
 * Allows choosing the active institution name and branding mode cleanly in one place,
 * without modifying components or breaking layouts.
 *
 * MODES:
 * - "original": Restores primary visual identity
 * - "neutral": Displays neutral institutional banking identity ("Digital Banking")
 * - "custom": Displays whatever custom name is set in `customName`
 */

export type BrandingMode = "original" | "neutral" | "custom";

export interface InstitutionConfig {
  mode: BrandingMode;
  customName: string;
  customShortName: string;
  customLegalName: string;
  supportEmail: string;
  supportPhone: string;
  headOfficeAddress: string;
  showOriginalEmblem: boolean;
}

export const INSTITUTION_CONFIG: InstitutionConfig = {
  // Configured as custom "B Bank"
  mode: "custom",
  customName: "B Bank",
  customShortName: "B Bank",
  customLegalName: "B Bank S.A.",
  supportEmail: "suporte@bbank.com",
  supportPhone: "+55 (11) 4004-0001",
  headOfficeAddress: "Av. Paulista, 1000 - São Paulo, SP",
  showOriginalEmblem: true,
};

/**
 * Returns the active institution display name.
 */
export function getInstitutionName(fallback?: string): string {
  if (INSTITUTION_CONFIG.mode === "custom" && INSTITUTION_CONFIG.customName) {
    return INSTITUTION_CONFIG.customName;
  }
  if (INSTITUTION_CONFIG.mode === "neutral") {
    return fallback || "Digital Banking";
  }
  return "B Bank";
}

/**
 * Returns the short display name.
 */
export function getInstitutionShortName(): string {
  if (INSTITUTION_CONFIG.mode === "custom" && INSTITUTION_CONFIG.customShortName) {
    return INSTITUTION_CONFIG.customShortName;
  }
  if (INSTITUTION_CONFIG.mode === "neutral") {
    return "Banco";
  }
  return "B Bank";
}
