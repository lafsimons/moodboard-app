import {
  getTypeMatchKeys,
  normalizeList,
  normalizeTagList,
  normalizeType,
  normalizeWeight,
  resolveTypeDefaults,
  styleTagOptions
} from "./typeDefaults.js";
import {
  getBoardItemRenderedBounds,
  normalizeImageRotation,
  rectanglesIntersect
} from "./boardBounds.js";
import { matchesTagFilter } from "./taggingUx.js";

export const visibleSlots = ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"];
export const accessorySlots = ["Glasses", "Neck", "LeftHand", "RightHand", "Bag", "Belt"];
export const boardGenerationSlots = [...visibleSlots];
export const DEFAULT_BOARD_IMAGE_COUNT = 15;
export const defaultGenerationLists = { Wardrobe: true, Wishlist: true };
export const climateTagOptions = ["Cold", "Warm", "Hot", "Snow", "Rain", "Transitional"];
export const editableClimateTagOptions = ["Rain", "Snow"];
export const outfitFilterOptions = {
  climate: climateTagOptions,
  style: styleTagOptions
};
export const emptyOutfitFilters = {
  style: [],
  climate: []
};
export const generationModes = ["guided", "random"];
export const defaultGenerationMode = "guided";
export const RECENT_OUTFIT_WINDOW = 8;
export const noFilterStyleWeights = {
  Casual: 0.35,
  "Smart Casual": 0.3,
  Athleisure: 0.2,
  Formal: 0.15
};
const GUIDED_BASE_SCORE = 0.8;
const GUIDED_SCORE_FLOOR = 0.3;
const GUIDED_DEBUG_TOP_CANDIDATE_LIMIT = 5;
const BOARD_GUIDED_BASE_SCORE = 100;
const BOARD_GUIDED_MAX_PER_TAG = 2;
const BOARD_GUIDED_SHARED_TAG_SCORE = 25;
const BOARD_GUIDED_PARENT_GROUP_SCORE = 15;
const BOARD_GUIDED_METADATA_MATCH_SCORE = 10;
const BOARD_GUIDED_FAVORITE_SCORE = 8;
const BOARD_GUIDED_PREVIOUS_OVERLAP_PENALTY = -20;
const BOARD_GUIDED_PREVIOUS_DOMINANT_PENALTY = -25;
const BOARD_GUIDED_MAX_PER_TAG_PENALTY = -30;
const BOARD_GUIDED_METADATA_OVERUSE_PENALTY = -15;
const BOARD_GUIDED_INCLUDED_FILTER_BONUS = 4;
const BOARD_GUIDED_MIN_WEIGHT = 1;
const BOARD_LAYOUT_GUTTER = 20;
const MAX_RECENT_ITEM_PENALTY = -0.8;
const MAX_RECENT_EXACT_PENALTY = -0.5;
const MAX_STYLE_STREAK_PENALTY = -0.5;
const MAX_AFFINITY_BOOST = 0.5;
const recentItemPenaltySteps = [0.22, 0.11, 0.04, 0.02, 0.01];
const recentSlotPenaltySteps = [0.08, 0.04, 0.01, 0.005, 0.005];
const recentExactPenaltySteps = [0.4, 0.2, 0.1, 0.05];
const recentLikedBoostSteps = [0.12, 0.08, 0.04, 0.02];
const guidedScoreNormalizers = {
  climate: { scale: 0.45, min: -1.5, max: 2 },
  styleCoherence: { scale: 0.28, min: -3, max: 2.5 },
  styleCompletion: { scale: 0.4, min: 0, max: 2.5 },
  dominance: { scale: 0.6, min: -2, max: 0 },
  weightContrast: { scale: 0.6, min: -1, max: 0 },
  styleConflict: { scale: 0.65, min: -1.5, max: 0 },
  hotOuterwear: { scale: 0.65, min: -1.5, max: 0 },
  lonelyExtremes: { scale: 0.6, min: -0.8, max: 0 },
  baseline: { scale: 0.7, min: 0, max: 1 },
  earlyAnchor: { scale: 0.55, min: 0, max: 1.2 },
  selectedStyleBonus: { scale: 0.45, min: 0, max: 1.4 },
  favorite: { scale: 0.6, min: 0, max: 0.3 },
  affinity: { scale: 1, min: 0, max: MAX_AFFINITY_BOOST },
  recentItemPenalty: { scale: 1, min: MAX_RECENT_ITEM_PENALTY, max: 0 },
  recentExactPenalty: { scale: 1, min: MAX_RECENT_EXACT_PENALTY, max: 0 },
  recentLikedBoost: { scale: 1, min: 0, max: 0.35 },
  coldOuterwear: { scale: 0.45, min: -1.2, max: 1 },
  noFilterVariety: { scale: 0.14, min: -0.4, max: 1 },
  coldLightTopPenalty: { scale: 0.28, min: -1.2, max: 0 },
  mismatchedSeasonality: { scale: 0.32, min: -1.8, max: 0 },
  styleStreakPenalty: { scale: 1, min: MAX_STYLE_STREAK_PENALTY, max: 0 }
};

const nonStackableTopTypes = new Set(["sweatshirt", "jacket"]);
const affinityRelationships = [
  ["TopInner", "Bottom"],
  ["Bottom", "Footwear"],
  ["TopOuter", "TopInner"],
  ["TopOuter", "Bottom"]
];
const boardGuidedMetadataFamilies = ["project", "theme", "source", "collection", "category"];

function markGenerationPerf(debugHooks, label, extra = null) {
  debugHooks?.mark?.(label, extra);
}
const guidedExplanationLabels = {
  climate: "Climate suitability",
  styleCoherence: "Style match",
  styleCompletion: "Style completion",
  dominance: "Style consistency",
  weightContrast: "Extreme weight mix penalty",
  styleConflict: "Cross-style conflict penalty",
  hotOuterwear: "Outerwear adjusted for heat",
  lonelyExtremes: "Lonely extremes penalty",
  baseline: "Clean baseline outfit",
  earlyAnchor: "Early style anchoring",
  selectedStyleBonus: "Selected style bonus",
  favorite: "Favorite item boost",
  affinity: "Liked combo affinity",
  recentItemPenalty: "Recent item repetition penalty",
  recentExactPenalty: "Exact outfit repetition penalty",
  recentLikedBoost: "Recent like combo boost",
  coldOuterwear: "Outerwear added for cold",
  noFilterVariety: "No-filter style variety",
  coldLightTopPenalty: "Cold light-top penalty",
  mismatchedSeasonality: "Mixed-season penalty",
  styleStreakPenalty: "Style streak penalty",
  sharedTags: "Shared tags",
  parentGroup: "Shared parent group",
  metadataMatch: "Matching project/theme/source",
  previousOverlap: "Previous image overlap",
  sameDominantTag: "Repeated dominant tag",
  maxPerTagPenalty: "Overused tag",
  metadataOveruse: "Overused metadata"
};

function normalizeBooleanLookup(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, isEnabled]) => Boolean(isEnabled)).map(([key]) => [key, true])
  );
}

function normalizeAffinityMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, Math.max(0, Math.round(Number(count) || 0))])
      .filter(([, count]) => count > 0)
  );
}

export function pickRandom(items) {
  if (!items.length) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function createBoardId(prefix = "board") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getBoardGenerationSlot(index) {
  return boardGenerationSlots[index % boardGenerationSlots.length];
}

function buildBoardCandidatePool(items, excluded = {}, generationLists = defaultGenerationLists) {
  return (Array.isArray(items) ? items : []).filter((item) =>
    isEligibleForGeneration(item, excluded, generationLists)
  );
}

function getRemainingBoardPool(pool, selectedIds) {
  const selectedIdSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds ?? []);
  const remainingPool = pool.filter((item) => !selectedIdSet.has(item.id));
  return remainingPool.length ? remainingPool : pool;
}

function normalizeBoardTag(tag) {
  return typeof tag === "string"
    ? tag
      .trim()
      .toLowerCase()
      .replace(/\s*\/+\s*/g, "/")
      .replace(/\s+/g, " ")
      .replace(/^\/+|\/+$/g, "")
    : "";
}

function uniqueBoardTags(tags) {
  const seen = new Set();

  return (Array.isArray(tags) ? tags : [])
    .map(normalizeBoardTag)
    .filter((tag) => {
      if (!tag || seen.has(tag)) {
        return false;
      }

      seen.add(tag);
      return true;
    });
}

function normalizeBoardFilterState(filters) {
  return {
    tags: uniqueBoardTags(filters?.tags),
    excludedTags: uniqueBoardTags(filters?.excludedTags),
    tagMatchMode: filters?.tagMatchMode === "all" ? "all" : "any",
    favorite: filters?.favorite === "yes" || filters?.favorite === "no" ? filters.favorite : ""
  };
}

function matchesBoardMetadataFilters(item, filters) {
  const normalizedFilters = normalizeBoardFilterState(filters);

  return (
    matchesTagFilter(item?.tags, {
      includeTags: normalizedFilters.tags,
      excludeTags: normalizedFilters.excludedTags,
      matchMode: normalizedFilters.tagMatchMode
    }) &&
    (!normalizedFilters.favorite ||
      (normalizedFilters.favorite === "yes" ? Boolean(item?.favorite) : !item?.favorite))
  );
}

function filterBoardGenerationItems(items, filters) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const normalizedFilters = normalizeBoardFilterState(filters);
  const hasActiveFilters =
    normalizedFilters.tags.length ||
    normalizedFilters.excludedTags.length ||
    normalizedFilters.favorite;

  if (!hasActiveFilters) {
    return normalizedItems;
  }

  return normalizedItems.filter((item) => matchesBoardMetadataFilters(item, normalizedFilters));
}

function getBoardTagParentGroup(tag) {
  const normalizedTag = normalizeBoardTag(tag);
  const [parent, child] = normalizedTag.split("/");

  return child ? parent : "";
}

function getBoardMetadataTagEntry(tag) {
  const normalizedTag = normalizeBoardTag(tag);
  const [family, ...rest] = normalizedTag.split("/");
  const value = rest.join("/").trim();

  if (!value || !boardGuidedMetadataFamilies.includes(family)) {
    return null;
  }

  return {
    family,
    value,
    tag: normalizedTag
  };
}

function getBoardDominantTag(tags) {
  const metadataEntry = tags
    .map((tag) => getBoardMetadataTagEntry(tag))
    .find(Boolean);

  return metadataEntry?.tag ?? tags[0] ?? "";
}

function buildBoardProfile(item) {
  const tags = uniqueBoardTags(item?.tags);
  const tagSet = new Set(tags);
  const parentGroups = [...new Set(tags.map((tag) => getBoardTagParentGroup(tag)).filter(Boolean))];
  const parentGroupSet = new Set(parentGroups);
  const metadataEntries = tags
    .map((tag) => getBoardMetadataTagEntry(tag))
    .filter(Boolean);
  const metadataKeys = metadataEntries.map(({ family, value }) => `${family}:${value}`);

  return {
    item,
    id: item.id,
    tags,
    tagSet,
    parentGroups,
    parentGroupSet,
    metadataEntries,
    metadataKeys,
    dominantTag: getBoardDominantTag(tags),
    favorite: Boolean(item.favorite),
    similarityFingerprint: tags.slice().sort().join("|")
  };
}

function buildBoardGuidedContext(items, options = {}) {
  const candidateProfiles = (Array.isArray(items) ? items : [])
    .filter((item) => item?.id)
    .map((item) => buildBoardProfile(item));
  const profilesById = Object.fromEntries(candidateProfiles.map((profile) => [profile.id, profile]));
  const includedFilterTags = new Set(uniqueBoardTags(options.boardFilters?.tags));

  return {
    candidateProfiles,
    profilesById,
    includedFilterTags,
    maxPerTag: Math.max(1, Math.round(Number(options.maxPerTag) || BOARD_GUIDED_MAX_PER_TAG)),
    collectTopCandidates: Boolean(options.collectTopCandidates)
  };
}

function createBoardGuidedState() {
  return {
    selectedIds: new Set(),
    tagCounts: new Map(),
    parentGroupCounts: new Map(),
    metadataCounts: new Map(),
    previousProfile: null
  };
}

function incrementCount(map, key) {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + 1);
}

function addBoardProfileToState(state, profile) {
  if (!profile) {
    return state;
  }

  state.selectedIds.add(profile.id);
  profile.tags.forEach((tag) => incrementCount(state.tagCounts, tag));
  profile.parentGroups.forEach((group) => incrementCount(state.parentGroupCounts, group));
  profile.metadataKeys.forEach((key) => incrementCount(state.metadataCounts, key));
  state.previousProfile = profile;
  return state;
}

function countSharedBoardTags(profile, targetTagLookup) {
  let sharedCount = 0;

  profile.tags.forEach((tag) => {
    if ((typeof targetTagLookup.get === "function" ? targetTagLookup.get(tag) : targetTagLookup.has(tag))) {
      sharedCount += 1;
    }
  });

  return sharedCount;
}

function countSharedParentGroups(profile, groupCounts) {
  let sharedCount = 0;

  profile.parentGroups.forEach((group) => {
    if (groupCounts.get(group)) {
      sharedCount += 1;
    }
  });

  return sharedCount;
}

function countSharedMetadata(profile, metadataCounts) {
  let sharedCount = 0;

  profile.metadataKeys.forEach((key) => {
    if (metadataCounts.get(key)) {
      sharedCount += 1;
    }
  });

  return sharedCount;
}

function getBoardGuidedOverlapPenalty(profile, previousProfile) {
  if (!previousProfile) {
    return 0;
  }

  const sharedTagCount = countSharedBoardTags(profile, previousProfile.tagSet);
  const minTagCount = Math.min(profile.tags.length || 0, previousProfile.tags.length || 0);
  const hasHeavyOverlap =
    sharedTagCount >= 2 ||
    (sharedTagCount > 0 && minTagCount > 0 && sharedTagCount / minTagCount >= 0.6) ||
    profile.similarityFingerprint === previousProfile.similarityFingerprint;

  return hasHeavyOverlap ? BOARD_GUIDED_PREVIOUS_OVERLAP_PENALTY : 0;
}

function getBoardGuidedMetadataOverusePenalty(profile, metadataCounts) {
  return profile.metadataKeys.some((key) => (metadataCounts.get(key) ?? 0) >= 2)
    ? BOARD_GUIDED_METADATA_OVERUSE_PENALTY
    : 0;
}

