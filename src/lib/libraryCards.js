function getFileStem(value = "") {
  const trimmedValue = String(value ?? "").trim();
  return trimmedValue.replace(/\.[^.]+$/, "").trim();
}

function getImageUrlStem(imageUrl = "") {
  const trimmedUrl = String(imageUrl ?? "").trim();

  if (!trimmedUrl) {
    return "";
  }

  const pathname = trimmedUrl.split("?")[0].split("#")[0];
  const filename = pathname.split("/").pop() ?? "";

  try {
    return getFileStem(decodeURIComponent(filename));
  } catch {
    return getFileStem(filename);
  }
}

export function getDefaultLibraryCardName(item) {
  return getFileStem(
    item?.sourceOriginalFilename ||
      item?.originalFilename ||
      item?.images?.preview?.originalFilename ||
      getImageUrlStem(item?.imageUrl)
  );
}

export function hasCustomLibraryCardName(item) {
  const currentName = String(item?.name ?? "").trim();

  if (!currentName) {
    return false;
  }

  const defaultName = getDefaultLibraryCardName(item);
  if (!defaultName) {
    return true;
  }

  return currentName !== defaultName;
}

export function shouldShowLibraryCardTitle(item) {
  return Boolean(item?.showTitleOnCard) || hasCustomLibraryCardName(item);
}
