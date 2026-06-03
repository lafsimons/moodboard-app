import { loadOriginalImageBlobEntry } from "./assetsRepository.js";
import { saveItems } from "./itemsRepository.js";
import { loadOriginalRecoverySessions } from "./originalRecoveryRepository.js";
import { createLinkedOriginalMetadataEnrichmentReport } from "../lib/originalMetadataEnrichment.js";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function buildLinkedOriginalMetadataEnrichmentReport(items = [], options = {}) {
  const linkedItems = (Array.isArray(items) ? items : []).filter(
    (item) => item?.originalPreserved && normalizeText(item?.itemUuid)
  );
  const originalEntries = await Promise.all(
    linkedItems.map(async (item) => [
      normalizeText(item?.itemUuid),
      await loadOriginalImageBlobEntry(item.itemUuid)
    ])
  );
  const originalEntriesByItemUuid = Object.fromEntries(
    originalEntries.filter(([itemUuid]) => itemUuid)
  );
  const recoverySessions = await loadOriginalRecoverySessions();

  return createLinkedOriginalMetadataEnrichmentReport({
    items,
    originalEntriesByItemUuid,
    recoverySessions,
    exampleLimit: options.exampleLimit
  });
}

export async function applyLinkedOriginalMetadataEnrichmentReport(report = {}) {
  const updatedItems = Array.isArray(report?.updatedItems) ? report.updatedItems.filter(Boolean) : [];

  if (!updatedItems.length) {
    return {
      updatedItems: [],
      updatedItemCount: 0,
      skippedItemCount: Number(report?.skippedItemCount) || 0,
      fieldCounts: report?.fieldCounts ?? {}
    };
  }

  await saveItems(updatedItems);

  return {
    updatedItems,
    updatedItemCount: updatedItems.length,
    skippedItemCount: Number(report?.skippedItemCount) || 0,
    fieldCounts: report?.fieldCounts ?? {}
  };
}
