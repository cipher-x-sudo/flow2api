import type { GeneratedMetadata, ProcessingMode } from "../types";

export const UPLOAD_IMAGES = ".upload-tile__thumbnail.upload-tile__thumbnail--portrait, .upload-tile__thumbnail.upload-tile__thumbnail--landscape";
export const PORTFOLIO_IMAGES = ".content-thumbnail__img";
export const TITLE_INPUTS = 'textarea[data-t="asset-title-content-tagger"], textarea[name="title"], textarea[id="content-title-ui-textarea"], textarea[aria-label="Content title"], textarea[aria-label="Inhaltstitel"], textarea[aria-label="Titel"]';
export const KEYWORD_INPUTS = 'textarea[id="content-keywords-ui-textarea"], textarea[data-t="content-keywords-ui-textarea"], textarea[name="keywordsUITextArea"], textarea[aria-label*="Keyword"], textarea[aria-label*="Stichw"]';

export const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitFor<T extends Element>(selector: string, timeout = 8_000): Promise<T> {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const element = document.querySelector<T>(selector);
    if (element) return element;
    await delay(100);
  }
  throw new Error(`Timed out waiting for Adobe field: ${selector}`);
}

export function assetImages(mode: ProcessingMode): HTMLImageElement[] {
  return Array.from(document.querySelectorAll<HTMLImageElement>(mode === "upload" ? UPLOAD_IMAGES : PORTFOLIO_IMAGES));
}

export function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function enter(element: HTMLElement): void {
  element.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
}

export function detectAssetType(mode: ProcessingMode): string {
  if (mode === "portfolio") {
    return document.querySelector<HTMLElement>('[data-t="portfolio-detail-panel-format"]')?.textContent?.trim().toLowerCase() || "photo";
  }
  const select = document.querySelector<HTMLSelectElement>('select[name="contentType"]');
  if (select?.selectedOptions[0]?.textContent) return select.selectedOptions[0].textContent.trim().toLowerCase();
  const label = document.querySelector<HTMLElement>(".cm4dRG_spectrum-Dropdown-label")?.textContent?.trim().toLowerCase();
  return label?.replace(/s$/, "") || "photo";
}

async function chooseCategory(category: string): Promise<void> {
  if (!category) return;
  let option = document.querySelector<HTMLElement>(`[role="option"][data-key="${category}"]`);
  if (!option) {
    document.querySelector<HTMLElement>('button[data-t="content-tagger-category-select"]')?.click();
    await delay(150);
    option = document.querySelector<HTMLElement>(`[role="option"][data-key="${category}"]`);
  }
  if (option) {
    option.click();
    return;
  }
  const select = document.querySelector<HTMLSelectElement>('select[name="category"], select[aria-label="Category"], select[aria-label="Kategorie"], select.input--full');
  if (select) setNativeValue(select, category);
}

async function saveAdobeForm(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>('.button--action[type="submit"], button[type="submit"][data-test="save-metadata"], button.button--action');
  if (!button) throw new Error("Adobe save button was not found.");
  button.click();
  await delay(500);
  const confirm = document.querySelector<HTMLButtonElement>('button[data-variant="accent"][data-style="fill"], .dialog .button--action[type="submit"]');
  if (confirm) {
    confirm.click();
    await delay(600);
  }
}

export async function openAsset(image: HTMLImageElement, mode: ProcessingMode): Promise<void> {
  image.scrollIntoView({ behavior: "auto", block: "center" });
  image.click();
  if (mode === "upload") await waitFor(`${TITLE_INPUTS}, ${KEYWORD_INPUTS}`);
  else await waitFor(".editable__content, .keywords-section, .editable__pencil, .content-detail", 10_000);
}

export async function applyUploadMetadata(metadata: GeneratedMetadata): Promise<void> {
  const title = await waitFor<HTMLTextAreaElement>(TITLE_INPUTS);
  const keywords = await waitFor<HTMLTextAreaElement>(KEYWORD_INPUTS);
  setNativeValue(title, metadata.title);
  title.blur();
  setNativeValue(keywords, metadata.keywords);
  enter(keywords);
  await delay(250);
  await chooseCategory(metadata.category);
  await saveAdobeForm();
}

export async function applyPortfolioMetadata(metadata: GeneratedMetadata): Promise<void> {
  const titlePencil = await waitFor<HTMLElement>(".editable__pencil");
  titlePencil.click();
  const titleInput = await waitFor<HTMLInputElement>(".input--full");
  setNativeValue(titleInput, metadata.title);
  document.querySelector<HTMLElement>(".button__text.text-up")?.click();
  await delay(250);

  const keywordPencil = await waitFor<HTMLElement>(".button.button--floating.editable__pencil.margin-left-small");
  keywordPencil.click();
  await delay(250);
  const keywords = metadata.keywords.split(",").map((item) => item.trim()).filter(Boolean);
  let inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-t="content-keyword"]'));
  if (!inputs.length) throw new Error("Adobe keyword editor did not expose keyword inputs.");
  for (let index = 0; index < Math.max(inputs.length, keywords.length); index += 1) {
    inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-t="content-keyword"]'));
    const input = inputs[index];
    if (!input) break;
    setNativeValue(input, keywords[index] || "");
    if (keywords[index]) enter(input);
    await delay(60);
  }
  document.querySelector<HTMLElement>(".button.button--dialog")?.click();
  await delay(250);
  await chooseCategory(metadata.category);
  await saveAdobeForm();
}

export function nextPageButton(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".pagination__item--next:not(.pagination__item--disabled)")
    ?? Array.from(document.querySelectorAll<HTMLElement>("button, a")).find((element) => {
      const text = element.textContent?.trim().toLowerCase();
      return text === "next" || element.getAttribute("aria-label")?.toLowerCase().includes("next");
    }) ?? null;
}

export function addProcessingOverlay(image: HTMLImageElement, index: number, total: number): () => void {
  const container = image.closest<HTMLElement>(".upload-tile, .content-thumbnail, [class*='thumbnail']") ?? image.parentElement;
  if (!container) return () => undefined;
  container.style.position = "relative";
  const overlay = document.createElement("div");
  overlay.className = "flow2-metadata-processing";
  overlay.textContent = `Processing ${index + 1} of ${total}`;
  Object.assign(overlay.style, {
    position: "absolute", inset: "5px", zIndex: "9999", display: "grid", placeContent: "center",
    borderRadius: "8px", background: "rgba(8,16,35,.78)", color: "white", font: "600 12px system-ui", pointerEvents: "none",
  });
  container.appendChild(overlay);
  return () => overlay.remove();
}