function getBoardCandidateScore(profile, boardState, context) {
  const breakdown = {
    sharedTags: 0,
    parentGroup: 0,
    metadataMatch: 0,
    favorite: 0,
    previousOverlap: 0,
    sameDominantTag: 0,
    maxPerTagPenalty: 0,
    metadataOveruse: 0
  };

  const sharedTagCount = Math.min(2, countSharedBoardTags(profile, boardState.tagCounts));
  breakdown.sharedTags += sharedTagCount * BOARD_GUIDED_SHARED_TAG_SCORE;

  const includedFilterMatches = Math.min(2, countSharedBoardTags(profile, context.includedFilterTags));
  breakdown.sharedTags += includedFilterMatches * BOARD_GUIDED_INCLUDED_FILTER_BONUS;

  if (countSharedParentGroups(profile, boardState.parentGroupCounts) > 0) {
    breakdown.parentGroup += BOARD_GUIDED_PARENT_GROUP_SCORE;
  }

  breakdown.metadataMatch += Math.min(2, countSharedMetadata(profile, boardState.metadataCounts)) * BOARD_GUIDED_METADATA_MATCH_SCORE;

  if (profile.favorite) {
    breakdown.favorite += BOARD_GUIDED_FAVORITE_SCORE;
  }

  breakdown.previousOverlap += getBoardGuidedOverlapPenalty(profile, boardState.previousProfile);

  if (boardState.previousProfile?.dominantTag && profile.dominantTag && boardState.previousProfile.dominantTag === profile.dominantTag) {
    breakdown.sameDominantTag += BOARD_GUIDED_PREVIOUS_DOMINANT_PENALTY;
  }

  if (profile.tags.some((tag) => (boardState.tagCounts.get(tag) ?? 0) >= context.maxPerTag)) {
    breakdown.maxPerTagPenalty += BOARD_GUIDED_MAX_PER_TAG_PENALTY;
  }

  breakdown.metadataOveruse += getBoardGuidedMetadataOverusePenalty(profile, boardState.metadataCounts);

  const score = BOARD_GUIDED_BASE_SCORE + Object.values(breakdown).reduce((sum, value) => sum + value, 0);

  return {
    score,
    breakdown
  };
}

function updateTopCandidateBuffer(buffer, candidate, limit = GUIDED_DEBUG_TOP_CANDIDATE_LIMIT) {
  if (!buffer) {
    return;
  }

  buffer.push(candidate);
  buffer.sort((left, right) => right.score - left.score);

  if (buffer.length > limit) {
    buffer.length = limit;
  }
}

function pickWeightedBoardCandidate(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);

  if (!totalWeight) {
    return entries[0] ?? null;
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= entry.weight;
    if (remaining <= 0) {
      return entry;
    }
  }

  return entries.at(-1) ?? null;
}

