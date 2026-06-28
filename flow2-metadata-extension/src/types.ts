export type ProcessingMode = "upload" | "portfolio";
export type LanguageCode = "en" | "fr" | "de" | "es" | "it" | "pt" | "ja" | "pl" | "ko";
export type TitleSuffix = "none" | "transparent" | "white" | "png_transparent";

export interface Connection {
  baseUrl: string;
  apiKey: string;
  keyLabel: string;
  validatedAt: number;
}

export interface Preferences {
  mode: ProcessingMode;
  autoCategory: boolean;
  language: LanguageCode;
  titleSuffix: TitleSuffix;
  titlePrefix: string;
  customTitleSuffix: string;
  limitsEnabled: boolean;
  titleMin: number;
  titleMax: number;
  keywordMin: number;
  keywordMax: number;
  customPromptEnabled: boolean;
  customPrompt: string;
}

export interface RuntimeState {
  processing: boolean;
  stopped: boolean;
  processed: number;
  successes: number;
  currentPage: number;
  message: string;
}

export interface MetadataOption {
  title?: unknown;
  keywords?: unknown;
  categoryId?: unknown;
}

export interface Flow2MetadataResponse {
  optionA?: MetadataOption;
  optionB?: MetadataOption;
}

export interface GeneratedMetadata {
  title: string;
  keywords: string;
  category: string;
}

export interface SessionResponse {
  active: boolean;
  service: "flow2-metadata";
  keyLabel: string;
  capabilities: string[];
}
