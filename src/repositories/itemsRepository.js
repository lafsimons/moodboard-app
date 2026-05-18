import {
  deleteItem as deleteStoredItem,
  loadItems as loadStoredItems,
  saveItem as saveStoredItem
} from "../lib/storage.js";

export async function loadItems() {
  return loadStoredItems();
}

export async function saveItem(item) {
  return saveStoredItem(item);
}

export async function saveItems(items) {
  const normalizedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  await Promise.all(normalizedItems.map((item) => saveStoredItem(item)));
}

export async function deleteItem(id) {
  return deleteStoredItem(id);
}

export async function deleteItems(ids) {
  const normalizedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  await Promise.all(normalizedIds.map((id) => deleteStoredItem(id)));
}

function getMigrationState(appState, dependencies) {
  return {
    shouldApplyStyleWeightMigration:
      (appState?.itemDefaultsMigrationVersion ?? 0) < dependencies.itemDefaultsMigrationVersion,
    shouldApplyImagePresentationMigration:
      (appState?.imagePresentationMigrationVersion ?? 0) < dependencies.imagePresentationMigrationVersion
  };
}

function getMigrationPredicate(originalItem, normalizedItem, options, dependencies, migrationState) {
  return (
    dependencies.itemNeedsRetailMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageFrameScaleMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageScaleMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageOffsetMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsImageCropMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsFavoriteMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsQuantityMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsColorMigration(originalItem, normalizedItem) ||
    (options.includeWeightMigration && dependencies.itemNeedsWeightMigration(originalItem, normalizedItem)) ||
    dependencies.itemNeedsGarmentTypeMigration(originalItem, normalizedItem) ||
    (options.includeTagMigration && dependencies.itemNeedsTagMigration(originalItem, normalizedItem)) ||
    dependencies.itemNeedsClimateTagMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsDefaultMetadataMigration(originalItem, normalizedItem) ||
    dependencies.itemNeedsMoodboardMetadataMigration(originalItem, normalizedItem) ||
    (options.includeImageAssetMigration && dependencies.itemNeedsImageAssetMigration(originalItem, normalizedItem)) ||
    (migrationState.shouldApplyStyleWeightMigration &&
      options.includeStyleWeightMappingMigration &&
      dependencies.itemNeedsStyleWeightMappingMigration(originalItem, normalizedItem))
  );
}

export async function prepareLoadedItems(items, appState, dependencies, options = {}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const migrationState = getMigrationState(appState, dependencies);
  const normalizedOptions = {
    includeWeightMigration: true,
    includeTagMigration: true,
    includeImageAssetMigration: false,
    includeStyleWeightMappingMigration: false,
    ...options
  };

  const itemsAfterNormalization = normalizedItems
    .map(dependencies.normalizeItem)
    .map((item) =>
      migrationState.shouldApplyImagePresentationMigration ? dependencies.restoreLegacyBakedImageScale(item) : item
    );
  const itemsAfterDefaults =
    migrationState.shouldApplyStyleWeightMigration && normalizedOptions.includeStyleWeightMappingMigration
      ? itemsAfterNormalization.map(dependencies.applyMappedStyleWeightDefaults)
      : itemsAfterNormalization;
  const preparedItems = migrationState.shouldApplyImagePresentationMigration
    ? await Promise.all(itemsAfterDefaults.map((item) => dependencies.bakeItemImagePresentation(item)))
    : itemsAfterDefaults;
  const migratedItems = preparedItems.filter((item, index) =>
    getMigrationPredicate(normalizedItems[index], item, normalizedOptions, dependencies, migrationState)
  );

  if (migratedItems.length) {
    await saveItems(migratedItems);
  }

  return {
    items: preparedItems,
    migratedItems,
    migrationState
  };
}