function selectNextBoardGuidedImage(context, boardState) {
  const weightedCandidates = [];
  const topCandidates = context.collectTopCandidates ? [] : null;

  context.candidateProfiles.forEach((profile) => {
    if (boardState.selectedIds.has(profile.id)) {
      return;
    }

    const result = getBoardCandidateScore(profile, boardState, context);
    const entry = {
      profile,
      score: result.score,
      weight: Math.max(BOARD_GUIDED_MIN_WEIGHT, result.score),
      breakdown: result.breakdown
    };

    weightedCandidates.push(entry);
    updateTopCandidateBuffer(topCandidates, {
      itemId: profile.id,
      score: result.score
    });
  });

  const selectedEntry = pickWeightedBoardCandidate(weightedCandidates);

  return selectedEntry
    ? {
        item: selectedEntry.profile.item,
        score: selectedEntry.score,
        breakdown: selectedEntry.breakdown,
        topCandidates: topCandidates ?? []
      }
    : null;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function getBoardLayoutBounds(imageCount = 0, layoutOptions = {}) {
  const normalizedImageCount = Math.max(1, Math.round(Number(imageCount) || 1));
  const derivedWidth =
    normalizedImageCount <= 4
      ? 1120 + normalizedImageCount * 90
      : normalizedImageCount <= 10
        ? 1320 + normalizedImageCount * 78
        : normalizedImageCount <= 20
          ? 1840 + normalizedImageCount * 94
          : 2200 + normalizedImageCount * 96;
  const derivedHeight =
    normalizedImageCount <= 4
      ? 860 + normalizedImageCount * 70
      : normalizedImageCount <= 10
        ? 980 + normalizedImageCount * 64
        : normalizedImageCount <= 20
          ? 1400 + normalizedImageCount * 78
          : 1640 + normalizedImageCount * 82;
  const derivedPadding = normalizedImageCount <= 10 ? 90 : normalizedImageCount <= 20 ? 128 : 130;

  return {
    width: clampNumber(layoutOptions.width, 900, 5400, derivedWidth),
    height: clampNumber(layoutOptions.height, 700, 4600, derivedHeight),
    padding: clampNumber(layoutOptions.padding, 0, 260, derivedPadding)
  };
}

function getFrameOverlapRatio(frame, otherFrame) {
  const overlapWidth = Math.max(0, Math.min(frame.x + frame.width, otherFrame.x + otherFrame.width) - Math.max(frame.x, otherFrame.x));
  const overlapHeight = Math.max(0, Math.min(frame.y + frame.height, otherFrame.y + otherFrame.height) - Math.max(frame.y, otherFrame.y));

  if (!overlapWidth || !overlapHeight) {
    return 0;
  }

  const overlapArea = overlapWidth * overlapHeight;
  const smallerArea = Math.min(frame.width * frame.height, otherFrame.width * otherFrame.height);

  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

function getFrameOverlapScore(frame, otherFrame) {
  const overlapWidth = Math.max(0, Math.min(frame.x + frame.width, otherFrame.x + otherFrame.width) - Math.max(frame.x, otherFrame.x));
  const overlapHeight = Math.max(0, Math.min(frame.y + frame.height, otherFrame.y + otherFrame.height) - Math.max(frame.y, otherFrame.y));

  if (!overlapWidth || !overlapHeight) {
    return 0;
  }

  const areaRatio = getFrameOverlapRatio(frame, otherFrame);
  const widthRatio = overlapWidth / Math.min(frame.width, otherFrame.width);
  const heightRatio = overlapHeight / Math.min(frame.height, otherFrame.height);

  return areaRatio + widthRatio * 0.35 + heightRatio * 0.35;
}

function framesOverlapWithGap(frame, otherFrame, gap = 0) {
  return !(
    frame.x + frame.width + gap <= otherFrame.x ||
    otherFrame.x + otherFrame.width + gap <= frame.x ||
    frame.y + frame.height + gap <= otherFrame.y ||
    otherFrame.y + otherFrame.height + gap <= frame.y
  );
}

function getBoardSizeProfile(imageCount) {
  if (imageCount <= 4) {
    return {
      widthScale: 0.225,
      minWidth: 220,
      maxWidth: 420,
      gap: BOARD_LAYOUT_GUTTER
    };
  }

  if (imageCount <= 10) {
    return {
      widthScale: 0.172,
      minWidth: 180,
      maxWidth: 340,
      gap: BOARD_LAYOUT_GUTTER
    };
  }

  if (imageCount <= 20) {
    return {
      widthScale: 0.122,
      minWidth: 128,
      maxWidth: 240,
      gap: BOARD_LAYOUT_GUTTER + 6
    };
  }

  return {
    widthScale: 0.112,
    minWidth: 124,
    maxWidth: 232,
    gap: BOARD_LAYOUT_GUTTER
  };
}

function clampFrameToBounds(frame, bounds) {
  return {
    ...frame,
    x: Math.max(bounds.minX, Math.min(bounds.maxX - frame.width, frame.x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY - frame.height, frame.y))
  };
}

function createBoardFrameTemplates(imageCount, width, height, aspectRatios, sizeMultipliers, rotations = []) {
  const profile = getBoardSizeProfile(imageCount);
  const baseWidth = Math.round(Math.min(width, height) * profile.widthScale);

  return Array.from({ length: imageCount }, (_, index) => {
    const sizeMultiplier = Math.max(0.8, Math.min(1.3, Number(sizeMultipliers[index]) || 1));
    const widthVariance = 0.9 + Math.random() * 0.22;
    const frameWidth = Math.max(
      profile.minWidth,
      Math.min(profile.maxWidth, Math.round(baseWidth * widthVariance * sizeMultiplier))
    );
    const aspectRatio = Math.max(0.55, Math.min(1.7, Number(aspectRatios[index]) || 1));

    return {
      index,
      width: frameWidth,
      height: Math.max(110, Math.round(frameWidth / aspectRatio)),
      aspectRatio,
      sizeMultiplier,
      rotation: normalizeImageRotation(rotations[index] ?? 0)
    };
  });
}

function createPlacementCandidate(template, bounds, radiusScale = 1) {
  const spanX = Math.max(0, bounds.maxX - bounds.minX - template.width);
  const spanY = Math.max(0, bounds.maxY - bounds.minY - template.height);
  const radiusX = spanX * 0.5 * radiusScale;
  const radiusY = spanY * 0.5 * radiusScale;
  const distance = Math.pow(Math.random(), 0.82);
  const angle = Math.random() * Math.PI * 2;
  const centerX = (bounds.minX + bounds.maxX - template.width) / 2;
  const centerY = (bounds.minY + bounds.maxY - template.height) / 2;

  return clampFrameToBounds(
    {
      index: template.index,
      x: centerX + Math.cos(angle) * radiusX * distance,
      y: centerY + Math.sin(angle) * radiusY * distance,
      width: template.width,
      height: template.height,
      rotation: template.rotation,
      zIndex: template.index + 1
    },
    bounds
  );
}

function getTemplateRenderMetadata(template, renderMetadataList) {
  return {
    aspectRatio: template.aspectRatio,
    rotation: template.rotation,
    ...(renderMetadataList[template.index] ?? {})
  };
}

function getRenderedCollisionRect(frame, renderMetadata) {
  return getBoardItemRenderedBounds(frame, renderMetadata).collisionRect;
}

function collisionRectFitsBounds(frame, bounds, renderMetadata) {
  const collisionRect = getRenderedCollisionRect(frame, renderMetadata);

  return (
    collisionRect.left >= bounds.minX &&
    collisionRect.right <= bounds.maxX &&
    collisionRect.top >= bounds.minY &&
    collisionRect.bottom <= bounds.maxY
  );
}

function framesOverlapByRenderedBounds(frame, otherFrame, renderMetadata, otherRenderMetadata, gap = 0) {
  return rectanglesIntersect(
    getRenderedCollisionRect(frame, renderMetadata),
    getRenderedCollisionRect(otherFrame, otherRenderMetadata),
    gap
  );
}

function getCandidatePlacementScore(candidate, placedFrames, renderMetadata, placedRenderMetadataList) {
  const collisionRect = getRenderedCollisionRect(candidate, renderMetadata);
  const candidateCenterX = collisionRect.left + collisionRect.width / 2;
  const candidateCenterY = collisionRect.top + collisionRect.height / 2;
  const centerDistance = Math.hypot(candidateCenterX, candidateCenterY);
  const nearestNeighborDistance = placedFrames.length
    ? Math.min(
        ...placedFrames.map((frame) => {
          const otherCollisionRect = getRenderedCollisionRect(frame, placedRenderMetadataList[frame.index]);
          const frameCenterX = otherCollisionRect.left + otherCollisionRect.width / 2;
          const frameCenterY = otherCollisionRect.top + otherCollisionRect.height / 2;
          return Math.hypot(candidateCenterX - frameCenterX, candidateCenterY - frameCenterY);
        })
      )
    : 0;

  return centerDistance + nearestNeighborDistance * 0.42;
}

function placeBoardFramesRandomly(templates, bounds, gap, renderMetadataList) {
  const placedFrames = [];

  for (const template of templates) {
    const renderMetadata = getTemplateRenderMetadata(template, renderMetadataList);
    let bestCandidate = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let attempt = 0; attempt < 220; attempt += 1) {
      const radiusScale = attempt < 120 ? 0.72 : attempt < 180 ? 0.9 : 1;
      const candidate = createPlacementCandidate(template, bounds, radiusScale);

      if (!collisionRectFitsBounds(candidate, bounds, renderMetadata)) {
        continue;
      }

      if (
        placedFrames.some((frame) =>
          framesOverlapByRenderedBounds(candidate, frame, renderMetadata, renderMetadataList[frame.index], gap)
        )
      ) {
        continue;
      }

      const score = getCandidatePlacementScore(candidate, placedFrames, renderMetadata, renderMetadataList);

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) {
      return null;
    }

    placedFrames.push(bestCandidate);
  }

  return placedFrames;
}

function findNextFreePosition(template, bounds, gap, placedFrames, renderMetadataList) {
  const renderMetadata = getTemplateRenderMetadata(template, renderMetadataList);
  const step = Math.max(16, Math.round(gap * 0.8));
  const collisionRectAtOrigin = getRenderedCollisionRect(
    {
      x: 0,
      y: 0,
      width: template.width,
      height: template.height,
      rotation: template.rotation
    },
    renderMetadata
  );
  const frameOffsetX = collisionRectAtOrigin.left;
  const frameOffsetY = collisionRectAtOrigin.top;

  for (let y = bounds.minY - frameOffsetY; y <= bounds.maxY - collisionRectAtOrigin.height - frameOffsetY; y += step) {
    for (let x = bounds.minX - frameOffsetX; x <= bounds.maxX - collisionRectAtOrigin.width - frameOffsetX; x += step) {
      const candidate = {
        ...template,
        x,
        y,
        zIndex: template.index + 1
      };

      if (!collisionRectFitsBounds(candidate, bounds, renderMetadata)) {
        continue;
      }

      if (
        placedFrames.some((frame) =>
          framesOverlapByRenderedBounds(candidate, frame, renderMetadata, renderMetadataList[frame.index], gap)
        )
      ) {
        continue;
      }

      return candidate;
    }
  }

  return null;
}

function resolveBoardCollisions(frames, bounds, gap, renderMetadataList) {
  const resolvedFrames = [];

  for (const frame of frames) {
    const renderMetadata = renderMetadataList[frame.index];
    let nextFrame = frame;

    if (
      !collisionRectFitsBounds(nextFrame, bounds, renderMetadata) ||
      resolvedFrames.some((placedFrame) =>
        framesOverlapByRenderedBounds(nextFrame, placedFrame, renderMetadata, renderMetadataList[placedFrame.index], gap)
      )
    ) {
      nextFrame = findNextFreePosition(frame, bounds, gap, resolvedFrames, renderMetadataList);
    }

    if (!nextFrame) {
      return null;
    }

    resolvedFrames.push(nextFrame);
  }

  return resolvedFrames;
}

function hasAnyRenderedOverlap(frames, gap, renderMetadataList) {
  for (let index = 0; index < frames.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < frames.length; compareIndex += 1) {
      if (
        framesOverlapByRenderedBounds(
          frames[index],
          frames[compareIndex],
          renderMetadataList[frames[index].index],
          renderMetadataList[frames[compareIndex].index],
          gap
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

function createMasonryBoardFrames(templates, bounds, gap, renderMetadataList) {
  const columnCount = Math.max(2, Math.min(6, Math.round(Math.sqrt(templates.length || 1))));
  const usableWidth = Math.max(1, bounds.maxX - bounds.minX);
  const columnWidth = usableWidth / columnCount;
  const columnHeights = Array.from({ length: columnCount }, () => bounds.minY);
  const frames = [];

  for (const template of templates) {
    const renderMetadata = getTemplateRenderMetadata(template, renderMetadataList);
    const collisionAtOrigin = getRenderedCollisionRect(
      {
        x: 0,
        y: 0,
        width: template.width,
        height: template.height,
        rotation: template.rotation
      },
      renderMetadata
    );
    const spanColumns = Math.max(1, Math.min(columnCount, Math.round((collisionAtOrigin.width + gap) / columnWidth)));
    let bestColumn = 0;
    let bestHeight = Number.POSITIVE_INFINITY;

    for (let columnIndex = 0; columnIndex <= columnCount - spanColumns; columnIndex += 1) {
      const occupiedHeight = Math.max(...columnHeights.slice(columnIndex, columnIndex + spanColumns));

      if (occupiedHeight < bestHeight) {
        bestHeight = occupiedHeight;
        bestColumn = columnIndex;
      }
    }

    const targetCollisionLeft = bounds.minX + bestColumn * columnWidth + (columnWidth * spanColumns - collisionAtOrigin.width) / 2;
    const frameX = targetCollisionLeft - collisionAtOrigin.left;
    const frameY = bestHeight - collisionAtOrigin.top;
    const frame = {
      ...template,
      x: frameX,
      y: frameY,
      zIndex: template.index + 1
    };
    const collisionRect = getRenderedCollisionRect(frame, renderMetadata);

    for (let columnIndex = bestColumn; columnIndex < bestColumn + spanColumns; columnIndex += 1) {
      columnHeights[columnIndex] = collisionRect.bottom + gap;
    }

    frames.push(frame);
  }

  return frames;
}

function createRandomBoardFrames(imageCount, layoutOptions = {}) {
  const { width: baseWidth, height: baseHeight, padding } = getBoardLayoutBounds(imageCount, layoutOptions);
  const aspectRatios = Array.isArray(layoutOptions.aspectRatios) ? layoutOptions.aspectRatios : [];
  const sizeMultipliers = Array.isArray(layoutOptions.sizeMultipliers) ? layoutOptions.sizeMultipliers : [];
  const renderMetadataList = Array.isArray(layoutOptions.renderMetadataList) ? layoutOptions.renderMetadataList : [];
  const rotations = Array.isArray(layoutOptions.rotations) ? layoutOptions.rotations : [];
  if (imageCount <= 0) {
    return {
      width: baseWidth,
      height: baseHeight,
      frames: []
    };
  }

  const templates = createBoardFrameTemplates(imageCount, baseWidth, baseHeight, aspectRatios, sizeMultipliers, rotations)
    .sort((left, right) => right.height * right.width - left.height * left.width);
  const baseGap = getBoardSizeProfile(imageCount).gap;
  let workingWidth = baseWidth;
  let workingHeight = baseHeight;
  let frames = null;

  for (let expansionStep = 0; expansionStep < 12; expansionStep += 1) {
    const bounds = {
      minX: -workingWidth / 2 + padding,
      maxX: workingWidth / 2 - padding,
      minY: -workingHeight / 2 + padding,
      maxY: workingHeight / 2 - padding
    };
    const expandedGap = baseGap;
    const placedFrames = placeBoardFramesRandomly(templates, bounds, expandedGap, renderMetadataList);
    const resolvedFrames = placedFrames
      ? resolveBoardCollisions(placedFrames, bounds, expandedGap, renderMetadataList)
      : null;

    if (resolvedFrames && !hasAnyRenderedOverlap(resolvedFrames, expandedGap, renderMetadataList)) {
      frames = resolvedFrames.sort((left, right) => left.zIndex - right.zIndex);
      break;
    }

    const masonryFrames = createMasonryBoardFrames(templates, bounds, expandedGap, renderMetadataList);
    const resolvedMasonryFrames = resolveBoardCollisions(masonryFrames, bounds, expandedGap, renderMetadataList);

    if (resolvedMasonryFrames && !hasAnyRenderedOverlap(resolvedMasonryFrames, expandedGap, renderMetadataList)) {
      frames = resolvedMasonryFrames.sort((left, right) => left.zIndex - right.zIndex);
      break;
    }

    workingWidth = Math.round(workingWidth * 1.16);
    workingHeight = Math.round(workingHeight * 1.16);
  }

  if (!frames) {
    throw new Error("Board layout could not be generated without overlaps.");
  }

  const bounds = frames.reduce(
    (current, frame) => ({
      minX: Math.min(current.minX, getRenderedCollisionRect(frame, renderMetadataList[frame.index]).left),
      minY: Math.min(current.minY, getRenderedCollisionRect(frame, renderMetadataList[frame.index]).top),
      maxX: Math.max(current.maxX, getRenderedCollisionRect(frame, renderMetadataList[frame.index]).right),
      maxY: Math.max(current.maxY, getRenderedCollisionRect(frame, renderMetadataList[frame.index]).bottom)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
  const requiredWidth = Math.max(baseWidth, Math.ceil(bounds.maxX - bounds.minX + padding * 2));
  const requiredHeight = Math.max(baseHeight, Math.ceil(bounds.maxY - bounds.minY + padding * 2));
  const finalWidth = Math.max(requiredWidth, workingWidth);
  const finalHeight = Math.max(requiredHeight, workingHeight);
  const offsetX = finalWidth / 2 - (bounds.minX + bounds.maxX) / 2;
  const offsetY = finalHeight / 2 - (bounds.minY + bounds.maxY) / 2;

  frames.forEach((frame) => {
    frame.x += offsetX;
    frame.y += offsetY;
  });

  if (hasAnyRenderedOverlap(frames, baseGap, renderMetadataList)) {
    throw new Error("Board layout could not be generated without rendered overlap.");
  }

  return {
    width: finalWidth,
    height: finalHeight,
    frames
  };
}

export function getBoardKey(board) {
  const referenceIds = Array.isArray(board?.images)
    ? board.images
      .map((image) => image?.referenceId)
      .filter(Boolean)
      .slice()
      .sort()
    : [];

  return JSON.stringify(referenceIds);
}

export function boardToSyntheticOutfit(board) {
  const syntheticOutfit = Object.fromEntries(visibleSlots.map((slot) => [slot, null]));

  if (!Array.isArray(board?.images)) {
    return syntheticOutfit;
  }

  board.images.forEach((image, index) => {
    const slot = boardGenerationSlots.includes(image?.generationSlot) ? image.generationSlot : getBoardGenerationSlot(index);
    if (slot && image?.referenceId) {
      syntheticOutfit[slot] = image.referenceId;
    }
  });

  return syntheticOutfit;
}

export function createBoardFromReferenceIds(referenceIds = [], layoutOptions = {}) {
  const normalizedReferenceIds = referenceIds.filter(Boolean);
  const itemsByReferenceId = layoutOptions.itemsByReferenceId ?? {};
  const relaidBoard = relayoutBoardImages(
    normalizedReferenceIds.map((referenceId, index) => ({
      id: createBoardId("board_image"),
      referenceId,
      referenceItemUuid: itemsByReferenceId[referenceId]?.itemUuid ?? "",
      generationSlot: getBoardGenerationSlot(index)
    })),
    layoutOptions
  );

  return {
    id: createBoardId("board"),
    width: relaidBoard.width,
    height: relaidBoard.height,
    images: relaidBoard.images
  };
}

export function relayoutBoardImages(boardImages = [], layoutOptions = {}) {
  const normalizedImages = (Array.isArray(boardImages) ? boardImages : []).filter((image) => image?.referenceId);
  const aspectRatiosByReferenceId = layoutOptions.aspectRatiosByReferenceId ?? {};
  const sizeMultipliersByReferenceId = layoutOptions.sizeMultipliersByReferenceId ?? {};
  const renderMetadataByReferenceId = layoutOptions.renderMetadataByReferenceId ?? {};
  const { width, height, frames } = createRandomBoardFrames(normalizedImages.length, {
    ...layoutOptions,
    aspectRatios: normalizedImages.map((image) => aspectRatiosByReferenceId[image.referenceId] ?? 1),
    sizeMultipliers: normalizedImages.map((image) => sizeMultipliersByReferenceId[image.referenceId] ?? 1),
    renderMetadataList: normalizedImages.map((image) => ({
      aspectRatio: aspectRatiosByReferenceId[image.referenceId] ?? renderMetadataByReferenceId[image.referenceId]?.aspectRatio ?? 1,
      ...(renderMetadataByReferenceId[image.referenceId] ?? {}),
      rotation: normalizeImageRotation(image.rotation ?? renderMetadataByReferenceId[image.referenceId]?.rotation ?? 0)
    })),
    rotations: normalizedImages.map((image) => normalizeImageRotation(image.rotation ?? 0))
  });

  return {
    width,
    height,
    images: normalizedImages.map((image, index) => ({
      ...image,
      generationSlot: boardGenerationSlots.includes(image.generationSlot)
        ? image.generationSlot
        : getBoardGenerationSlot(index),
      zIndex: index + 1,
      ...frames[index]
    }))
  };
}

function pickWeightedRandom(entries) {
  const totalWeight = entries.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (!totalWeight) {
    return pickRandom(entries.map((entry) => entry.item));
  }

  let remaining = Math.random() * totalWeight;

  for (const entry of entries) {
    remaining -= Math.max(0, entry.weight);
    if (remaining <= 0) {
      return entry.item;
    }
  }

  return entries.at(-1)?.item ?? null;
}

export function getOutfitKey(outfit, layering) {
  return JSON.stringify({
    layering: Boolean(layering),
    slots: Object.fromEntries(visibleSlots.map((slot) => [slot, outfit?.[slot] ?? null]))
  });
}

function buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId) {
  return ["pair", sourceSlot, targetSlot, sourceItemId, targetItemId].join("|");
}

function buildAffinityItemKey(slot, itemId) {
  return ["item", slot, itemId].join("|");
}

function getAffinityUpdatesForOutfit(outfit) {
  const updates = {};

  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    const sourceItemId = outfit?.[sourceSlot];
    const targetItemId = outfit?.[targetSlot];

    if (!sourceItemId || !targetItemId) {
      return;
    }

    const pairKey = buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, targetItemId);
    updates[pairKey] = (updates[pairKey] ?? 0) + 1;
  });

  visibleSlots.forEach((slot) => {
    const itemId = outfit?.[slot];

    if (!itemId) {
      return;
    }

    const itemKey = buildAffinityItemKey(slot, itemId);
    updates[itemKey] = (updates[itemKey] ?? 0) + 1;
  });

  return updates;
}

export function applyOutfitAffinityDelta(currentAffinity, outfit, delta) {
  const nextAffinity = { ...normalizeAffinityMap(currentAffinity) };
  const updates = getAffinityUpdatesForOutfit(outfit);

  Object.entries(updates).forEach(([key, count]) => {
    const nextCount = Math.max(0, (nextAffinity[key] ?? 0) + count * delta);

    if (nextCount > 0) {
      nextAffinity[key] = nextCount;
    } else {
      delete nextAffinity[key];
    }
  });

  return nextAffinity;
}

function sanitizeRecentOutfitSlots(outfit) {
  return Object.fromEntries(visibleSlots.map((slot) => [slot, outfit?.[slot] ?? null]));
}

function normalizeRecentOutfitEntry(entry) {
  const outfit = sanitizeRecentOutfitSlots(entry?.outfit);
  const layering = Boolean(entry?.layering);

  return {
    key: typeof entry?.key === "string" ? entry.key : getOutfitKey(outfit, layering),
    outfit,
    layering,
    liked: Boolean(entry?.liked)
  };
}

export function normalizeRecentOutfits(value) {
  return Array.isArray(value) ? value.map(normalizeRecentOutfitEntry).slice(0, RECENT_OUTFIT_WINDOW) : [];
}

export function rememberRecentOutfit(currentRecentOutfits, outfit, layering, options = {}) {
  const { liked, preserveLiked = false } = options;
  const entry = normalizeRecentOutfitEntry({
    outfit,
    layering,
    liked: Boolean(liked)
  });
  const existing = normalizeRecentOutfits(currentRecentOutfits);
  const previous = existing.find((current) => current.key === entry.key);

  return [
    {
      ...entry,
      liked: typeof liked === "boolean" ? liked : preserveLiked ? previous?.liked || false : false
    },
    ...existing.filter((current) => current.key !== entry.key)
  ].slice(0, RECENT_OUTFIT_WINDOW);
}

export function isEligibleForGeneration(item, excluded = {}, generationLists = defaultGenerationLists) {
  return !excluded[item.id] && generationLists[normalizeList(item.list)] !== false;
}

export function getPool(items, slot, excluded = {}, generationLists = defaultGenerationLists, layering = true) {
  return items.filter((item) => {
    if (!isEligibleForGeneration(item, excluded, generationLists)) {
      return false;
    }

    if (slot === "Headwear") return item.garmentType === "Headwear";
    if (slot === "Bottom") return item.garmentType === "Bottom";
    if (slot === "Footwear") return item.garmentType === "Footwear";

    if (slot === "TopInner") {
      if (!layering) {
        return item.garmentType === "Top" || item.garmentType === "Outerwear";
      }

      return item.garmentType === "Top" && (item.layerType === "Inner" || item.layerType === "Both");
    }

    if (slot === "TopOuter") {
      return (
        (item.garmentType === "Top" || item.garmentType === "Outerwear") &&
        (item.layerType === "Outer" || item.layerType === "Both")
      );
    }

    if (accessorySlots.includes(slot)) {
      return item.garmentType === "Accessory" && item.accessorySlot === slot;
    }

    return false;
  });
}

function getEligibleSlotPoolInternal(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  let pool = getPool(items, slot, excluded, generationLists, layering);

  if (layering && (slot === "TopInner" || slot === "TopOuter")) {
    const otherTopSlot = getOtherTopSlot(slot);
    const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

    if (otherItem?.layerType === "Both") {
      pool = pool.filter((item) => item.layerType !== "Both");
    }

    pool = filterPoolForLayeringRules(pool, slot, outfit, itemsById);
  }

  pool = applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit, itemsById, {
    ...ruleOptions,
    excluded,
    generationLists,
    items,
    layering
  });
  return filterPoolForCompatibilityRules(pool, slot, outfit, itemsById);
}

export function getEligibleSlotPool(
  items,
  slot,
  excluded = {},
  generationLists = defaultGenerationLists,
  layering = true,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  outfit = {},
  itemsById = {},
  ruleOptions = {}
) {
  return getEligibleSlotPoolInternal(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, outfit, itemsById, ruleOptions);
}

function inferStyleTags(item) {
  const manualTags = normalizeTagList(item.styleTags, styleTagOptions);

  if (manualTags.length) {
    return manualTags;
  }

  return normalizeTagList(resolveTypeDefaults(item.type).styleTags, styleTagOptions);
}

function inferClimateTags(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const garmentType = item.garmentType;
  const weight = normalizeWeight(item.weight);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  return climateTagOptions.filter((climate) => {
    if (climate === "Hot") {
      return (
        weight === "Light" ||
        hasType("shorts", "sandals", "t-shirt", "shirt", "casual shirt")
      ) && weight !== "Heavy" && garmentType !== "Outerwear" && !hasType("coat", "boots");
    }

    if (climate === "Warm") {
      return (
        weight === "Light" ||
        weight === "Medium" ||
        hasType("shorts", "sandals", "sneakers", "t-shirt", "shirt", "casual shirt", "trousers", "jeans")
      ) && weight !== "Heavy" && !hasType("coat", "boots", "beanie", "scarf");
    }

    if (climate === "Cold" || climate === "Snow") {
      return (
        weight === "Heavy" ||
        garmentType === "Outerwear" ||
        hasType("coat", "jacket", "knit", "sweatshirt", "hoodie", "boots", "beanie", "scarf")
      ) && !hasType("shorts", "sandals");
    }

    if (climate === "Rain") {
      return garmentType === "Outerwear" || hasType("coat", "jacket", "boots", "cap", "shell jacket");
    }

    if (climate === "Transitional") {
      return (
        weight === "Medium" ||
        hasType("jacket", "knit", "shirt", "casual shirt", "trousers", "jeans", "sneakers", "blazer")
      ) && weight !== "Heavy" && !hasType("shorts", "coat");
    }

    return false;
  });
}

export function getItemStyleTags(item) {
  return inferStyleTags(item);
}

export function getItemClimateTags(item) {
  return [...new Set([...inferClimateTags(item), ...normalizeTagList(item.climateTags, climateTagOptions)])];
}

export function hasActiveOutfitFilters(outfitFilters) {
  return Object.keys(outfitFilterOptions).some((group) => {
    const values = outfitFilters?.[group];
    return Array.isArray(values) && values.length > 0;
  });
}

export function normalizeGenerationMode(mode) {
  return generationModes.includes(mode) ? mode : defaultGenerationMode;
}

function getGenerationClimatePreferences(outfitFilters, weatherData) {
  if (Array.isArray(outfitFilters?.climate) && outfitFilters.climate.length) {
    return outfitFilters.climate;
  }

  return [];
}

function getPickedOutfitItems(outfit, itemsById) {
  return visibleSlots.map((slot) => itemsById[outfit[slot]]).filter(Boolean);
}

const climateTieBreakPriority = {
  Transitional: 5,
  Warm: 4,
  Hot: 3,
  Cold: 2,
  Snow: 1,
  Rain: 0
};

function getOutfitClimateWeight(item, slot) {
  const weight = normalizeWeight(item.weight);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopOuter") {
    if (item.garmentType !== "Outerwear") return 1.9;
    if (weight === "Heavy") {
      return hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket") ? 4.6 : 4.1;
    }
    return weight === "Medium" ? 3.2 : 2.7;
  }
  if (slot === "TopInner") return weight === "Heavy" ? 1.8 : weight === "Medium" ? 1.45 : 1.1;
  if (slot === "Bottom") return weight === "Heavy" ? 2.1 : 1.9;
  if (slot === "Footwear") return weight === "Heavy" ? 2.8 : 2.2;
  if (slot === "Headwear") return 0.55;
  return 1;
}

function scoreOutfitClimate(items) {
  const scores = Object.fromEntries(climateTagOptions.map((climate) => [climate, 0]));
  let rainSignalCount = 0;
  let hasHeavyOuterwear = false;
  let hasHeavyColdOuterwear = false;
  let hasBoots = false;
  let hasColdHeadwear = false;
  let warmWeatherSignalCount = 0;

  items.forEach(({ item, slot }) => {
    const typeMatches = getTypeMatchKeys(item.type);
    const hasType = (...types) => types.some((type) => typeMatches.has(type));
    const itemClimateTags = new Set(getItemClimateTags(item));
    const baseWeight = getOutfitClimateWeight(item, slot);
    const itemWeight = normalizeWeight(item.weight);

    itemClimateTags.forEach((climate) => {
      scores[climate] += baseWeight;
    });

    if (slot === "TopOuter" && item.garmentType === "Outerwear") {
      if (itemWeight === "Heavy") {
        hasHeavyOuterwear = true;
        scores.Cold += 2.6;
        scores.Snow += 1.1;
        if (hasType("wool coat", "wool jacket", "coat", "puffer", "puffer jacket")) {
          hasHeavyColdOuterwear = true;
          scores.Cold += 2.2;
          scores.Transitional -= 0.4;
        }
      } else if (itemWeight === "Medium") {
        scores.Transitional += 1.2;
        if (hasType("jacket", "wool jacket", "blazer")) {
          scores.Transitional += 0.5;
        }
      }

      if (hasType("shell jacket")) {
        scores.Rain += 2.2;
        scores.Transitional += 0.8;
        rainSignalCount += 2;
      }
    }

    if (slot === "TopInner") {
      if (hasType("hoodie", "sweatshirt", "knit sweater", "fleece sweater")) {
        scores.Cold += 0.65;
        scores.Transitional += 0.8;
      }
      if (hasType("sport t-shirt", "t-shirt")) {
        scores.Warm += 0.55;
        scores.Hot += 0.35;
        warmWeatherSignalCount += 1;
      }
      if (hasType("shirt")) {
        scores.Transitional += 0.45;
      }
    }

    if (slot === "Bottom") {
      if (hasType("shorts", "sport shorts")) {
        scores.Hot += 1.6;
        scores.Warm += 1.1;
        warmWeatherSignalCount += 1;
      }
      if (hasType("trousers", "jeans", "sport pants", "sweat pants")) {
        scores.Transitional += 0.7;
      }
    }

    if (slot === "Footwear") {
      if (hasType("boots")) {
        hasBoots = true;
        scores.Cold += 1.9;
        scores.Rain += 0.8;
        scores.Transitional += 0.35;
        rainSignalCount += 1;
      }
      if (hasType("slides", "sandals")) {
        scores.Hot += 1.4;
        scores.Warm += 0.8;
        warmWeatherSignalCount += 1;
      }
      if (hasType("sneakers", "canvas sneakers")) {
        scores.Warm += 0.5;
        scores.Transitional += 0.4;
      }
    }

    if (slot === "Headwear") {
      if (hasType("beanie")) {
        hasColdHeadwear = true;
        scores.Cold += itemWeight === "Light" ? 0.45 : 0.8;
      }
      if (hasType("cap", "sport cap")) {
        scores.Rain += 0.5;
        scores.Warm += 0.3;
        rainSignalCount += 1;
      }
    }
  });

  if (rainSignalCount >= 3) {
    scores.Rain += 1.8;
  }

  if (scores.Rain < 3.2) {
    scores.Rain -= 1.2;
  }

  if (scores.Hot > 0 && scores.Warm >= scores.Hot - 0.75) {
    scores.Warm += 0.6;
  }

  if (scores.Snow > 0 && scores.Cold >= scores.Snow - 0.9) {
    scores.Cold += 0.6;
  }

  if (scores.Transitional > 0 && scores.Warm > 0 && Math.abs(scores.Transitional - scores.Warm) <= 1.1) {
    scores.Transitional += 0.55;
  }

  if (hasHeavyOuterwear && hasBoots) {
    scores.Cold += 3.2;
    scores.Warm -= 1.8;
    scores.Hot -= 2.2;
  } else if (hasHeavyColdOuterwear && hasColdHeadwear) {
    scores.Cold += 2.2;
    scores.Warm -= 1.2;
  } else if (hasHeavyColdOuterwear) {
    scores.Cold += 1.5;
    scores.Warm -= 0.9;
  }

  if (hasHeavyOuterwear && warmWeatherSignalCount < 2) {
    scores.Warm -= 0.9;
    scores.Hot -= 1.4;
  }

  return scores;
}

export function getCurrentOutfitClimateChip(items) {
  if (!items?.length) {
    return "Everyday";
  }

  const slottedItems = items
    .map((entry) => (entry?.item ? entry : entry ? { item: entry, slot: "Unknown" } : null))
    .filter(Boolean);

  if (!slottedItems.length) {
    return "Everyday";
  }

  const scores = scoreOutfitClimate(slottedItems);
  const ranked = Object.entries(scores).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return (climateTieBreakPriority[right[0]] ?? -1) - (climateTieBreakPriority[left[0]] ?? -1);
  });

  if (!ranked.length || ranked[0][1] <= 0.75) {
    return "Everyday";
  }

  return ranked[0][0];
}

