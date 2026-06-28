import { getRuntimeState, saveRuntimeState } from "../storage";
import type { GeneratedMetadata, ProcessingMode, RuntimeState } from "../types";
import { addProcessingOverlay, applyPortfolioMetadata, applyUploadMetadata, assetImages, delay, detectAssetType, nextPageButton, openAsset } from "./dom";

const JOB_KEY = "flow2MetadataJob";

interface JobState {
  active: boolean;
  navigating: boolean;
  mode: ProcessingMode;
  startIndex: number;
  endIndex: number;
  nextIndex: number;
}

let running = false;
let stopRequested = false;

async function updateRuntime(patch: Partial<RuntimeState>): Promise<RuntimeState> {
  const state = { ...await getRuntimeState(), ...patch };
  await saveRuntimeState(state);
  void chrome.runtime.sendMessage({ type: "PROCESSING_UPDATE", state });
  return state;
}

async function saveJob(job: JobState): Promise<void> {
  await chrome.storage.local.set({ [JOB_KEY]: job });
}

async function getJob(): Promise<JobState | null> {
  const value = await chrome.storage.local.get(JOB_KEY);
  return (value[JOB_KEY] as JobState | undefined) ?? null;
}

async function generate(image: HTMLImageElement, mode: ProcessingMode): Promise<GeneratedMetadata> {
  const response = await chrome.runtime.sendMessage({ action: "processImage", imageUrl: image.src, fileType: detectAssetType(mode) });
  if (!response?.success) {
    const error = new Error(response?.error || "Flow2 metadata generation failed.");
    Object.assign(error, { fatal: Boolean(response?.isFatal), status: response?.status });
    throw error;
  }
  return response.data as GeneratedMetadata;
}

async function processPage(job: JobState): Promise<void> {
  const images = assetImages(job.mode);
  if (!images.length) throw new Error("No Adobe Stock images were found on this page.");
  const first = Math.max(job.nextIndex, job.startIndex - 1, 0);
  const limit = job.endIndex > 0 ? Math.min(job.endIndex, images.length) : images.length;
  let consecutiveFailures = 0;

  for (let index = first; index < limit && !stopRequested; index += 1) {
    const image = images[index];
    const removeOverlay = addProcessingOverlay(image, index, limit);
    await updateRuntime({ processing: true, message: `Processing image ${index + 1} of ${limit}` });
    try {
      await openAsset(image, job.mode);
      const metadata = await generate(image, job.mode);
      if (stopRequested) break;
      if (job.mode === "upload") await applyUploadMetadata(metadata);
      else await applyPortfolioMetadata(metadata);
      consecutiveFailures = 0;
      const current = await getRuntimeState();
      await updateRuntime({ processed: current.processed + 1, successes: current.successes + 1 });
    } catch (error) {
      consecutiveFailures += 1;
      const current = await getRuntimeState();
      const message = error instanceof Error ? error.message : "Image processing failed.";
      await updateRuntime({ processed: current.processed + 1, message: `Image ${index + 1} failed: ${message}` });
      if ((error as Error & { fatal?: boolean }).fatal) {
        void chrome.runtime.sendMessage({ type: "CONNECTION_INVALID" });
        stopRequested = true;
      } else if (consecutiveFailures >= 3) {
        stopRequested = true;
        await updateRuntime({ message: "Stopped after three consecutive image failures." });
      }
    } finally {
      removeOverlay();
      job.nextIndex = index + 1;
      await saveJob(job);
    }
    await delay(250);
  }

  if (stopRequested || job.endIndex > 0) return;
  const next = nextPageButton();
  if (!next) return;
  job.navigating = true;
  job.nextIndex = 0;
  job.startIndex = 1;
  await saveJob(job);
  await updateRuntime({ currentPage: (await getRuntimeState()).currentPage + 1, message: "Moving to the next page…" });
  const previous = images[0]?.src;
  next.click();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await delay(500);
    const current = assetImages(job.mode);
    if (current.length && current[0]?.src !== previous) {
      job.navigating = false;
      await saveJob(job);
      await processPage(job);
      return;
    }
  }
}

export async function startProcessing(mode: ProcessingMode, startIndex: number, endIndex: number, recovered = false): Promise<void> {
  if (running) throw new Error("Processing is already running.");
  running = true;
  stopRequested = false;
  const existing = recovered ? await getJob() : null;
  const job: JobState = existing ?? { active: true, navigating: false, mode, startIndex, endIndex, nextIndex: Math.max(0, startIndex - 1) };
  job.active = true;
  job.navigating = false;
  await saveJob(job);
  if (!recovered) await updateRuntime({ processing: true, stopped: false, processed: 0, successes: 0, currentPage: 1, message: "Starting processing…" });
  try {
    await processPage(job);
    const state = await getRuntimeState();
    const stopped = stopRequested;
    await updateRuntime({ processing: false, stopped, message: stopped ? "Processing stopped." : `Complete: ${state.successes} of ${state.processed} images updated.` });
    if (!stopped) void chrome.runtime.sendMessage({ type: "NOTIFY", title: "Flow2 Metadata", message: `Completed ${state.successes} of ${state.processed} images.` });
  } catch (error) {
    await updateRuntime({ processing: false, stopped: true, message: error instanceof Error ? error.message : "Processing failed." });
  } finally {
    job.active = false;
    job.navigating = false;
    await saveJob(job);
    running = false;
  }
}

export async function stopProcessing(): Promise<void> {
  stopRequested = true;
  const job = await getJob();
  if (job) await saveJob({ ...job, active: false, navigating: false });
  await updateRuntime({ processing: false, stopped: true, message: "Stopping processing…" });
}

export async function recoverAfterNavigation(): Promise<void> {
  const job = await getJob();
  const runtime = await getRuntimeState();
  if (job?.active && job.navigating && runtime.processing) {
    await delay(700);
    void startProcessing(job.mode, 1, job.endIndex, true);
  } else if (runtime.processing) {
    await updateRuntime({ processing: false, stopped: true, message: "Page refresh detected. Processing stopped safely." });
  }
}

export async function imageCount(mode: ProcessingMode): Promise<number> {
  return assetImages(mode).length;
}
