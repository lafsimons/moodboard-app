export function getEffectiveReferencePreviewSource(draft, resolvedPreviewSource = "") {
  const trimmedResolvedPreviewSource = String(resolvedPreviewSource ?? "").trim();

  if (trimmedResolvedPreviewSource) {
    return trimmedResolvedPreviewSource;
  }

  return String(draft?.imageUrl ?? "").trim();
}

export function hasEffectiveReferencePreviewSource(draft, resolvedPreviewSource = "") {
  return Boolean(getEffectiveReferencePreviewSource(draft, resolvedPreviewSource));
}