function getDominantStyleTags(items) {
  const counts = new Map();

  items.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    });
  });

  const maxCount = Math.max(0, ...counts.values());
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count === maxCount && count > 0)
      .map(([style]) => style)
  );
}

function getDominantStyleCounts(items) {
  const counts = new Map();

  items.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts.set(style, (counts.get(style) ?? 0) + 1);
    });
  });

  return counts;
}

function rankStyleCounts(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function resolveDominantStyleFromCounts(counts, selectedStyles = []) {
  const ranked = rankStyleCounts(counts);

  if (!ranked.length) {
    return selectedStyles?.[0] ?? "Casual";
  }

  const topScore = ranked[0][1];
  const closeSelectedMatch = (selectedStyles ?? []).find((style) => (counts.get(style) ?? 0) >= topScore - 1);

  if (closeSelectedMatch) {
    return closeSelectedMatch;
  }

  const tiedStyles = ranked.filter(([, score]) => score === topScore).map(([style]) => style);
  const selectedMatch = (selectedStyles ?? []).find((style) => tiedStyles.includes(style));
  return selectedMatch ?? tiedStyles[0];
}

function styleToMode(style) {
  if (style === "Formal") return "formal";
  if (style === "Smart Casual") return "smart-casual";
  if (style === "Athleisure") return "athleisure";
  return "casual";
}

function modeToStyle(styleMode) {
  if (styleMode === "formal" || styleMode === "formal-bridge") return "Formal";
  if (styleMode === "smart-casual") return "Smart Casual";
  if (styleMode === "athleisure") return "Athleisure";
  return "Casual";
}

function clampScore(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeGuidedScoreComponent(key, value) {
  const config = guidedScoreNormalizers[key];
  if (!config) {
    return value;
  }

  const scaledValue = value * config.scale;
  return clampScore(scaledValue, config.min, config.max);
}

function normalizeGuidedBreakdown(breakdown) {
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [key, normalizeGuidedScoreComponent(key, value)])
  );
}

export function classifyOutfitStyle(items, selectedStyles = []) {
  return resolveDominantStyleFromCounts(getDominantStyleCounts(items), selectedStyles);
}

export function getOutfitDominantStyle(outfit, itemsById, selectedStyles = []) {
  return classifyOutfitStyle(getPickedOutfitItems(outfit, itemsById), selectedStyles);
}

function getRecentDominantStyles(recentOutfits, itemsById, selectedStyles = []) {
  return normalizeRecentOutfits(recentOutfits)
    .map((entry) => classifyOutfitStyle(getPickedOutfitItems(entry.outfit, itemsById), selectedStyles))
    .filter(Boolean);
}

export function getCurrentOutfitStyleChip(items, selectedStyles) {
  return classifyOutfitStyle(items, selectedStyles);
}

function getClimateScore(item, slot, climatePreferences) {
  if (!climatePreferences.length) return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const climateTags = new Set(getItemClimateTags(item));
  let score = 0;

  climatePreferences.forEach((climate) => {
    if (climateTags.has(climate)) score += 1.4;

    if (climate === "Hot") {
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.6;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 1.5 : 4.5;
      }
      if (slot === "TopInner") {
        if (hasType("t-shirt", "shirt")) score += 3;
        else if (hasType("ls t-shirt")) score += 1;
        else if (hasType("sweatshirt", "knit sweater", "hoodie", "wool shirt")) score -= 2;
      } else if (slot === "Bottom") {
        if (hasType("shorts", "trousers")) score += 2;
        else if (hasType("jeans")) score += 1;
      } else if (slot === "Footwear") {
        if (hasType("sneakers", "canvas sneakers")) score += 2;
        else if (hasType("slides", "sandals")) score += 1;
        else if (hasType("boots")) score -= 2;
      } else if (slot === "TopOuter") {
        if (item.garmentType === "Outerwear") score -= normalizeWeight(item.weight) === "Heavy" ? 4 : 2;
      }
    }

    if (climate === "Warm") {
      if (slot === "Headwear") {
        if (hasType("sport cap", "cap")) score += 1.1;
        if (hasType("beanie")) score -= normalizeWeight(item.weight) === "Light" ? 0.8 : 2.6;
      }
      if (hasType("t-shirt", "shirt", "sneakers", "canvas sneakers", "trousers", "shorts")) score += 1;
      if (item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") score -= 2;
      if (hasType("scarf")) score -= 3;
    }

    if (climate === "Cold" || climate === "Snow") {
      if (slot === "TopInner") {
        if (hasType("knit sweater", "sweatshirt", "hoodie")) score += 3;
        else if (hasType("shirt", "wool shirt")) score += 1;
        else if (hasType("t-shirt")) score -= 2;
      } else if (slot === "TopOuter") {
        if (hasType("wool coat", "wool jacket")) score += 4;
        else if (hasType("jacket", "twill jacket", "denim jacket", "fleece jacket")) score += 2;
        else if (item.garmentType === "Outerwear") score += 1;
        else score -= 4;
      } else if (slot === "Footwear") {
        if (hasType("boots")) score += 3;
        else if (hasType("leather sneakers")) score += 1;
        else if (hasType("canvas sneakers")) score -= 1;
      }
    }

    if (climate === "Rain") {
      if (slot === "TopOuter" && item.garmentType === "Outerwear") score += 2;
      if (slot === "Footwear" && hasType("boots")) score += 2;
    }

    if (climate === "Transitional") {
      if (hasType("jacket", "twill jacket", "shirt", "trousers", "jeans", "sneakers", "blazer")) score += 1;
      if (normalizeWeight(item.weight) === "Heavy") score -= 1;
    }
  });

  if (climatePreferences.includes("Hot") && hasType("scarf")) score -= 5;
  return score;
}

function isAthleisureOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length === 1 && itemStyles[0] === "Athleisure";
}

function isFormalOnlyItem(item) {
  const itemStyles = getItemStyleTags(item);
  return itemStyles.length > 0 && itemStyles.every((style) => style === "Formal");
}

function isAthleisureSneaker(item) {
  const typeMatches = getTypeMatchKeys(item.type);
  const itemStyles = getItemStyleTags(item);
  return typeMatches.has("sneakers") && itemStyles.includes("Athleisure");
}

function getFormalCoreSlots(layering) {
  return layering ? ["TopInner", "Bottom", "Footwear", "TopOuter"] : ["TopInner", "Bottom", "Footwear"];
}

function isStrongFormalAnchor(item, slot) {
  if (!item) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopInner") {
    return hasType("shirt");
  }

  if (slot === "Bottom") {
    return hasType("trousers", "light trousers", "heavy wool trousers");
  }

  if (slot === "Footwear") {
    return hasType("derby");
  }

  if (slot === "TopOuter") {
    return hasType("blazer", "wool coat", "wool jacket");
  }

  return false;
}

function isFormalBridgeItem(item, slot) {
  if (!item || isStrongFormalAnchor(item, slot)) return false;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const itemStyles = getItemStyleTags(item);
  const hasSmartCasual = itemStyles.includes("Smart Casual");
  const hasFormal = itemStyles.includes("Formal");
  const hasCasual = itemStyles.includes("Casual");
  const hasAthleisure = itemStyles.includes("Athleisure");

  if (hasAthleisure) return false;
  if (hasType("leather sneakers", "boots", "light boots", "boots (chunky, winter, lined)", "knit", "knit sweater", "thick knit sweater", "knit vest")) {
    return true;
  }

  return hasSmartCasual && !hasFormal && hasCasual;
}

function countFormalStructure(outfit, itemsById, layering) {
  return getFormalCoreSlots(layering).reduce(
    (counts, slot) => {
      const item = itemsById[outfit[slot]];

      if (isStrongFormalAnchor(item, slot)) counts.formal += 1;
      else if (isFormalBridgeItem(item, slot)) counts.bridge += 1;

      return counts;
    },
    { formal: 0, bridge: 0 }
  );
}

function hasPotentialFormalAnchorForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => isStrongFormalAnchor(candidate, slot));
}

function hasPotentialNonBridgeForSlot(slot, outfit, itemsById, context) {
  const pool = getEligibleSlotPoolInternal(
    context.items ?? Object.values(itemsById),
    slot,
    context.excluded ?? {},
    context.generationLists ?? defaultGenerationLists,
    context.layering ?? true,
    context.outfitFilters ?? emptyOutfitFilters,
    context.weatherData ?? null,
    outfit,
    itemsById,
    {
      skipFormalStructure: true
    }
  );

  return pool.some((candidate) => !isFormalBridgeItem(candidate, slot));
}

function passesFormalStructureRules(item, currentOutfit, slot, itemsById, context = {}) {
  const layering = context.layering ?? true;
  const nextOutfit = {
    ...currentOutfit,
    [slot]: item.id
  };
  const topInner = itemsById[nextOutfit.TopInner];
  const bottom = itemsById[nextOutfit.Bottom];
  const footwear = itemsById[nextOutfit.Footwear];
  const counts = countFormalStructure(nextOutfit, itemsById, layering);
  const remainingSlots = getFormalCoreSlots(layering).filter((coreSlot) => !nextOutfit[coreSlot]);
  const potentialFormalAnchors = remainingSlots.filter((coreSlot) => hasPotentialFormalAnchorForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const forcedBridgeSlots = remainingSlots.filter((coreSlot) => !hasPotentialNonBridgeForSlot(coreSlot, nextOutfit, itemsById, context)).length;
  const topInnerNeedsFormalAnchor = !topInner ? hasPotentialFormalAnchorForSlot("TopInner", nextOutfit, itemsById, context) : isStrongFormalAnchor(topInner, "TopInner");
  const bottomNeedsFormalAnchor = !bottom ? hasPotentialFormalAnchorForSlot("Bottom", nextOutfit, itemsById, context) : isStrongFormalAnchor(bottom, "Bottom");

  if (counts.bridge > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < 2) {
    return false;
  }

  if (counts.bridge + forcedBridgeSlots > 2) {
    return false;
  }

  if (counts.formal + potentialFormalAnchors < counts.bridge + forcedBridgeSlots) {
    return false;
  }

  if (footwear && isFormalBridgeItem(footwear, "Footwear")) {
    if (!topInnerNeedsFormalAnchor || !bottomNeedsFormalAnchor) {
      return false;
    }
  }

  if (bottom && !isStrongFormalAnchor(bottom, "Bottom")) {
    if (footwear) {
      if (!isStrongFormalAnchor(footwear, "Footwear")) {
        return false;
      }
    } else if (!hasPotentialFormalAnchorForSlot("Footwear", nextOutfit, itemsById, context)) {
      return false;
    }
  }

  return true;
}

function resolveSelectedStyleMode(selectedStyles) {
  const uniqueStyles = [...new Set((selectedStyles ?? []).filter(Boolean))];

  if (!uniqueStyles.length) return "no-filter";
  if (uniqueStyles.every((style) => style === "Casual")) return "casual";

  const hasFormal = uniqueStyles.includes("Formal");
  const hasSmartCasual = uniqueStyles.includes("Smart Casual");
  const hasAthleisure = uniqueStyles.includes("Athleisure");

  if (hasFormal && hasSmartCasual && hasAthleisure) return "minimal";
  if (hasFormal && hasSmartCasual) return "formal-bridge";
  if (hasFormal && hasAthleisure) return "minimal";
  if (hasSmartCasual && hasAthleisure) return "minimal-bridge";
  if (hasFormal) return "formal";
  if (hasSmartCasual) return "smart-casual";
  if (hasAthleisure) return "athleisure";
  return "casual";
}

function getStyleBlockProfile(styleMode) {
  return {
    styleMode,
    blockNoFilterSportCap: styleMode === "no-filter",
    blockFormalSet: styleMode === "formal",
    blockFormalBridgeSet: styleMode === "formal-bridge",
    blockSmartCasualSet: styleMode === "smart-casual",
    blockAthleisureSet: styleMode === "athleisure"
  };
}

function getAnchoredStyle(outfit, itemsById, selectedStyles = []) {
  const pickedItems = getPickedOutfitItems(outfit, itemsById);
  if (
    !(selectedStyles ?? []).length &&
    pickedItems.some((item) => {
      const typeMatches = getTypeMatchKeys(item.type);
      return typeMatches.has("sport cap") || typeMatches.has("sport t-shirt") || typeMatches.has("sport ls t-shirt") || typeMatches.has("sport shorts");
    })
  ) {
    return "Athleisure";
  }

  if (pickedItems.length < 2) return null;

  const counts = getDominantStyleCounts(pickedItems);
  const ranked = rankStyleCounts(counts);
  const dominantEntry = ranked[0];

  if (!dominantEntry || dominantEntry[1] < 2) return null;

  return dominantEntry[0];
}

function passesSelectedStyleRules(item, slot, selectedStyles, outfit = {}, itemsById = {}, context = {}) {
  const styleMode = resolveSelectedStyleMode(selectedStyles);
  const profile = getStyleBlockProfile(styleMode);
  const anchoredStyle = getAnchoredStyle(outfit, itemsById, selectedStyles);

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const isAthleisureOnly = isAthleisureOnlyItem(item);
  const isFormalOnly = isFormalOnlyItem(item);
  const hasFormalBridgeBlockedType = hasType(
    "shorts",
    "slides",
    "sandals",
    "sport cap",
    "beanie",
    "fleece jacket",
    "shell jacket",
    "hoodie",
    "sweatshirt",
    "sport t-shirt"
  );

  if (profile.blockNoFilterSportCap && hasType("sport cap") && anchoredStyle && anchoredStyle !== "Athleisure") {
    return false;
  }

  if (profile.blockFormalSet) {
    if (hasType("shorts", "slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "hoodie", "sweatshirt", "sport t-shirt", "fleece sweater")) {
      return false;
    }
    if (isAthleisureOnly || isAthleisureSneaker(item)) {
      return false;
    }
    if (slot === "Footwear") {
      const itemStyles = getItemStyleTags(item);
      const hasSmartCasual = itemStyles.includes("Smart Casual");
      const hasFormal = itemStyles.includes("Formal");
      const hasCasual = itemStyles.includes("Casual");
      const hasAthleisure = itemStyles.includes("Athleisure");
      const isBridgeFootwear =
        hasFormal ||
        hasSmartCasual ||
        (hasCasual && hasSmartCasual && !hasAthleisure) ||
        (hasType("leather sneakers") && !hasAthleisure);

      if (!isBridgeFootwear) {
        return false;
      }
    }
    if (!context.skipFormalStructure && !passesFormalStructureRules(item, outfit, slot, itemsById, context)) {
      return false;
    }
  }

  if (profile.blockFormalBridgeSet && hasFormalBridgeBlockedType) return false;

  if (profile.blockSmartCasualSet) {
    if (hasType("slides", "sandals", "sport cap", "beanie", "fleece jacket", "shell jacket", "sport t-shirt", "sport ls t-shirt", "sport shorts", "fleece sweater", "hoodie", "sweatshirt", "sneakers", "sneakers (thin)", "canvas sneakers")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (profile.blockAthleisureSet) {
    if (hasType("derby", "wool coat", "wool jacket", "blazer", "shirt", "wool shirt") || isFormalOnly) {
      return false;
    }
    if (getItemStyleTags(item).every((style) => style === "Smart Casual" || style === "Formal")) {
      return false;
    }
  }

  if (anchoredStyle === "Smart Casual" || anchoredStyle === "Formal") {
    if (hasType("sport cap", "sport t-shirt", "sport ls t-shirt", "sport shorts")) {
      return false;
    }
    if (isAthleisureOnly) {
      return false;
    }
  }

  if (anchoredStyle === "Athleisure") {
    if (hasType("derby", "jacket", "jeans", "boots") || isFormalOnly) {
      return false;
    }
  }

  return true;
}

function passesHardContextRules(item, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const selectedStyles = outfitFilters.style ?? [];
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const existingTopInner = itemsById[outfit.TopInner];
  const existingTopOuter = itemsById[outfit.TopOuter];
  const existingBottom = itemsById[outfit.Bottom];
  const existingTopInnerMatches = existingTopInner ? getTypeMatchKeys(existingTopInner.type) : new Set();
  const existingTopOuterWeight = normalizeWeight(existingTopOuter?.weight);
  const hasLightOrSportTop =
    existingTopInner &&
    normalizeWeight(existingTopInner.weight) === "Light" &&
    ["t-shirt", "ls t-shirt", "sport t-shirt", "sport ls t-shirt"].some((type) => existingTopInnerMatches.has(type));
  const hasSmartShirtTop =
    existingTopInner &&
    existingTopInner.garmentType === "Top" &&
    existingTopInnerMatches.has("shirt") &&
    getItemStyleTags(existingTopInner).some((style) => style === "Smart Casual" || style === "Formal");

  if (climatePreferences.includes("Hot")) {
    if (slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") return false;
    if (hasType("wool coat")) return false;
    if (slot === "Headwear" && hasType("beanie")) return false;
  }

  if (climatePreferences.includes("Warm")) {
    if (slot === "Headwear" && hasType("beanie") && normalizeWeight(item.weight) !== "Light") return false;
  }

  if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
    if (hasType("shorts", "slides", "sandals")) return false;
    if (slot === "TopInner" && hasType("sport t-shirt", "sport ls t-shirt")) return false;
    if (hasLightOrSportTop && ((slot === "TopOuter" && item.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy") || (slot === "Footwear" && hasType("boots")))) {
      return false;
    }
  }

  if (climatePreferences.includes("Rain")) {
    if (hasType("slides", "sandals")) return false;
  }

  if (
    hasSmartShirtTop &&
    ((slot === "Bottom" && hasType("shorts")) ||
      (slot === "TopOuter" && item.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(normalizeWeight(item.weight)) && existingBottom && getTypeMatchKeys(existingBottom.type).has("shorts")) ||
      (slot === "Bottom" && hasType("shorts") && existingTopOuter && existingTopOuter.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(existingTopOuterWeight)))
  ) {
    return false;
  }

  return passesSelectedStyleRules(item, slot, selectedStyles, outfit, itemsById, {
    ...context,
    outfitFilters,
    weatherData
  });
}

export function applyContextValidityRulesToPool(pool, slot, outfitFilters, weatherData, outfit = {}, itemsById = {}, context = {}) {
  const filtered = pool.filter((item) => passesHardContextRules(item, slot, outfitFilters, weatherData, outfit, itemsById, context));
  return filtered.length ? filtered : pool;
}

function getDominantStyleMode(selectedStyles, pickedItems, noFilterData = null) {
  const selectedStyleMode = resolveSelectedStyleMode(selectedStyles);
  const counts = getDominantStyleCounts(pickedItems);

  if (pickedItems.length < 2) {
    return selectedStyleMode === "no-filter" ? noFilterData?.targetMode ?? "casual" : selectedStyleMode;
  }

  const dominantEntry = rankStyleCounts(counts)[0];
  if (!dominantEntry || dominantEntry[1] < 2) return selectedStyleMode;

  return styleToMode(dominantEntry[0]);
}

function getPoolStyleSupport(pool) {
  const counts = {};
  let total = 0;

  pool.forEach((item) => {
    getItemStyleTags(item).forEach((style) => {
      counts[style] = (counts[style] ?? 0) + 1;
      total += 1;
    });
  });

  return Object.fromEntries(
    Object.entries(noFilterStyleWeights).map(([style, weight]) => [
      style,
      total ? (counts[style] ?? 0) / total : weight
    ])
  );
}

function getAdjustedNoFilterWeights(recentStyles, support, anchoredStyle = null) {
  if (anchoredStyle) {
    return Object.fromEntries(
      Object.keys(noFilterStyleWeights).map((style) => [style, style === anchoredStyle ? 1 : 0.1])
    );
  }

  const recentWindow = Math.max(recentStyles.length, 4);
  const recentCounts = Object.fromEntries(Object.keys(noFilterStyleWeights).map((style) => [style, 0]));

  recentStyles.forEach((style) => {
    if (recentCounts[style] !== undefined) recentCounts[style] += 1;
  });

  const streakStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
  const lastStyle = recentStyles[0] ?? null;

  return Object.fromEntries(
    Object.entries(noFilterStyleWeights).map(([style, baseWeight]) => {
      const recentShare = recentCounts[style] / recentWindow;
      const absenceBoost = recentCounts[style] === 0 ? (style === "Athleisure" ? 0.24 : 0.16) : recentCounts[style] === 1 ? (style === "Athleisure" ? 0.1 : 0.06) : 0;
      const oversharePenalty = Math.max(0, recentShare - baseWeight) * 1.8;
      const streakPenalty = streakStyle === style ? 1.05 : lastStyle === style ? 0.24 : 0;
      const supportMultiplier = Math.max(0.2, Math.min(style === "Formal" ? 1.08 : 1.15, (support?.[style] ?? 0.25) * 1.6));
      const styleBias = style === "Smart Casual" ? 1.1 : style === "Formal" ? 0.82 : 1;
      return [style, Math.max(0.02, (baseWeight + absenceBoost - oversharePenalty - streakPenalty) * supportMultiplier * styleBias)];
    })
  );
}

function pickWeightedStyle(weights) {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (!totalWeight) return "Casual";

  let remaining = Math.random() * totalWeight;
  for (const [style, weight] of entries) {
    remaining -= weight;
    if (remaining <= 0) return style;
  }

  return entries.at(-1)?.[0] ?? "Casual";
}

function getEligibleStyleSupport(items, excluded, generationLists) {
  return getPoolStyleSupport(
    items.filter((item) => isEligibleForGeneration(item, excluded, generationLists) && visibleSlots.some((slot) => getPool([item], slot, {}, generationLists).length))
  );
}

function buildNoFilterGenerationContext(items, excluded, generationLists, recentOutfits, itemsById) {
  const support = getEligibleStyleSupport(items, excluded, generationLists);
  const recentStyles = getRecentDominantStyles(recentOutfits, itemsById);
  const weights = getAdjustedNoFilterWeights(recentStyles, support, null);
  const repeatedRecentStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
  const targetCandidates = repeatedRecentStyle
    ? Object.fromEntries(
        Object.entries(weights).map(([style, weight]) => [
          style,
          style === repeatedRecentStyle && Object.entries(weights).some(([otherStyle, otherWeight]) => otherStyle !== style && otherWeight > 0.08)
            ? 0
            : weight
        ])
      )
    : weights;
  const targetStyle = pickWeightedStyle(targetCandidates);

  return {
    support,
    weights,
    targetStyle,
    targetMode: styleToMode(targetStyle),
    avoidStyle: repeatedRecentStyle
  };
}

function getNoFilterPreference(item, noFilterData) {
  const itemStyles = getItemStyleTags(item);
  if (!noFilterData || !itemStyles.length) return 0;

  const styleWeight = itemStyles.reduce((sum, style) => sum + (noFilterData.weights[style] ?? 0), 0) / itemStyles.length;
  const supportWeight = itemStyles.reduce((sum, style) => sum + (noFilterData.support[style] ?? 0.25), 0) / itemStyles.length;
  const anchoredStyle = noFilterData.anchoredStyle;
  const isFormalOnly = isFormalOnlyItem(item);
  const isAthleisureOnly = isAthleisureOnlyItem(item);

  let score = styleWeight * 4.4 + supportWeight * 1.2;
  const targetStyle = noFilterData.targetStyle;
  const avoidStyle = noFilterData.avoidStyle;

  if (anchoredStyle) {
    if (itemStyles.includes(anchoredStyle)) score += anchoredStyle === "Formal" ? 3.2 : 2.4;
    else if (anchoredStyle === "Formal" && itemStyles.includes("Athleisure")) score -= 4;
    else if (anchoredStyle === "Smart Casual" && isAthleisureOnly) score -= 3.5;
    else if (anchoredStyle === "Athleisure" && isFormalOnly) score -= 4;
  } else {
    if (itemStyles.includes("Smart Casual")) score += 0.85;
    if (isFormalOnly && (noFilterData.weights.Formal ?? 0) < 0.14) score -= 0.7;
    if (isFormalOnly) score -= 0.15;
    if (isAthleisureOnly && (noFilterData.weights.Athleisure ?? 0) < 0.22) score -= 1.2;
    if (isAthleisureOnly && (noFilterData.weights.Athleisure ?? 0) >= 0.22) score += 1.4;
    if (targetStyle && itemStyles.includes(targetStyle)) {
      score += targetStyle === "Formal" ? 2.9 : 1.8;
    }
    if (targetStyle === "Formal" && itemStyles.includes("Smart Casual")) {
      score += 1.1;
    }
    if (avoidStyle && itemStyles.includes(avoidStyle)) {
      score -= itemStyles.length === 1 ? 4.4 : 3.4;
    }
  }

  return score;
}

function getStyleCompletionScore(item, slot, styleMode) {
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  let score = 0;

  if (styleMode === "formal") {
    if (slot === "TopInner" && hasType("shirt")) score += 6;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 6;
    if (slot === "Footwear" && hasType("derby")) score += 6;
    if (slot === "Footwear" && getItemStyleTags(item).includes("Formal")) score += 2.4;
    if (slot === "TopOuter" && hasType("blazer", "wool coat")) score += 6;
    if (item.garmentType === "Accessory" && item.accessorySlot === "LeftHand" && hasType("watch")) score += 1.5;
    if (item.garmentType === "Accessory" && item.accessorySlot === "Belt" && hasType("belt")) score += 1.2;
    if (slot === "Headwear" && hasType("hat")) score += 1.5;
    if (slot === "Headwear" && hasType("cap")) score -= 2.6;
    if (slot === "Bottom" && hasType("jeans")) score -= 2.5;
    if (slot === "TopInner" && hasType("t-shirt", "ls t-shirt")) score -= 2.4;
  }

  if (styleMode === "formal-bridge") {
    if (slot === "TopInner" && hasType("shirt")) score += 3.5;
    if (slot === "Bottom" && hasType("trousers", "light trousers", "heavy wool trousers")) score += 3.5;
    if (slot === "Footwear" && hasType("derby", "leather sneakers")) score += hasType("derby") ? 3.5 : 2.2;
    if (slot === "TopOuter" && hasType("blazer", "wool coat", "jacket", "wool jacket")) score += hasType("blazer", "wool coat") ? 3.5 : 2;
    if (slot === "Headwear" && hasType("hat")) score += 1.2;
    if (slot === "Bottom" && hasType("jeans")) score -= 1;
  }

  if (styleMode === "smart-casual") {
    if (slot === "TopInner" && hasType("shirt", "casual shirt", "knit", "knit sweater", "wool shirt", "fleece sweater")) score += hasType("shirt", "wool shirt") ? 4.8 : 3.8;
    if (slot === "Footwear" && hasType("leather sneakers", "boots", "derby")) score += hasType("leather sneakers") ? 4.2 : hasType("boots") ? 2.8 : 1.6;
    if (slot === "TopOuter" && hasType("jacket", "twill jacket", "blazer", "wool coat", "wool jacket")) score += hasType("blazer", "wool coat") ? 4.2 : 3.2;
    if (slot === "Headwear" && hasType("hat")) score += 1;
    if (slot === "Bottom" && hasType("trousers", "light trousers")) score += 3.5;
    if (slot === "Bottom" && hasType("jeans")) score += 1.2;
  }

  if (styleMode === "athleisure") {
    if (slot === "TopInner" && hasType("hoodie", "sweatshirt", "sport t-shirt", "sport ls t-shirt", "fleece sweater")) score += hasType("sport t-shirt", "sport ls t-shirt") ? 5 : 4.4;
    if (slot === "Footwear" && hasType("sneakers", "sneakers (thin)", "canvas sneakers")) score += 4.8;
    if (slot === "Headwear" && hasType("cap", "sport cap")) score += hasType("sport cap") ? 4.8 : 3.8;
    if (slot === "TopOuter" && hasType("shell jacket", "fleece jacket")) score += 4.4;
    if (slot === "Bottom" && hasType("sport shorts", "sport pants", "sweat pants", "shorts")) score += hasType("sport shorts", "sport pants") ? 4.8 : hasType("sweat pants") ? 4.2 : 1.8;
  }

  return score;
}

function getDominancePenaltyScore(item, pickedItems, styleMode) {
  if (pickedItems.length < 2) return 0;

  const counts = getDominantStyleCounts(pickedItems);
  const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!dominantEntry || dominantEntry[1] < 2) return 0;

  const [dominantStyle] = dominantEntry;
  const itemStyles = getItemStyleTags(item);

  if (dominantStyle === "Formal") {
    if (itemStyles.includes("Athleisure")) return -3.5;
    if (itemStyles.includes("Casual") && !itemStyles.includes("Formal") && !itemStyles.includes("Smart Casual")) return -2;
  }
  if (dominantStyle === "Athleisure" && itemStyles.includes("Formal")) return -3.5;
  if (dominantStyle === "Smart Casual" && isAthleisureOnlyItem(item)) return -2.5;
  return styleMode === "minimal" || styleMode === "minimal-bridge" ? 0 : 0;
}

function getWeightContrastScore(item, pickedItems) {
  const itemWeight = normalizeWeight(item.weight);
  if (!pickedItems.length) return 0;

  const hasHeavyPickedItem = pickedItems.some((pickedItem) => normalizeWeight(pickedItem.weight) === "Heavy");
  const hasLightPickedItem = pickedItems.some((pickedItem) => normalizeWeight(pickedItem.weight) === "Light");

  if ((itemWeight === "Heavy" && hasLightPickedItem) || (itemWeight === "Light" && hasHeavyPickedItem)) return -1.5;
  return 0;
}

function getCrossStyleConflictScore(item, pickedItems, selectedStyles) {
  const itemStyles = getItemStyleTags(item);
  const selectedStyleSet = new Set(selectedStyles ?? []);

  if (!selectedStyleSet.has("Formal") || !selectedStyleSet.has("Athleisure")) {
    const pickedHasFormal = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).includes("Formal"));
    const pickedHasAthleisure = pickedItems.some((pickedItem) => getItemStyleTags(pickedItem).includes("Athleisure"));
    const itemIsFormal = itemStyles.includes("Formal");
    const itemIsAthleisure = itemStyles.includes("Athleisure");

    if ((pickedHasFormal && itemIsAthleisure) || (pickedHasAthleisure && itemIsFormal)) return -2.2;
  }

  return 0;
}

function getHotOuterwearScore(item, slot, climatePreferences) {
  if (climatePreferences.includes("Hot") && slot === "TopOuter" && item.garmentType === "Outerwear") {
    return normalizeWeight(item.weight) === "Heavy" ? -2 : -1.25;
  }
  return 0;
}

function getLonelyExtremesScore(item, slot, outfit, itemsById) {
  if (!["TopInner", "TopOuter", "Bottom", "Footwear"].includes(slot)) return 0;

  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const heavyCount = nextItems.filter((candidate) => normalizeWeight(candidate.weight) === "Heavy").length;
  const lightCount = nextItems.filter((candidate) => normalizeWeight(candidate.weight) === "Light").length;

  if (heavyCount === 1 && lightCount >= 2) return -1.15;
  if (lightCount === 1 && heavyCount >= 2) return -1;
  return 0;
}

function getBaselineOutfitScore(item, slot) {
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));

  if (slot === "TopInner" && hasType("t-shirt", "shirt")) return hasType("shirt") ? 0.9 : 0.8;
  if (slot === "Bottom" && hasType("jeans", "trousers", "light trousers")) return 1.2;
  if (slot === "Footwear" && hasType("sneakers", "leather sneakers")) return 1.2;
  return 0;
}

function getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles, noFilterData) {
  if (pickedItems.length >= 2 || slot === "Headwear") return 0;

  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const selectedStyleSet = new Set(selectedStyles ?? []);
  const noFilterWeights = noFilterData?.weights ?? noFilterStyleWeights;
  const isNoFilter = !selectedStyleSet.size;

  if (hasType("shirt")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 2.2 : isNoFilter ? 1.2 + noFilterWeights["Smart Casual"] * 1.8 : 1.3;
  if (hasType("hoodie", "sport t-shirt", "sport ls t-shirt", "sweatshirt")) return selectedStyleSet.has("Athleisure") ? 2.2 : isNoFilter ? 1.25 + noFilterWeights.Athleisure * 2.6 : 1.3;
  if (hasType("trousers", "light trousers", "derby")) return selectedStyleSet.has("Formal") || selectedStyleSet.has("Smart Casual") ? 1.4 : isNoFilter ? 0.8 + (noFilterWeights["Smart Casual"] + noFilterWeights.Formal) * 1.1 : 0.8;
  if (hasType("sport shorts", "shell jacket", "fleece jacket")) return selectedStyleSet.has("Athleisure") ? 1.4 : isNoFilter ? 0.9 + noFilterWeights.Athleisure * 1.8 : 0.8;
  return 0;
}

function getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById) {
  const normalizedRecentOutfits = normalizeRecentOutfits(recentOutfits);
  const scores = { recentItemPenalty: 0, recentExactPenalty: 0, recentLikedBoost: 0, styleStreakPenalty: 0 };

  if (!normalizedRecentOutfits.length) return scores;

  const completedOutfit = { ...outfit, [slot]: item.id };
  const isComplete = visibleSlots.every((visibleSlot) => completedOutfit[visibleSlot]);
  const completedStyle = isComplete ? getOutfitDominantStyle(completedOutfit, itemsById) : null;

  normalizedRecentOutfits.forEach((recentOutfit, index) => {
    const itemPenalty = recentItemPenaltySteps[index] ?? 0;
    const slotPenalty = recentSlotPenaltySteps[index] ?? 0;
    const exactPenalty = recentExactPenaltySteps[index] ?? 0;
    const likedBoost = recentLikedBoostSteps[index] ?? 0;
    const itemUsed = visibleSlots.some((recentSlot) => recentOutfit.outfit?.[recentSlot] === item.id);
    if (itemUsed) {
      scores.recentItemPenalty -= itemPenalty;
      if (recentOutfit.outfit?.[slot] === item.id) {
        scores.recentItemPenalty -= slotPenalty;
      }
    }

    affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
      if (targetSlot !== slot || !recentOutfit.liked) return;
      const sourceItemId = outfit?.[sourceSlot];
      if (!sourceItemId) return;
      if (recentOutfit.outfit?.[sourceSlot] === sourceItemId && recentOutfit.outfit?.[targetSlot] === item.id) {
        scores.recentLikedBoost += likedBoost;
      }
    });

    if (isComplete && recentOutfit.key === getOutfitKey(completedOutfit, layering)) {
      scores.recentExactPenalty -= exactPenalty;
    }
  });

  if (completedStyle && normalizedRecentOutfits.length >= 2) {
    const recentStyles = getRecentDominantStyles(normalizedRecentOutfits, itemsById);
    if (recentStyles[0] === completedStyle && recentStyles[1] === completedStyle) {
      scores.styleStreakPenalty -= 0.5;
    } else if (recentStyles[0] === completedStyle) {
      scores.styleStreakPenalty -= 0.2;
    }
  }

  scores.recentItemPenalty = clampScore(scores.recentItemPenalty, MAX_RECENT_ITEM_PENALTY, 0);
  scores.recentExactPenalty = clampScore(scores.recentExactPenalty, MAX_RECENT_EXACT_PENALTY, 0);
  scores.styleStreakPenalty = clampScore(scores.styleStreakPenalty, MAX_STYLE_STREAK_PENALTY, 0);

  return scores;
}

function getColdLightTopPenalty(item, slot, outfit, itemsById, climatePreferences) {
  if (!climatePreferences.some((climate) => climate === "Cold" || climate === "Snow")) return 0;
  if (!["TopInner", "TopOuter", "Footwear"].includes(slot)) return 0;

  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const hasHeavyOuterwear = nextItems.some((candidate) => candidate.garmentType === "Outerwear" && normalizeWeight(candidate.weight) === "Heavy");
  const hasBoots = nextItems.some((candidate) => getTypeMatchKeys(candidate.type).has("boots"));
  const lightOrSportTop = nextItems.some((candidate) => {
    const typeMatches = getTypeMatchKeys(candidate.type);
    const hasType = (...types) => types.some((type) => typeMatches.has(type));
    if (candidate.garmentType !== "Top" && candidate.garmentType !== "Outerwear") return false;
    return normalizeWeight(candidate.weight) === "Light" && hasType("t-shirt", "ls t-shirt", "sport t-shirt", "sport ls t-shirt");
  });

  if (!lightOrSportTop) return 0;
  if (hasHeavyOuterwear && hasBoots) return -4.2;
  if (hasHeavyOuterwear || hasBoots) return -2.6;
  return 0;
}

function getMismatchedSeasonalityScore(item, slot, outfit, itemsById) {
  const nextItems = getPickedOutfitItems({ ...outfit, [slot]: item.id }, itemsById);
  const hasSmartInner = nextItems.some((candidate) => {
    const typeMatches = getTypeMatchKeys(candidate.type);
    return candidate.garmentType === "Top" && typeMatches.has("shirt") && getItemStyleTags(candidate).some((style) => style === "Smart Casual" || style === "Formal");
  });
  const hasShorts = nextItems.some((candidate) => candidate.garmentType === "Bottom" && getTypeMatchKeys(candidate.type).has("shorts"));
  const hasMediumOuterwear = nextItems.some((candidate) => candidate.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(normalizeWeight(candidate.weight)));

  if (hasSmartInner && hasShorts && hasMediumOuterwear) return -5.5;
  return 0;
}

function getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences) {
  return {
    weightContrast: getWeightContrastScore(item, pickedItems),
    styleConflict: getCrossStyleConflictScore(item, pickedItems, selectedStyles),
    hotOuterwear: getHotOuterwearScore(item, slot, climatePreferences),
    lonelyExtremes: getLonelyExtremesScore(item, slot, outfit, itemsById),
    coldLightTopPenalty: getColdLightTopPenalty(item, slot, outfit, itemsById, climatePreferences),
    mismatchedSeasonality: getMismatchedSeasonalityScore(item, slot, outfit, itemsById)
  };
}

function getStyleCoherenceScore(item, slot, selectedStyles, preferredStyles, noFilterData) {
  const itemStyles = getItemStyleTags(item);
  const isAthleisureOnly = itemStyles.length === 1 && itemStyles[0] === "Athleisure";
  const isFormalOnly = isFormalOnlyItem(item);
  const typeMatches = getTypeMatchKeys(item.type);
  const hasType = (...types) => types.some((type) => typeMatches.has(type));
  const styleMode = resolveSelectedStyleMode(selectedStyles);

  if (!itemStyles.length) return 0;

  let score = 0;

  if (selectedStyles.length) {
    if (selectedStyles.some((style) => itemStyles.includes(style))) {
      score += styleMode === "casual" ? 4 : 6;
    } else {
      score -= isAthleisureOnly || isFormalOnly ? 5.5 : 3;
    }

    if ((styleMode === "formal" || styleMode === "formal-bridge") && hasType("t-shirt", "sport t-shirt", "ls t-shirt", "ls t-shirt (light)")) {
      score -= 4.8;
    }

    if (styleMode === "formal" && hasType("cap", "jeans")) {
      score -= hasType("cap") ? 2.6 : 2;
    }

    if (styleMode === "formal" && slot === "Footwear" && !itemStyles.includes("Formal")) {
      score -= hasType("leather sneakers") ? 5.4 : 6;
    }

    if (styleMode === "smart-casual" && hasType("sport t-shirt", "sport ls t-shirt", "sport shorts", "sport cap", "slides", "sandals", "fleece jacket", "shell jacket")) {
      score -= 4.5;
    }

    if (styleMode === "smart-casual" && hasType("hoodie", "sweatshirt")) {
      score -= 2.6;
    }

    if (styleMode === "athleisure") {
      if (hasType("wool shirt", "shirt", "blazer", "derby", "wool coat", "wool jacket")) {
        score -= 6;
      }
      if (itemStyles.every((style) => style === "Smart Casual" || style === "Formal")) {
        score -= 5.4;
      }
    }
  }

  if (preferredStyles.size) {
    const overlapCount = itemStyles.filter((style) => preferredStyles.has(style)).length;
    score += overlapCount * 2;
    if (!overlapCount && itemStyles.length) {
      score -= isAthleisureOnly && !preferredStyles.has("Athleisure") ? 3 : 1;
    }
  }

  if (styleMode === "no-filter") {
    score += getNoFilterPreference(item, noFilterData) * 0.4;
  }

  return score;
}

function getAffinityScore(item, slot, outfit, outfitAffinity) {
  const affinity = normalizeAffinityMap(outfitAffinity);
  let score = 0;

  affinityRelationships.forEach(([sourceSlot, targetSlot]) => {
    if (targetSlot !== slot) return;

    const sourceItemId = outfit?.[sourceSlot];
    if (!sourceItemId) return;

    const pairCount = affinity[buildAffinityPairKey(sourceSlot, targetSlot, sourceItemId, item.id)] ?? 0;
    score += Math.min(pairCount * 0.14, 0.35);
  });

  const itemCount = affinity[buildAffinityItemKey(slot, item.id)] ?? 0;
  score += Math.min(itemCount * 0.05, 0.2);

  return Math.min(score, MAX_AFFINITY_BOOST);
}

function buildNoFilterData(pool, outfit, itemsById, recentOutfits, generationContext = null) {
  const support = getPoolStyleSupport(pool);
  const anchoredStyle = getAnchoredStyle(outfit, itemsById);
  const baseWeights = generationContext?.weights ?? getAdjustedNoFilterWeights(getRecentDominantStyles(recentOutfits, itemsById), support, anchoredStyle);
  const targetStyle = anchoredStyle ?? generationContext?.targetStyle ?? pickWeightedStyle(baseWeights);
  return {
    support,
    anchoredStyle,
    weights: anchoredStyle ? getAdjustedNoFilterWeights(getRecentDominantStyles(recentOutfits, itemsById), support, anchoredStyle) : baseWeights,
    targetStyle,
    targetMode: styleToMode(targetStyle)
  };
}

export function getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool = [], generationContext = null) {
  const pickedItems = getPickedOutfitItems(outfit, itemsById);
  const selectedStyles = outfitFilters.style ?? [];
  const climatePreferences = getGenerationClimatePreferences(outfitFilters, weatherData);
  const preferredStyles = getDominantStyleTags(pickedItems);
  const noFilterData = !selectedStyles.length ? buildNoFilterData(pool, outfit, itemsById, recentOutfits, generationContext) : null;
  const styleMode = getDominantStyleMode(selectedStyles, pickedItems, noFilterData);
  const breakdown = {
    climate: getClimateScore(item, slot, climatePreferences),
    styleCoherence: getStyleCoherenceScore(item, slot, selectedStyles, preferredStyles, noFilterData),
    styleCompletion: getStyleCompletionScore(item, slot, styleMode),
    dominance: getDominancePenaltyScore(item, pickedItems, styleMode),
    ...getSoftBalanceScore(item, slot, outfit, itemsById, pickedItems, selectedStyles, climatePreferences),
    baseline: getBaselineOutfitScore(item, slot),
    earlyAnchor: getEarlyStyleAnchorScore(item, slot, pickedItems, selectedStyles, noFilterData),
    selectedStyleBonus: 0,
    favorite: item.favorite ? 0.5 : 0,
    affinity: getAffinityScore(item, slot, outfit, outfitAffinity),
    recentItemPenalty: 0,
    recentExactPenalty: 0,
    recentLikedBoost: 0,
    coldOuterwear: 0,
    noFilterVariety: 0,
    styleStreakPenalty: 0
  };

  if (slot === "TopOuter") {
    if (climatePreferences.includes("Cold") || climatePreferences.includes("Snow")) {
      breakdown.coldOuterwear += item.garmentType === "Outerwear" ? 3 : -4;
    }

    if (climatePreferences.includes("Hot")) {
      breakdown.hotOuterwear += item.garmentType === "Outerwear" ? -3 : 0;
    }
  }

  if ((slot === "TopInner" || slot === "Bottom" || slot === "Footwear" || slot === "TopOuter") && selectedStyles.length) {
    const styleModeBonus = styleMode === "formal" ? 2.8 : styleMode === "athleisure" ? 2.6 : styleMode === "smart-casual" ? 2.2 : 1.2;
    breakdown.selectedStyleBonus += getItemStyleTags(item).some((style) => selectedStyles.includes(style)) ? styleModeBonus : 0;
  }

  if (!selectedStyles.length) {
    breakdown.noFilterVariety += getNoFilterPreference(item, noFilterData) * 0.65;
  }

  const recentScores = getRecentMemoryScore(item, slot, outfit, recentOutfits, layering, itemsById);
  breakdown.recentItemPenalty += recentScores.recentItemPenalty;
  breakdown.recentExactPenalty += recentScores.recentExactPenalty;
  breakdown.recentLikedBoost += recentScores.recentLikedBoost;
  breakdown.styleStreakPenalty += recentScores.styleStreakPenalty;

  const normalizedBreakdown = normalizeGuidedBreakdown(breakdown);
  const score = GUIDED_BASE_SCORE + Object.values(normalizedBreakdown).reduce((sum, value) => sum + value, 0);
  return {
    score: Math.max(GUIDED_SCORE_FLOOR, score),
    breakdown: normalizedBreakdown
  };
}

function scoreCandidateForGuidedGeneration(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool, generationContext) {
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool, generationContext).score;
}

function selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  if (!pool.length) return null;
  if (normalizeGenerationMode(generationMode) === "random") {
    const item = pickRandom(pool);
    return item ? { item, score: null, breakdown: null } : null;
  }

  let candidatePool = pool;
  const selectedStyles = outfitFilters.style ?? [];

  if (!selectedStyles.length) {
    const recentStyles = getRecentDominantStyles(recentOutfits, itemsById);
    const repeatedRecentStyle = recentStyles[0] && recentStyles[0] === recentStyles[1] ? recentStyles[0] : null;
    const completesOutfit = visibleSlots.every((visibleSlot) => visibleSlot === slot || Boolean(outfit[visibleSlot]));

    if (repeatedRecentStyle && completesOutfit) {
      const streakSafePool = pool.filter((item) => getOutfitDominantStyle({ ...outfit, [slot]: item.id }, itemsById) !== repeatedRecentStyle);
      if (streakSafePool.length) {
        candidatePool = streakSafePool;
      }
    }
  }

  const weightedCandidates = candidatePool.map((item) => {
    const result = getGuidedScoreBreakdown(
      item,
      slot,
      outfit,
      itemsById,
      outfitFilters,
      weatherData,
      outfitAffinity,
      recentOutfits,
      layering,
      candidatePool,
      generationContext
    );

    return {
      item,
      weight: result.score,
      score: result.score,
      breakdown: result.breakdown
    };
  });
  const pickedItem = pickWeightedRandom(weightedCandidates);
  if (!pickedItem) {
    return null;
  }

  const selectedEntry = weightedCandidates.find((entry) => entry.item.id === pickedItem.id) ?? null;
  const topCandidates = selectedEntry
    ? [
        selectedEntry,
        ...weightedCandidates
          .filter((entry) => entry.item.id !== selectedEntry.item.id)
          .sort((left, right) => right.score - left.score)
          .slice(0, GUIDED_DEBUG_TOP_CANDIDATE_LIMIT - 1)
      ]
        .sort((left, right) => right.score - left.score)
        .map((entry) => ({
          itemId: entry.item.id,
          score: entry.score
        }))
    : [];
  return selectedEntry
    ? {
        ...selectedEntry,
        topCandidates
      }
    : null;
}

export function pickNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext = null) {
  return selectNextItemForGeneration(pool, slot, outfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext)?.item ?? null;
}

export function getGuidedBreakdownDisplayEntries(breakdown = {}, limit = 3) {
  return Object.entries(breakdown)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
    .slice(0, limit)
    .map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

function summarizeGuidedReasonEntries(entries = []) {
  const aggregated = {};
  const seenKeys = new Set();

  entries.forEach((entry) => {
    Object.entries(entry.breakdown ?? {}).forEach(([key, value]) => {
      seenKeys.add(key);
      if (!value) return;
      const current = aggregated[key] ?? { total: 0, count: 0 };
      current.total += value;
      current.count += 1;
      aggregated[key] = current;
    });
  });

  const averagedEntries = Object.entries(aggregated)
    .map(([key, entry]) => [key, entry.total / entry.count])
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]));
  const thresholdedEntries = averagedEntries.filter(([, value]) => Math.abs(value) >= 0.2);
  const fallbackZeroEntries =
    !averagedEntries.length && seenKeys.size
      ? [...seenKeys].map((key) => [key, 0])
      : averagedEntries;
  const displayEntries = (thresholdedEntries.length ? thresholdedEntries : fallbackZeroEntries).slice(0, 6);

  return displayEntries.map(([key, value]) => ({
      key,
      label: guidedExplanationLabels[key] ?? key,
      value
    }));
}

export function isNonStackableTopType(item) {
  return (item.garmentType === "Top" || item.garmentType === "Outerwear") && nonStackableTopTypes.has(normalizeType(item.type));
}

export function getOtherTopSlot(slot) {
  if (slot === "TopInner") return "TopOuter";
  if (slot === "TopOuter") return "TopInner";
  return null;
}

export function filterPoolForLayeringRules(pool, slot, outfit, itemsById) {
  if (slot !== "TopInner" && slot !== "TopOuter") return pool;

  const otherTopSlot = getOtherTopSlot(slot);
  const otherItem = otherTopSlot ? itemsById[outfit[otherTopSlot]] : null;

  if (!otherItem || !isNonStackableTopType(otherItem)) return pool;

  const blockedType = normalizeType(otherItem.type);
  return pool.filter((item) => normalizeType(item.type) !== blockedType);
}

function isHeavyOuterwear(item) {
  return item?.garmentType === "Outerwear" && normalizeWeight(item.weight) === "Heavy";
}

function isWarmWeatherConflictItem(item) {
  const type = normalizeType(item?.type);

  if (item?.garmentType === "Bottom") return type === "shorts";
  if (item?.garmentType === "Footwear") return ["slide", "slides", "sandal", "sandals"].includes(type);
  return false;
}

function isOutfitCompatible(outfit, itemsById) {
  const selectedItems = visibleSlots
    .map((slot) => itemsById[outfit[slot]])
    .filter(Boolean);

  return !selectedItems.some(isHeavyOuterwear) || !selectedItems.some(isWarmWeatherConflictItem);
}

export function filterPoolForCompatibilityRules(pool, slot, outfit, itemsById) {
  if (!pool.length || !["TopOuter", "Bottom", "Footwear"].includes(slot)) return pool;

  const filtered = pool.filter((item) =>
    isOutfitCompatible(
      {
        ...outfit,
        [slot]: item.id
      },
      itemsById
    )
  );

  return filtered.length ? filtered : pool;
}

function buildNextOutfitResult(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  options = {}
) {
  const nextOutfit = { ...currentOutfit };
  const guidedDebugPayload = [];
  const itemsById = Object.fromEntries(items.map((item) => [item.id, item]));
  const generationContext = !(outfitFilters.style ?? []).length
    ? buildNoFilterGenerationContext(items, excluded, generationLists, recentOutfits, itemsById)
    : null;

  visibleSlots.forEach((slot) => {
    if (!locked[slot]) nextOutfit[slot] = null;
  });

  visibleSlots.forEach((slot) => {
    if (locked[slot]) {
      return;
    }

    if (!layering && slot === "TopOuter") {
      nextOutfit[slot] = null;
      return;
    }

    const pool = getEligibleSlotPool(items, slot, excluded, generationLists, layering, outfitFilters, weatherData, nextOutfit, itemsById);
    const selection = selectNextItemForGeneration(pool, slot, nextOutfit, itemsById, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits, layering, generationContext);
    nextOutfit[slot] = selection?.item?.id ?? null;

    if (options.includeGuidedDebug && normalizeGenerationMode(generationMode) === "guided" && selection?.item && selection?.breakdown) {
      guidedDebugPayload.push({
        slot,
        itemId: selection.item.id,
        breakdown: selection.breakdown,
        score: selection.score,
        topCandidates: selection.topCandidates ?? []
      });
    }
  });

  return {
    outfit: nextOutfit,
    guidedDebugPayload
  };
}

export function generateBoard({
  items,
  imageCount = DEFAULT_BOARD_IMAGE_COUNT,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  layoutOptions = {},
  debugHooks = null,
  boardFilters = null,
  boardGuidedOptions = {}
}) {
  markGenerationPerf(debugHooks, "generate:start", {
    itemCount: Array.isArray(items) ? items.length : 0,
    imageCount,
    generationMode
  });
  const normalizedItems = filterBoardGenerationItems(items, boardFilters);
  const aspectRatiosByReferenceId = layoutOptions.aspectRatiosByReferenceId ?? {};
  const sizeMultipliersByReferenceId = layoutOptions.sizeMultipliersByReferenceId ?? {};
  const renderMetadataByReferenceId = layoutOptions.renderMetadataByReferenceId ?? {};
  const candidatePool = buildBoardCandidatePool(normalizedItems, excluded, generationLists);
  markGenerationPerf(debugHooks, "candidate pool ready", { candidatePoolSize: candidatePool.length });
  const resolvedImageCount = Math.max(1, Math.round(Number(imageCount) || DEFAULT_BOARD_IMAGE_COUNT));
  const targetImageCount = Math.min(resolvedImageCount, candidatePool.length);
  const syntheticOutfit = Object.fromEntries(visibleSlots.map((slot) => [slot, null]));
  const guidedDebugPayload = [];
  const selectedReferenceIds = new Set();
  const selectedBoardItems = [];
  const normalizedGenerationMode = normalizeGenerationMode(generationMode);

  if (normalizedGenerationMode === "guided") {
    const boardContext = buildBoardGuidedContext(candidatePool, {
      boardFilters,
      maxPerTag: boardGuidedOptions.maxPerTag,
      collectTopCandidates: boardGuidedOptions.collectTopCandidates
    });
    const boardState = createBoardGuidedState();

    markGenerationPerf(debugHooks, "selection setup ready", {
      targetImageCount,
      candidateProfiles: boardContext.candidateProfiles.length,
      collectTopCandidates: boardContext.collectTopCandidates
    });

    for (let index = 0; index < targetImageCount; index += 1) {
      const generationSlot = getBoardGenerationSlot(index);
      const selection = selectNextBoardGuidedImage(boardContext, boardState);

      if (!selection?.item?.id) {
        break;
      }

      const selectedProfile = boardContext.profilesById[selection.item.id];
      addBoardProfileToState(boardState, selectedProfile);
      selectedReferenceIds.add(selection.item.id);
      syntheticOutfit[generationSlot] = selection.item.id;
      selectedBoardItems.push({
        item: selection.item,
        generationSlot
      });
      guidedDebugPayload.push({
        slot: generationSlot,
        itemId: selection.item.id,
        breakdown: selection.breakdown,
        score: selection.score,
        topCandidates: selection.topCandidates ?? []
      });
    }
  } else {
    const itemsById = Object.fromEntries(normalizedItems.map((item) => [item.id, item]));
    const generationContext = !(outfitFilters.style ?? []).length
      ? buildNoFilterGenerationContext(normalizedItems, excluded, generationLists, recentOutfits, itemsById)
      : null;

    markGenerationPerf(debugHooks, "selection setup ready", {
      targetImageCount,
      hasNoFilterContext: Boolean(generationContext)
    });

    for (let index = 0; index < targetImageCount; index += 1) {
      const generationSlot = getBoardGenerationSlot(index);
      const pool = getRemainingBoardPool(candidatePool, selectedReferenceIds);
      const selection = selectNextItemForGeneration(
        pool,
        generationSlot,
        syntheticOutfit,
        itemsById,
        outfitFilters,
        weatherData,
        generationMode,
        outfitAffinity,
        recentOutfits,
        true,
        generationContext
      );

      if (selection?.item?.id) {
        selectedReferenceIds.add(selection.item.id);
        syntheticOutfit[generationSlot] = selection.item.id;
        selectedBoardItems.push({
          item: selection.item,
          generationSlot
        });
      }

      if (selection?.item && selection?.breakdown) {
        guidedDebugPayload.push({
          slot: generationSlot,
          itemId: selection.item.id,
          breakdown: selection.breakdown,
          score: selection.score,
          topCandidates: selection.topCandidates ?? []
        });
      }
    }
  }
  markGenerationPerf(debugHooks, "selection logic done", { selectedCount: selectedBoardItems.length });
  const { width, height, frames } = createRandomBoardFrames(selectedBoardItems.length, {
    ...layoutOptions,
    aspectRatios: selectedBoardItems.map(({ item }) => aspectRatiosByReferenceId[item.id] ?? 1),
    sizeMultipliers: selectedBoardItems.map(({ item }) => sizeMultipliersByReferenceId[item.id] ?? 1),
    renderMetadataList: selectedBoardItems.map(({ item }) => ({
      aspectRatio: aspectRatiosByReferenceId[item.id] ?? renderMetadataByReferenceId[item.id]?.aspectRatio ?? 1,
      ...(renderMetadataByReferenceId[item.id] ?? {}),
      rotation: normalizeImageRotation(renderMetadataByReferenceId[item.id]?.rotation ?? 0)
    }))
  });
  markGenerationPerf(debugHooks, "layout done", {
    frameCount: frames.length,
    width,
    height
  });
  const images = frames.map((frame, index) => {
    const selected = selectedBoardItems[index];

    return {
      id: createBoardId("board_image"),
      referenceId: selected?.item?.id ?? null,
      referenceItemUuid: selected?.item?.itemUuid ?? "",
      generationSlot: selected?.generationSlot ?? getBoardGenerationSlot(index),
      ...frame
    };
  }).filter((image) => image.referenceId);
  markGenerationPerf(debugHooks, "image objects ready", { imageCount: images.length });

  return {
    board: {
      id: createBoardId("board"),
      width,
      height,
      images
    },
    syntheticOutfit,
    guidedDebugPayload
  };
}

export function rerollBoardImage({
  board,
  imageId,
  items,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = [],
  boardFilters = null,
  boardGuidedOptions = {}
}) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const targetImage = board?.images?.find((image) => image.id === imageId);

  if (!targetImage) {
    return null;
  }

  if (normalizeGenerationMode(generationMode) === "guided") {
    const boardContext = buildBoardGuidedContext(
      buildBoardCandidatePool(normalizedItems, excluded, generationLists).filter((item) => item.id !== targetImage.referenceId),
      {
        boardFilters,
        maxPerTag: boardGuidedOptions.maxPerTag,
        collectTopCandidates: boardGuidedOptions.collectTopCandidates
      }
    );
    const boardState = createBoardGuidedState();
    const boardImages = Array.isArray(board?.images) ? board.images : [];

    boardImages.forEach((image) => {
      if (!image?.referenceId || image.id === imageId) {
        return;
      }

      const profile = boardContext.profilesById[image.referenceId];
      if (profile) {
        addBoardProfileToState(boardState, profile);
      }
    });

    const selection = selectNextBoardGuidedImage(boardContext, boardState);

    if (!selection?.item?.id) {
      return null;
    }

    return {
      boardImage: {
        ...targetImage,
        referenceId: selection.item.id,
        referenceItemUuid: selection.item.itemUuid ?? "",
        generationSlot: boardGenerationSlots.includes(targetImage.generationSlot)
          ? targetImage.generationSlot
          : getBoardGenerationSlot(board.images.findIndex((image) => image.id === imageId))
      },
      guidedDebugEntry: {
        slot: boardGenerationSlots.includes(targetImage.generationSlot)
          ? targetImage.generationSlot
          : getBoardGenerationSlot(board.images.findIndex((image) => image.id === imageId)),
        itemId: selection.item.id,
        breakdown: selection.breakdown,
        score: selection.score,
        topCandidates: selection.topCandidates ?? []
      }
    };
  }

  const itemsById = Object.fromEntries(normalizedItems.map((item) => [item.id, item]));
  const syntheticOutfit = boardToSyntheticOutfit(board);
  const generationSlot = boardGenerationSlots.includes(targetImage.generationSlot)
    ? targetImage.generationSlot
    : getBoardGenerationSlot(board.images.findIndex((image) => image.id === imageId));
  const slotPool = getEligibleSlotPool(
    normalizedItems,
    generationSlot,
    excluded,
    generationLists,
    true,
    outfitFilters,
    weatherData,
    syntheticOutfit,
    itemsById
  ).filter((item) => item.id !== targetImage.referenceId);
  const fallbackPool = buildBoardCandidatePool(normalizedItems, excluded, generationLists)
    .filter((item) => item.id !== targetImage.referenceId);
  const pool = slotPool.length ? slotPool : fallbackPool;
  const selection = selectNextItemForGeneration(
    pool,
    generationSlot,
    syntheticOutfit,
    itemsById,
    outfitFilters,
    weatherData,
    generationMode,
    outfitAffinity,
    recentOutfits,
    true,
    !(outfitFilters.style ?? []).length
      ? buildNoFilterGenerationContext(normalizedItems, excluded, generationLists, recentOutfits, itemsById)
      : null
  );

  if (!selection?.item?.id) {
    return null;
  }

  return {
    boardImage: {
      ...targetImage,
      referenceId: selection.item.id,
      referenceItemUuid: selection.item.itemUuid ?? "",
      generationSlot
    },
    guidedDebugEntry: normalizeGenerationMode(generationMode) === "guided" && selection.breakdown
      ? {
          slot: generationSlot,
          itemId: selection.item.id,
          breakdown: selection.breakdown,
          score: selection.score,
          topCandidates: selection.topCandidates ?? []
        }
      : null
  };
}

export function buildNextOutfit(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = []
) {
  return buildNextOutfitResult(items, currentOutfit, locked, layering, excluded, generationLists, outfitFilters, weatherData, generationMode, outfitAffinity, recentOutfits).outfit;
}

export function buildNextOutfitWithDebug(
  items,
  currentOutfit,
  locked,
  layering,
  excluded = {},
  generationLists = defaultGenerationLists,
  outfitFilters = emptyOutfitFilters,
  weatherData = null,
  generationMode = defaultGenerationMode,
  outfitAffinity = {},
  recentOutfits = []
) {
  return buildNextOutfitResult(
    items,
    currentOutfit,
    locked,
    layering,
    excluded,
    generationLists,
    outfitFilters,
    weatherData,
    generationMode,
    outfitAffinity,
    recentOutfits,
    {
      includeGuidedDebug: true
    }
  );
}

export function summarizeGuidedExplanation(outfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering) {
  const contextOutfit = {};
  const breakdownEntries = [];

  visibleSlots.forEach((slot) => {
    const itemId = outfit?.[slot];
    const item = itemId ? itemsById[itemId] : null;
    if (!item) return;

    const pool = getEligibleSlotPool(
      Object.values(itemsById),
      slot,
      {},
      defaultGenerationLists,
      layering,
      outfitFilters,
      weatherData,
      contextOutfit,
      itemsById
    );
    const { breakdown } = getGuidedScoreBreakdown(item, slot, contextOutfit, itemsById, outfitFilters, weatherData, outfitAffinity, recentOutfits, layering, pool);
    breakdownEntries.push({ slot, itemId, breakdown });

    contextOutfit[slot] = itemId;
  });

  return summarizeGuidedReasonEntries(breakdownEntries);
}

export function summarizeGuidedDebugPayload(guidedDebugPayload = []) {
  return summarizeGuidedReasonEntries(guidedDebugPayload);
}

export function normalizeOutfitFilters(outfitFilters) {
  return Object.fromEntries(
    Object.entries(outfitFilterOptions).map(([group, options]) => [
      group,
      Array.isArray(outfitFilters?.[group])
        ? outfitFilters[group].filter((value) => options.includes(value))
        : []
    ])
  );
}

export function normalizeLikedOutfitKeys(value) {
  return normalizeBooleanLookup(value);
}

export function normalizeOutfitAffinity(value) {
  return normalizeAffinityMap(value);
}
