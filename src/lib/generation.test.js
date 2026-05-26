import test from "node:test";
import assert from "node:assert/strict";

import {
  applyContextValidityRulesToPool,
  buildNextOutfit,
  buildNextOutfitWithDebug,
  generateBoard,
  getCurrentOutfitClimateChip,
  getEligibleSlotPool,
  getGuidedScoreBreakdown,
  getOutfitDominantStyle,
  getPool,
  pickNextItemForGeneration,
  relayoutBoardImages,
  rememberRecentOutfit,
  rerollBoardImage,
  summarizeGuidedDebugPayload,
  summarizeGuidedExplanation
} from "./generation.js";
import {
  getBoardItemRenderedBounds,
  rectanglesIntersect
} from "./boardBounds.js";
import { hasTypeDefaults, resolveTypeDefaults } from "./typeDefaults.js";

const syntheticWardrobe = [
  { id: "head_cap", type: "Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "head_sport_cap", type: "Sport Cap", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "head_beanie_light", type: "Beanie (light)", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "head_beanie", type: "Beanie", garmentType: "Headwear", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "head_hat", type: "Hat", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "head_formal_hat", type: "Hat", garmentType: "Headwear", layerType: "Both", weight: "Light", styleTags: ["Formal"] },
  { id: "top_tee", type: "T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  { id: "top_casual_shirt", type: "Casual Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  { id: "top_shirt", type: "Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "top_formal_shirt", type: "Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Formal"] },
  { id: "top_knit", type: "Knit Sweater", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "top_knit_vest", type: "Knit Vest", garmentType: "Top", layerType: "Both", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  { id: "top_sport_ls", type: "Sport LS T-Shirt", garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Athleisure"] },
  { id: "top_hoodie", type: "Hoodie", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "top_fleece_sweater", type: "Fleece Sweater", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "top_wool_shirt", type: "Wool Shirt", garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual"] },
  { id: "outer_jacket", type: "Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual"] },
  { id: "outer_twill", type: "Twill Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "outer_blazer", type: "Blazer", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "outer_formal_blazer", type: "Blazer", garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Formal"] },
  { id: "outer_shell", type: "Shell Jacket", garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Athleisure"] },
  { id: "outer_puffer", type: "Puffer", garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Casual", "Athleisure"] },
  { id: "outer_wool", type: "Wool Coat", garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Formal", "Smart Casual"] },
  { id: "bottom_jeans", type: "Jeans", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Casual"] },
  { id: "bottom_trousers", type: "Trousers", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "bottom_formal_trousers", type: "Heavy Wool Trousers", garmentType: "Bottom", layerType: "Both", weight: "Heavy", styleTags: ["Formal"] },
  { id: "bottom_shorts", type: "Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Casual"] },
  { id: "bottom_sport_shorts", type: "Sport Shorts", garmentType: "Bottom", layerType: "Both", weight: "Light", styleTags: ["Athleisure"] },
  { id: "bottom_sport_pants", type: "Sport Pants", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Athleisure"] },
  { id: "bottom_sweat_pants", type: "Sweat Pants", garmentType: "Bottom", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_sneakers", type: "Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_leather", type: "Leather Sneakers", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  { id: "shoe_derby", type: "Derby", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  { id: "shoe_formal_derby", type: "Derby", garmentType: "Footwear", layerType: "Both", weight: "Medium", styleTags: ["Formal"] },
  { id: "shoe_slides", type: "Slides", garmentType: "Footwear", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  { id: "shoe_boots", type: "Boots", garmentType: "Footwear", layerType: "Both", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] }
];

const itemsById = Object.fromEntries(syntheticWardrobe.map((item) => [item.id, item]));

function withSeed(seed, run) {
  const originalRandom = Math.random;
  let state = seed >>> 0;

  Math.random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function withMockRandom(value, run) {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return run();
  } finally {
    Math.random = originalRandom;
  }
}

function generateBatch({
  count = 60,
  outfitFilters = { style: [], climate: [] },
  seed = 42,
  weatherData = null,
  generationMode = "guided"
} = {}) {
  return withSeed(seed, () => {
    const results = [];
    let recentOutfits = [];

    for (let index = 0; index < count; index += 1) {
      const outfit = buildNextOutfit(
        syntheticWardrobe,
        {},
        {},
        true,
        {},
        { Wardrobe: true, Wishlist: true },
        outfitFilters,
        weatherData,
        generationMode,
        {},
        recentOutfits
      );
      results.push(outfit);
      recentOutfits = rememberRecentOutfit(recentOutfits, outfit, true, { preserveLiked: true });
    }

    return results;
  });
}

function createMoodboardReference(id, tags = [], overrides = {}) {
  return {
    id,
    name: id,
    list: "Wardrobe",
    tags,
    favorite: false,
    ...overrides
  };
}

function countByDominantStyle(outfits) {
  return outfits.reduce((counts, outfit) => {
    const style = getOutfitDominantStyle(outfit, itemsById);
    counts[style] = (counts[style] ?? 0) + 1;
    return counts;
  }, {});
}

function hasHeavyOuterwear(outfit) {
  const item = itemsById[outfit.TopOuter];
  return item?.garmentType === "Outerwear" && item.weight === "Heavy";
}

function hasBoots(outfit) {
  return itemsById[outfit.Footwear]?.type === "Boots";
}

function isLightOrSportTop(outfit) {
  const item = itemsById[outfit.TopInner];
  return Boolean(item) && (
    ["T-Shirt", "Sport LS T-Shirt"].includes(item.type) ||
    (item.weight === "Light" && item.type === "Sport LS T-Shirt")
  );
}

function breakdownFor(itemId, slot, outfit = {}, outfitFilters = { style: [], climate: [] }, recentOutfits = []) {
  const item = itemsById[itemId];
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, null, {}, recentOutfits, true, [item]).breakdown;
}

function scoreFor(itemId, slot, outfit = {}, outfitFilters = { style: [], climate: [] }, recentOutfits = [], outfitAffinity = {}) {
  const item = itemsById[itemId];
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, null, outfitAffinity, recentOutfits, true, [item]).score;
}

function breakdownWithPoolFor(itemId, slot, outfit = {}, outfitFilters = { style: [], climate: [] }, recentOutfits = [], layering = true) {
  const item = itemsById[itemId];
  const pool = getEligibleSlotPool(
    syntheticWardrobe,
    slot,
    {},
    { Wardrobe: true, Wishlist: true },
    layering,
    outfitFilters,
    null,
    outfit,
    itemsById
  );
  return getGuidedScoreBreakdown(item, slot, outfit, itemsById, outfitFilters, null, {}, recentOutfits, layering, pool);
}

function climateItems(...entries) {
  return entries.map(([slot, itemId]) => ({ slot, item: itemsById[itemId] }));
}

function getOverlapRatio(frame, otherFrame) {
  const overlapWidth = Math.max(0, Math.min(frame.x + frame.width, otherFrame.x + otherFrame.width) - Math.max(frame.x, otherFrame.x));
  const overlapHeight = Math.max(0, Math.min(frame.y + frame.height, otherFrame.y + otherFrame.height) - Math.max(frame.y, otherFrame.y));

  if (!overlapWidth || !overlapHeight) {
    return 0;
  }

  const overlapArea = overlapWidth * overlapHeight;
  const smallerArea = Math.min(frame.width * frame.height, otherFrame.width * otherFrame.height);
  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

function assertNoRenderedBoundsOverlap(images, renderMetadataByReferenceId = {}, gap = 20) {
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const imageBounds = getBoardItemRenderedBounds(image, {
      ...(renderMetadataByReferenceId[image.referenceId] ?? {}),
      rotation: image.rotation ?? renderMetadataByReferenceId[image.referenceId]?.rotation ?? 0
    }).collisionRect;

    for (let compareIndex = index + 1; compareIndex < images.length; compareIndex += 1) {
      const otherImage = images[compareIndex];
      const otherBounds = getBoardItemRenderedBounds(otherImage, {
        ...(renderMetadataByReferenceId[otherImage.referenceId] ?? {}),
        rotation: otherImage.rotation ?? renderMetadataByReferenceId[otherImage.referenceId]?.rotation ?? 0
      }).collisionRect;

      assert.equal(
        rectanglesIntersect(imageBounds, otherBounds, gap),
        false,
        `Expected ${image.id} and ${otherImage.id} not to intersect with ${gap}px gutter`
      );
    }
  }
}

function eligiblePoolIds(slot, outfitFilters = { style: [], climate: [] }, outfit = {}, layering = true) {
  return getEligibleSlotPool(
    syntheticWardrobe,
    slot,
    {},
    { Wardrobe: true, Wishlist: true },
    layering,
    outfitFilters,
    null,
    outfit,
    itemsById
  )
    .map((item) => item.id)
    .sort();
}

function isStrongFormalAnchorForTest(item, slot) {
  if (!item) return false;

  if (slot === "TopInner") return ["Shirt"].includes(item.type);
  if (slot === "Bottom") return ["Trousers", "Light trousers", "Heavy Wool Trousers"].includes(item.type);
  if (slot === "Footwear") return item.type === "Derby";
  if (slot === "TopOuter") return ["Blazer", "Wool Coat", "Wool Jacket"].includes(item.type);
  return false;
}

function isBridgeItemForTest(item, slot) {
  if (!item || isStrongFormalAnchorForTest(item, slot)) return false;
  if (item.styleTags.includes("Athleisure")) return false;
  if (["Leather Sneakers", "Boots", "Light Boots", "Boots (chunky, winter, lined)", "Knit Sweater", "Thick Knit Sweater", "Knit Vest"].includes(item.type)) {
    return true;
  }
  return item.styleTags.includes("Smart Casual") && item.styleTags.includes("Casual") && !item.styleTags.includes("Formal");
}

function getFormalStructureCounts(outfit, layering = true) {
  const slots = layering ? ["TopInner", "Bottom", "Footwear", "TopOuter"] : ["TopInner", "Bottom", "Footwear"];
  return slots.reduce(
    (counts, slot) => {
      const item = itemsById[outfit[slot]];
      if (isStrongFormalAnchorForTest(item, slot)) counts.formal += 1;
      else if (isBridgeItemForTest(item, slot)) counts.bridge += 1;
      return counts;
    },
    { formal: 0, bridge: 0 }
  );
}

test("no-filter generation uses weighted variety instead of collapsing into casual", () => {
  const outfits = generateBatch();
  const counts = countByDominantStyle(outfits);
  const representedStyles = Object.values(counts).filter((count) => count > 0).length;

  assert.ok((counts.Casual ?? 0) > (counts["Smart Casual"] ?? 0));
  assert.ok((counts["Smart Casual"] ?? 0) >= 6);
  assert.ok((counts.Athleisure ?? 0) >= 8);
  assert.ok((counts.Casual ?? 0) <= 28);
  assert.ok((counts.Formal ?? 0) >= 5);
  assert.ok((counts.Formal ?? 0) <= 20);
  assert.ok(representedStyles >= 4);
});

test("no-filter occasionally produces formal when the wardrobe supports it", () => {
  const outfits = generateBatch({ count: 120, seed: 77 });
  const counts = countByDominantStyle(outfits);

  assert.ok((counts.Formal ?? 0) >= 8);
  assert.ok((counts.Formal ?? 0) < (counts.Casual ?? 0));
});

test("no-filter ignores passive weather unless climate filters are explicitly applied", () => {
  const passiveWarmWeather = {
    temperature: 27,
    suggestedFilters: ["Warm"]
  };

  const neutralOutfits = generateBatch({ count: 20, seed: 314, weatherData: null });
  const weatherOutfits = generateBatch({ count: 20, seed: 314, weatherData: passiveWarmWeather });

  assert.deepEqual(weatherOutfits, neutralOutfits);
});

test("sport cap only appears in non-formal no-filter outfits", () => {
  const outfits = generateBatch({ count: 80, seed: 99 });

  outfits.forEach((outfit) => {
    if (outfit.Headwear !== "head_sport_cap") return;
    assert.notEqual(getOutfitDominantStyle(outfit, itemsById), "Formal");
  });
});

test("explicit athleisure filter stays athletic and excludes wool shirt", () => {
  const outfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: [] }, seed: 13 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const bottom = itemsById[outfit.Bottom];
    const outer = itemsById[outfit.TopOuter];
    const shoes = itemsById[outfit.Footwear];

    assert.notEqual(top?.type, "Wool Shirt");
    assert.notEqual(top?.type, "Shirt");
    assert.notEqual(shoes?.type, "Derby");
    assert.notEqual(outer?.type, "Blazer");
    assert.ok(
      ["Sport LS T-Shirt", "Hoodie", "Fleece Sweater", "Sport Pants", "Sport Shorts", "Sweat Pants", "Shell Jacket", "Sneakers", "Sport Cap", "Cap"].includes(top?.type) ||
      ["Sport Pants", "Sport Shorts", "Sweat Pants"].includes(bottom?.type) ||
      ["Shell Jacket", "Fleece Jacket"].includes(outer?.type) ||
      ["Sneakers"].includes(shoes?.type)
    );
  });
});

test("explicit formal filter stays formal instead of collapsing into smart casual", () => {
  const outfits = generateBatch({ count: 30, outfitFilters: { style: ["Formal"], climate: [] }, seed: 5 });

  outfits.forEach((outfit) => {
    assert.equal(getOutfitDominantStyle(outfit, itemsById, ["Formal"]), "Formal");
    assert.notEqual(itemsById[outfit.Footwear]?.type, "Sneakers");
    assert.notEqual(itemsById[outfit.TopInner]?.type, "Hoodie");
  });
});

test("formal footwear eligible pool includes smart-casual bridge shoes and excludes sporty footwear", () => {
  const actual = eligiblePoolIds("Footwear", { style: ["Formal"], climate: [] });

  assert.deepEqual(actual, ["shoe_boots", "shoe_derby", "shoe_formal_derby", "shoe_leather"]);
  assert.ok(!actual.includes("shoe_sneakers"));
  assert.ok(!actual.includes("shoe_slides"));
});

test("formal footwear stays valid with strong formal shirt and trousers plus bridge shoes", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_formal_shirt",
      Bottom: "bottom_formal_trousers"
    }
  );

  assert.ok(actual.includes("shoe_formal_derby"));
  assert.ok(actual.includes("shoe_derby"));
  assert.ok(actual.includes("shoe_leather"));
});

test("formal structure rejects shirt with jeans and bridge footwear", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_formal_shirt",
      Bottom: "bottom_jeans"
    }
  );

  assert.ok(actual.includes("shoe_formal_derby"));
  assert.ok(actual.includes("shoe_derby"));
  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("formal structure rejects knit with jeans and leather sneakers", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_knit",
      Bottom: "bottom_jeans"
    }
  );

  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("formal structure rejects casual shirt with smart-casual footwear", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_casual_shirt",
      Bottom: "bottom_formal_trousers"
    }
  );

  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("generateBoard stamps referenceItemUuid without changing referenceId links", () => {
  const references = [
    createMoodboardReference("ref-1", [], { itemUuid: "uuid-1" }),
    createMoodboardReference("ref-2", [], { itemUuid: "uuid-2" }),
    createMoodboardReference("ref-3", [], { itemUuid: "uuid-3" })
  ];

  const result = generateBoard({
    items: references,
    imageCount: 3,
    generationMode: "random"
  });

  assert.equal(result.board.images.length, 3);
  result.board.images.forEach((image) => {
    const sourceItem = references.find((item) => item.id === image.referenceId);
    assert.ok(sourceItem);
    assert.equal(image.referenceItemUuid, sourceItem.itemUuid);
  });
});

test("createBoardFromReferenceIds can carry additive referenceItemUuid metadata", async () => {
  const { createBoardFromReferenceIds } = await import("./generation.js");
  const board = createBoardFromReferenceIds(["ref-1"], {
    itemsByReferenceId: {
      "ref-1": { id: "ref-1", itemUuid: "uuid-1" }
    }
  });

  assert.equal(board.images[0].referenceId, "ref-1");
  assert.equal(board.images[0].referenceItemUuid, "uuid-1");
});

test("rerollBoardImage preserves active id behavior while stamping referenceItemUuid", () => {
  const references = [
    createMoodboardReference("ref-1", [], { itemUuid: "uuid-1" }),
    createMoodboardReference("ref-2", [], { itemUuid: "uuid-2" })
  ];
  const result = rerollBoardImage({
    board: {
      id: "board-1",
      images: [
        {
          id: "image-1",
          referenceId: "ref-1",
          referenceItemUuid: "uuid-1",
          generationSlot: "TopInner",
          x: 0,
          y: 0,
          width: 220,
          height: 260,
          rotation: 0,
          zIndex: 1
        }
      ]
    },
    imageId: "image-1",
    items: references,
    generationMode: "random"
  });

  assert.ok(result);
  assert.equal(result.boardImage.referenceId, "ref-2");
  assert.equal(result.boardImage.referenceItemUuid, "uuid-2");
});

test("formal structure treats knit-vest as bridge instead of a formal anchor", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_knit_vest",
      Bottom: "bottom_formal_trousers"
    }
  );

  assert.ok(actual.includes("shoe_formal_derby"));
  assert.ok(actual.includes("shoe_derby"));
  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("random formal generation can select relaxed formal-compatible footwear from the eligible pool", () => {
  const formalOutfit = {
    Headwear: "head_formal_hat",
    TopInner: "top_formal_shirt",
    TopOuter: "outer_formal_blazer",
    Bottom: "bottom_formal_trousers"
  };
  const pool = getEligibleSlotPool(
    syntheticWardrobe,
    "Footwear",
    {},
    { Wardrobe: true, Wishlist: true },
    true,
    { style: ["Formal"], climate: [] },
    null,
    formalOutfit,
    itemsById
  );
  const seenFootwear = [0, 0.26, 0.51, 0.76].map((randomValue) =>
    withMockRandom(randomValue, () =>
      pickNextItemForGeneration(
        pool,
        "Footwear",
        formalOutfit,
        itemsById,
        { style: ["Formal"], climate: [] },
        null,
        "random",
        {},
        [],
        true
      )
    )?.id ?? null
  );

  assert.deepEqual(seenFootwear.sort(), ["shoe_boots", "shoe_derby", "shoe_formal_derby", "shoe_leather"]);
});

test("guided formal scoring still prefers derby footwear over relaxed bridge options", () => {
  const formalOutfit = {
    Headwear: "head_formal_hat",
    TopInner: "top_formal_shirt",
    TopOuter: "outer_formal_blazer",
    Bottom: "bottom_formal_trousers"
  };

  const derbyScore = scoreFor("shoe_formal_derby", "Footwear", formalOutfit, { style: ["Formal"], climate: [] });
  const bridgeDerbyScore = scoreFor("shoe_derby", "Footwear", formalOutfit, { style: ["Formal"], climate: [] });
  const leatherScore = scoreFor("shoe_leather", "Footwear", formalOutfit, { style: ["Formal"], climate: [] });
  const bootsScore = scoreFor("shoe_boots", "Footwear", formalOutfit, { style: ["Formal"], climate: [] });

  assert.ok(derbyScore > leatherScore);
  assert.ok(bridgeDerbyScore > leatherScore);
  assert.ok(derbyScore > bootsScore);
});

test("shared eligible slot pool matches formal generation footwear outcomes", () => {
  const formalOutfit = {
    Headwear: "head_formal_hat",
    TopInner: "top_formal_shirt",
    TopOuter: "outer_formal_blazer",
    Bottom: "bottom_formal_trousers"
  };
  const eligibleIds = eligiblePoolIds("Footwear", { style: ["Formal"], climate: [] }, formalOutfit);
  const seenGeneratedIds = [0, 0.26, 0.51, 0.76].map((randomValue) =>
    withMockRandom(randomValue, () =>
      pickNextItemForGeneration(
        getEligibleSlotPool(
          syntheticWardrobe,
          "Footwear",
          {},
          { Wardrobe: true, Wishlist: true },
          true,
          { style: ["Formal"], climate: [] },
          null,
          formalOutfit,
          itemsById
        ),
        "Footwear",
        formalOutfit,
        itemsById,
        { style: ["Formal"], climate: [] },
        null,
        "random",
        {},
        [],
        true
      )
    )?.id ?? null
  );

  assert.deepEqual(seenGeneratedIds.sort(), eligibleIds);
});

test("formal forward-check keeps early bridge footwear eligible when remaining slots can still anchor", () => {
  const actual = eligiblePoolIds("Footwear", { style: ["Formal"], climate: [] }, {});

  assert.ok(actual.includes("shoe_leather"));
  assert.ok(actual.includes("shoe_boots"));
});

test("formal forward-check rejects bridge footwear when remaining slots cannot reach two formal anchors", () => {
  const actual = eligiblePoolIds(
    "Footwear",
    { style: ["Formal"], climate: [] },
    {
      TopInner: "top_knit",
      Bottom: "bottom_jeans"
    }
  );

  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("formal forward-check rejects candidates when only bridge outerwear remains", () => {
  const actual = getEligibleSlotPool(
    syntheticWardrobe,
    "Footwear",
    {
      outer_blazer: true,
      outer_formal_blazer: true,
      outer_wool: true
    },
    { Wardrobe: true, Wishlist: true },
    true,
    { style: ["Formal"], climate: [] },
    null,
    {
      TopInner: "top_knit",
      Bottom: "bottom_formal_trousers"
    },
    itemsById
  ).map((item) => item.id);

  assert.ok(!actual.includes("shoe_leather"));
  assert.ok(!actual.includes("shoe_boots"));
});

test("explicit smart casual filter stays elevated instead of collapsing into casual", () => {
  const outfits = generateBatch({ count: 35, outfitFilters: { style: ["Smart Casual"], climate: [] }, seed: 17 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const shoes = itemsById[outfit.Footwear];
    assert.notEqual(top?.type, "Sport LS T-Shirt");
    assert.notEqual(itemsById[outfit.Headwear]?.type, "Sport Cap");
    assert.ok(["Shirt", "Knit Sweater", "Wool Shirt", "Fleece Sweater", "Hoodie"].includes(top?.type) === false || top?.type !== "Hoodie");
    assert.ok(["Leather Sneakers", "Boots", "Derby"].includes(shoes?.type));
  });
});

test("formal random and guided generation obey the same structure constraints", () => {
  const guidedOutfits = generateBatch({ count: 30, outfitFilters: { style: ["Formal"], climate: [] }, seed: 31, generationMode: "guided" });
  const randomOutfits = generateBatch({ count: 30, outfitFilters: { style: ["Formal"], climate: [] }, seed: 31, generationMode: "random" });

  [...guidedOutfits, ...randomOutfits].forEach((outfit) => {
    const counts = getFormalStructureCounts(outfit);
    const topInner = itemsById[outfit.TopInner];
    const bottom = itemsById[outfit.Bottom];
    const footwear = itemsById[outfit.Footwear];

    assert.ok(counts.formal >= 2);
    assert.ok(counts.bridge <= 2);
    assert.ok(counts.formal >= counts.bridge);

    if (isBridgeItemForTest(footwear, "Footwear")) {
      assert.equal(isStrongFormalAnchorForTest(topInner, "TopInner"), true);
      assert.equal(isStrongFormalAnchorForTest(bottom, "Bottom"), true);
    }

    if (!isStrongFormalAnchorForTest(bottom, "Bottom")) {
      assert.equal(isStrongFormalAnchorForTest(footwear, "Footwear"), true);
    }
  });
});

test("guided generation with formal filter captures non-empty guided debug payload", () => {
  const result = withSeed(31, () =>
    buildNextOutfitWithDebug(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );

  assert.ok(result.guidedDebugPayload.length > 0);
  result.guidedDebugPayload.forEach((entry) => {
    assert.ok(entry.slot);
    assert.ok(entry.itemId);
    assert.ok(typeof entry.score === "number");
    assert.ok(entry.breakdown && typeof entry.breakdown === "object");
    assert.ok(Object.keys(entry.breakdown).length > 0);
    assert.ok(Array.isArray(entry.topCandidates));
  });
});

test("guided debug payload breakdowns match the scoring pass used for selection", () => {
  const result = withSeed(31, () =>
    buildNextOutfitWithDebug(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );
  const contextOutfit = {};

  result.guidedDebugPayload.forEach((entry) => {
    const expected = breakdownWithPoolFor(entry.itemId, entry.slot, contextOutfit, { style: ["Formal"], climate: [] });
    assert.equal(entry.score, expected.score);
    assert.deepEqual(entry.breakdown, expected.breakdown);
    assert.ok(entry.topCandidates.length <= 5);
    assert.deepEqual(
      entry.topCandidates.map((candidate) => candidate.score),
      [...entry.topCandidates.map((candidate) => candidate.score)].sort((left, right) => right - left)
    );

    const selectedCandidate = entry.topCandidates.find((candidate) => candidate.itemId === entry.itemId);
    assert.ok(selectedCandidate);
    assert.equal(selectedCandidate.score, entry.score);

    entry.topCandidates.forEach((candidate) => {
      const candidateBreakdown = breakdownWithPoolFor(candidate.itemId, entry.slot, contextOutfit, { style: ["Formal"], climate: [] });
      assert.equal(candidate.score, candidateBreakdown.score);
    });

    contextOutfit[entry.slot] = entry.itemId;
  });
});

test("guided debug payload can be summarized into non-empty debug reasons", () => {
  const result = withSeed(31, () =>
    buildNextOutfitWithDebug(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );
  const reasons = summarizeGuidedDebugPayload(result.guidedDebugPayload);

  assert.ok(reasons.length > 0);
});

test("guided debug summary falls back to low-signal components instead of returning empty", () => {
  const reasons = summarizeGuidedDebugPayload([
    {
      slot: "TopInner",
      itemId: "top_formal_shirt",
      score: 0.5,
      breakdown: {
        baseline: 0.12,
        affinity: 0.08,
        climate: 0
      }
    }
  ]);

  assert.ok(reasons.length > 0);
  assert.equal(reasons[0].key, "baseline");
});

test("guided debug summary falls back to zero-valued breakdown keys instead of returning empty", () => {
  const reasons = summarizeGuidedDebugPayload([
    {
      slot: "TopInner",
      itemId: "top_formal_shirt",
      score: 0.3,
      breakdown: {
        climate: 0,
        styleCoherence: 0,
        styleCompletion: 0
      }
    }
  ]);

  assert.ok(reasons.length > 0);
  assert.deepEqual(
    reasons.map((reason) => reason.key),
    ["climate", "styleCoherence", "styleCompletion"]
  );
  reasons.forEach((reason) => {
    assert.equal(reason.value, 0);
  });
});

test("guided explanation fallback still returns reasons for formal guided outfits", () => {
  const outfit = withSeed(31, () =>
    buildNextOutfit(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );
  const reasons = summarizeGuidedExplanation(outfit, itemsById, { style: ["Formal"], climate: [] }, null, {}, [], true);

  assert.ok(reasons.length > 0);
});

test("random generation returns no guided debug payload", () => {
  const result = withSeed(31, () =>
    buildNextOutfitWithDebug(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "random",
      {},
      []
    )
  );

  assert.deepEqual(result.guidedDebugPayload, []);
});

test("buildNextOutfitWithDebug preserves generation output for the same seed", () => {
  const baseOutfit = withSeed(31, () =>
    buildNextOutfit(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );
  const debugResult = withSeed(31, () =>
    buildNextOutfitWithDebug(
      syntheticWardrobe,
      {},
      {},
      true,
      {},
      { Wardrobe: true, Wishlist: true },
      { style: ["Formal"], climate: [] },
      null,
      "guided",
      {},
      []
    )
  );

  assert.deepEqual(debugResult.outfit, baseOutfit);
});

test("cold generation avoids light or sport tops with boots or heavy outerwear", () => {
  const outfits = generateBatch({ count: 50, outfitFilters: { style: [], climate: ["Cold"] }, seed: 7 });

  outfits.forEach((outfit) => {
    if (!hasHeavyOuterwear(outfit) && !hasBoots(outfit)) return;
    assert.equal(isLightOrSportTop(outfit), false);
  });
});

test("warm and hot climate penalize medium or heavy beanies", () => {
  const warmOutfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: ["Warm"] }, seed: 44 });
  const hotOutfits = generateBatch({ count: 40, outfitFilters: { style: ["Athleisure"], climate: ["Hot"] }, seed: 45 });

  warmOutfits.forEach((outfit) => {
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie");
  });

  hotOutfits.forEach((outfit) => {
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie");
    assert.notEqual(itemsById[outfit.Headwear]?.id, "head_beanie_light");
  });
});

test("climate pill reflects warm or hot leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["Bottom", "bottom_shorts"],
        ["Footwear", "shoe_sneakers"]
      )
    ),
    "Warm"
  );
});

test("climate pill reflects transitional leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_knit"],
        ["TopOuter", "outer_jacket"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_sneakers"]
      )
    ),
    "Transitional"
  );
});

test("climate pill returns cold for heavy coat and boots", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_jeans"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill returns cold for wool coat with medium footwear", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_shirt"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_derby"]
      )
    ),
    "Cold"
  );
});

test("climate pill returns cold for puffer and boots", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["TopOuter", "outer_puffer"],
        ["Bottom", "bottom_jeans"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill reflects cold leaning outfits from the outfit itself", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["Headwear", "head_beanie"],
        ["TopInner", "top_hoodie"],
        ["TopOuter", "outer_wool"],
        ["Bottom", "bottom_formal_trousers"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Cold"
  );
});

test("climate pill does not let a light inner top overpower heavy outerwear", () => {
  const actualOutfitClimate = getCurrentOutfitClimateChip(
    climateItems(
      ["TopInner", "top_tee"],
      ["TopOuter", "outer_wool"],
      ["Bottom", "bottom_shorts"],
      ["Footwear", "shoe_boots"]
    )
  );

  assert.notEqual(actualOutfitClimate, "Warm");
  assert.ok(["Cold", "Transitional"].includes(actualOutfitClimate));
});

test("climate pill reflects rain when rain cues are strongest", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["Headwear", "head_cap"],
        ["TopInner", "top_hoodie"],
        ["TopOuter", "outer_shell"],
        ["Bottom", "bottom_trousers"],
        ["Footwear", "shoe_boots"]
      )
    ),
    "Rain"
  );
});

test("climate pill ignores passive weather and explicit climate state and reflects the outfit", () => {
  const actualOutfitClimate = getCurrentOutfitClimateChip(
    climateItems(
      ["TopInner", "top_tee"],
      ["Bottom", "bottom_shorts"],
      ["Footwear", "shoe_sneakers"]
    )
  );

  assert.equal(actualOutfitClimate, "Warm");
  assert.notEqual(actualOutfitClimate, "Cold");
});

test("climate pill returns hot only when the outfit has strong warm-weather signals", () => {
  assert.equal(
    getCurrentOutfitClimateChip(
      climateItems(
        ["TopInner", "top_tee"],
        ["Bottom", "bottom_shorts"],
        ["Footwear", "shoe_slides"]
      )
    ),
    "Hot"
  );
});

test("smart shirt with shorts and medium or heavy outerwear is suppressed", () => {
  const outfits = generateBatch({ count: 80, outfitFilters: { style: [], climate: ["Warm"] }, seed: 123 });

  outfits.forEach((outfit) => {
    const top = itemsById[outfit.TopInner];
    const bottom = itemsById[outfit.Bottom];
    const outer = itemsById[outfit.TopOuter];
    const hasSmartShirt = top?.type === "Shirt";
    const hasShorts = bottom?.type === "Shorts";
    const hasMediumOrHeavyOuterwear = outer?.garmentType === "Outerwear" && ["Medium", "Heavy"].includes(outer.weight);

    assert.equal(hasSmartShirt && hasShorts && hasMediumOrHeavyOuterwear, false);
  });
});

test("session correction avoids 3-item and 3-style streaks with ample wardrobe support", () => {
  const outfits = generateBatch({ count: 40, seed: 2026 });
  let styleStreak = 1;
  let topInnerStreak = 1;
  let threeStyleStreaks = 0;
  let fourStyleStreaks = 0;

  for (let index = 1; index < outfits.length; index += 1) {
    const previousStyle = getOutfitDominantStyle(outfits[index - 1], itemsById);
    const currentStyle = getOutfitDominantStyle(outfits[index], itemsById);
    styleStreak = previousStyle === currentStyle ? styleStreak + 1 : 1;
    if (styleStreak === 3) threeStyleStreaks += 1;
    if (styleStreak === 4) fourStyleStreaks += 1;
    assert.ok(styleStreak < 5);

    const previousTop = outfits[index - 1].TopInner;
    const currentTop = outfits[index].TopInner;
    topInnerStreak = previousTop === currentTop ? topInnerStreak + 1 : 1;
    assert.ok(topInnerStreak < 3);
  }

  assert.ok(threeStyleStreaks <= 4);
  assert.ok(fourStyleStreaks <= 1);
});

test("recent item repetition penalties are capped and mild", () => {
  const repeatedOutfit = {
    Headwear: "head_cap",
    TopInner: "top_tee",
    TopOuter: "outer_jacket",
    Bottom: "bottom_jeans",
    Footwear: "shoe_sneakers"
  };
  const recentOutfits = [
    repeatedOutfit,
    repeatedOutfit,
    repeatedOutfit,
    repeatedOutfit
  ].reduce((current, outfit) => rememberRecentOutfit(current, outfit, true), []);
  const breakdown = breakdownFor(
    "shoe_sneakers",
    "Footwear",
    {
      Headwear: "head_cap",
      TopInner: "top_tee",
      TopOuter: "outer_jacket",
      Bottom: "bottom_jeans"
    },
    { style: [], climate: [] },
    recentOutfits
  );

  assert.ok(breakdown.recentItemPenalty <= -0.3);
  assert.ok(breakdown.recentItemPenalty >= -0.8);
  assert.ok(breakdown.recentExactPenalty <= -0.4);
  assert.ok(breakdown.recentExactPenalty >= -0.5);
  assert.ok(breakdown.styleStreakPenalty >= -0.5);
});

test("guided breakdown components stay within normalized caps", () => {
  const scenarios = [
    breakdownFor("top_formal_shirt", "TopInner", {}, { style: ["Formal"], climate: [] }),
    breakdownFor("outer_wool", "TopOuter", { TopInner: "top_tee", Bottom: "bottom_shorts" }, { style: ["Formal"], climate: ["Hot"] }),
    breakdownFor("head_sport_cap", "Headwear", {}, { style: ["Athleisure"], climate: ["Warm"] }),
    breakdownFor("shoe_boots", "Footwear", { TopInner: "top_tee", TopOuter: "outer_wool", Bottom: "bottom_formal_trousers" }, { style: [], climate: ["Cold"] })
  ];

  const caps = {
    styleCoherence: [-3, 2.5],
    styleCompletion: [0, 2.5],
    climate: [-1.5, 2],
    baseline: [0, 1],
    affinity: [0, 0.5],
    noFilterVariety: [-0.4, 1],
    recentItemPenalty: [-0.8, 0],
    recentExactPenalty: [-0.5, 0],
    styleStreakPenalty: [-0.5, 0],
    dominance: [-2, 0]
  };

  scenarios.forEach((breakdown) => {
    Object.entries(caps).forEach(([key, [min, max]]) => {
      assert.ok(breakdown[key] >= min, `${key} below cap: ${breakdown[key]}`);
      assert.ok(breakdown[key] <= max, `${key} above cap: ${breakdown[key]}`);
    });

    Object.values(breakdown).forEach((value) => {
      assert.ok(value >= -3, `component below general floor: ${value}`);
      assert.ok(value <= 3, `component above general ceiling: ${value}`);
    });
  });
});

test("affinity boost is capped at a small supportive value", () => {
  const affinity = {
    "pair|TopInner|Bottom|top_tee|bottom_jeans": 99,
    "item|Bottom|bottom_jeans": 99
  };
  const breakdown = getGuidedScoreBreakdown(
    itemsById.bottom_jeans,
    "Bottom",
    { TopInner: "top_tee" },
    itemsById,
    { style: [], climate: [] },
    null,
    affinity,
    [],
    true,
    [itemsById.bottom_jeans]
  ).breakdown;

  assert.ok(breakdown.affinity <= 0.5);
  assert.ok(breakdown.affinity >= 0);
});

test("valid guided candidates receive a positive minimum score floor", () => {
  const score = scoreFor("top_tee", "TopInner", {}, { style: ["Formal"], climate: [] });

  assert.ok(score >= 0.3);
});

test("hard-blocked candidates are excluded before scoring floor applies", () => {
  const pool = getPool(syntheticWardrobe, "Headwear", {}, { Wardrobe: true, Wishlist: true }, true);
  const filtered = applyContextValidityRulesToPool(pool, "Headwear", { style: [], climate: ["Hot"] }, null, {}, itemsById);

  assert.ok(filtered.some((item) => item.id === "head_cap"));
  assert.ok(!filtered.some((item) => item.id === "head_beanie"));
});

test("guided explanation debug reasons stay on the normalized score scale", () => {
  const explanation = summarizeGuidedExplanation(
    {
      Headwear: "head_cap",
      TopInner: "top_tee",
      TopOuter: "outer_jacket",
      Bottom: "bottom_jeans",
      Footwear: "shoe_sneakers"
    },
    itemsById,
    { style: [], climate: [] },
    null,
    {},
    [],
    true
  );

  explanation.forEach((reason) => {
    assert.ok(Math.abs(reason.value) <= 3, `${reason.label} out of range: ${reason.value}`);
  });
});

test("random mode ignores guided recent-memory inputs", () => {
  const withNoRecent = withSeed(11, () =>
    buildNextOutfit(syntheticWardrobe, {}, {}, true, {}, { Wardrobe: true, Wishlist: true }, { style: [], climate: [] }, null, "random", {}, [])
  );
  const withRecent = withSeed(11, () =>
    buildNextOutfit(syntheticWardrobe, {}, {}, true, {}, { Wardrobe: true, Wishlist: true }, { style: [], climate: [] }, null, "random", { some: 99 }, [
      { key: "x", outfit: { Headwear: "head_cap", TopInner: "top_tee", TopOuter: "outer_jacket", Bottom: "bottom_jeans", Footwear: "shoe_sneakers" }, layering: true, liked: true }
    ])
  );

  assert.deepEqual(withRecent, withNoRecent);
});

test("type defaults include beanie light and new athletic types", () => {
  assert.equal(resolveTypeDefaults("Beanie (light)").weight, "Light");
  assert.deepEqual(resolveTypeDefaults("Track Pants").styleTags, ["Athleisure"]);
  assert.deepEqual(resolveTypeDefaults("Sweatpants").styleTags, ["Casual", "Athleisure"]);
  assert.deepEqual(resolveTypeDefaults("Fleece Pullover").styleTags, ["Casual", "Athleisure"]);
  assert.equal(resolveTypeDefaults("Swim Shorts").garmentType, "Bottom");
  assert.equal(resolveTypeDefaults("Swim Shorts").weight, "Light");
  assert.deepEqual(resolveTypeDefaults("Swim Shorts").styleTags, ["Athleisure"]);
  assert.deepEqual(resolveTypeDefaults("running sneakers").styleTags, resolveTypeDefaults("Sneakers").styleTags);
  assert.deepEqual(resolveTypeDefaults("linen pants").styleTags, resolveTypeDefaults("Trousers").styleTags);
  assert.equal(resolveTypeDefaults("linen pants").garmentType, "Bottom");
  assert.deepEqual(resolveTypeDefaults("heavy winter coat").styleTags, resolveTypeDefaults("Coat").styleTags);
  assert.deepEqual(resolveTypeDefaults("gym hoodie").styleTags, resolveTypeDefaults("Hoodie").styleTags);
  assert.deepEqual(resolveTypeDefaults("boardshort hybrid").styleTags, resolveTypeDefaults("Swim Shorts").styleTags);
  assert.equal(hasTypeDefaults("mystery thing"), false);
  assert.equal(resolveTypeDefaults("mystery thing").weight, "");
  assert.deepEqual(resolveTypeDefaults("mystery thing").styleTags, []);
});

test("generateBoard creates 15 images by default when enough references are available", () => {
  const references = syntheticWardrobe.slice(0, 18).map((item, index) => ({
    ...item,
    id: `board_ref_${index}`
  }));

  const { board } = withSeed(21, () =>
    generateBoard({
      items: references,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(board.images.length, 15);
  assert.equal(new Set(board.images.map((image) => image.referenceId)).size, 15);
});

test("generateBoard uses all available references when fewer than requested exist", () => {
  const references = syntheticWardrobe.slice(0, 3).map((item, index) => ({
    ...item,
    id: `small_board_ref_${index}`
  }));

  const { board } = withSeed(22, () =>
    generateBoard({
      items: references,
      imageCount: 8,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(board.images.length, 3);
  assert.deepEqual(
    new Set(board.images.map((image) => image.referenceId)),
    new Set(references.map((item) => item.id))
  );
});

test("empty legacy slot pools do not reduce board image count", () => {
  const topOnlyReferences = Array.from({ length: 10 }, (_, index) => ({
    id: `top_only_${index}`,
    name: `Top Only ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe"
  }));

  const { board } = withSeed(23, () =>
    generateBoard({
      items: topOnlyReferences,
      imageCount: 8,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(board.images.length, 8);
  assert.equal(new Set(board.images.map((image) => image.referenceId)).size, 8);
});

test("generateBoard layout creates a centered non-overlapping collage", () => {
  const references = Array.from({ length: 10 }, (_, index) => ({
    id: `layout_ref_${index}`,
    name: `Layout Ref ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe"
  }));

  const { board } = withSeed(25, () =>
    generateBoard({
      items: references,
      imageCount: 8,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  };

  for (let index = 0; index < board.images.length; index += 1) {
    bounds.minX = Math.min(bounds.minX, board.images[index].x);
    bounds.minY = Math.min(bounds.minY, board.images[index].y);
    bounds.maxX = Math.max(bounds.maxX, board.images[index].x + board.images[index].width);
    bounds.maxY = Math.max(bounds.maxY, board.images[index].y + board.images[index].height);
  }

  const collageCenterX = (bounds.minX + bounds.maxX) / 2;
  const collageCenterY = (bounds.minY + bounds.maxY) / 2;
  const uniqueHeights = new Set(board.images.map((image) => image.height));
  const uniqueTopPositions = new Set(board.images.map((image) => image.y));

  assertNoRenderedBoundsOverlap(board.images);
  assert.ok(Math.abs(collageCenterX - board.width / 2) <= 12, `expected centered x, received ${collageCenterX}`);
  assert.ok(Math.abs(collageCenterY - board.height / 2) <= 12, `expected centered y, received ${collageCenterY}`);
  assert.ok(uniqueHeights.size >= 3, "expected varied image heights");
  assert.ok(uniqueTopPositions.size >= 4, "expected staggered vertical placement");
});

test("generateBoard layout stays non-overlapping for tall boosted references", () => {
  const references = Array.from({ length: 8 }, (_, index) => ({
    id: `tall_layout_ref_${index}`,
    name: `Tall Layout Ref ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe"
  }));

  const { board } = withSeed(26, () =>
    generateBoard({
      items: references,
      imageCount: 8,
      generationLists: { Wardrobe: true, Wishlist: true },
      layoutOptions: {
        aspectRatiosByReferenceId: Object.fromEntries(references.map((item) => [item.id, 0.58])),
        sizeMultipliersByReferenceId: Object.fromEntries(references.map((item) => [item.id, 1.28]))
      }
    })
  );

  assertNoRenderedBoundsOverlap(
    board.images,
    Object.fromEntries(references.map((item) => [item.id, { aspectRatio: 0.58 }]))
  );
});

test("generateBoard layout stays non-overlapping for 15 boosted references", () => {
  const references = Array.from({ length: 15 }, (_, index) => ({
    id: `boosted_layout_ref_${index}`,
    name: `Boosted Layout Ref ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe"
  }));
  const renderMetadataByReferenceId = Object.fromEntries(
    references.map((item, index) => [
      item.id,
      {
        aspectRatio: index % 3 === 0 ? 0.62 : index % 2 === 0 ? 1.34 : 0.84,
        rotation: 0
      }
    ])
  );

  const { board } = withSeed(126, () =>
    generateBoard({
      items: references,
      imageCount: 15,
      generationLists: { Wardrobe: true, Wishlist: true },
      layoutOptions: {
        aspectRatiosByReferenceId: Object.fromEntries(
          Object.entries(renderMetadataByReferenceId).map(([referenceId, value]) => [referenceId, value.aspectRatio])
        ),
        sizeMultipliersByReferenceId: Object.fromEntries(references.map((item, index) => [item.id, index % 4 === 0 ? 1.22 : 1.08])),
        renderMetadataByReferenceId
      }
    })
  );

  assert.equal(board.images.length, 15);
  assertNoRenderedBoundsOverlap(board.images, renderMetadataByReferenceId);
});

test("generateBoard layout avoids rendered-bounds overlap for 4-6 mixed-size images", () => {
  const references = Array.from({ length: 6 }, (_, index) => ({
    id: `mixed_layout_ref_${index}`,
    name: `Mixed Layout Ref ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe",
    imageWidth: index % 2 === 0 ? 900 : 700,
    imageHeight: index % 3 === 0 ? 1400 : 680,
    imageScale: index % 2 === 0 ? 132 : 100,
    imageFrameScale: index % 3 === 0 ? 118 : 100,
    imageCropX: index % 2 === 0 ? 10 : 0,
    imageCropY: index % 3 === 0 ? 4 : 0,
    imageCropWidth: index % 2 === 0 ? 78 : 100,
    imageCropHeight: index % 3 === 0 ? 86 : 100
  }));
  const renderMetadataByReferenceId = Object.fromEntries(
    references.map((item) => [
      item.id,
      {
        aspectRatio: Math.max(0.55, Math.min(1.7, ((item.imageWidth * (item.imageCropWidth / 100)) / (item.imageHeight * (item.imageCropHeight / 100))))),
        rotation: 0
      }
    ])
  );
  const boardImages = references.map((item, index) => ({
    id: `mixed_image_${index}`,
    referenceId: item.id,
    generationSlot: null,
    x: 0,
    y: 0,
    width: 220,
    height: 220,
    rotation: 0,
    zIndex: index + 1
  }));

  const relaid = withSeed(29, () =>
    relayoutBoardImages(boardImages, {
      aspectRatiosByReferenceId: Object.fromEntries(references.map((item) => [item.id, renderMetadataByReferenceId[item.id].aspectRatio])),
      sizeMultipliersByReferenceId: Object.fromEntries(references.map((item) => [item.id, item.imageScale > 100 ? 1.18 : 1])),
      renderMetadataByReferenceId
    })
  );

  assertNoRenderedBoundsOverlap(relaid.images, renderMetadataByReferenceId);
});

test("relayoutBoardImages keeps rotated rendered bounds separated", () => {
  const boardImages = Array.from({ length: 5 }, (_, index) => ({
    id: `rotated_image_${index}`,
    referenceId: `rotated_layout_ref_${index}`,
    generationSlot: null,
    x: 0,
    y: 0,
    width: 220,
    height: 220,
    rotation: index % 2 === 0 ? 7 : -6,
    zIndex: index + 1
  }));
  const renderMetadataByReferenceId = Object.fromEntries(
    boardImages.map((image, index) => [
      image.referenceId,
      {
        aspectRatio: index % 2 === 0 ? 0.72 : 1.42,
        rotation: image.rotation
      }
    ])
  );

  const relaid = withSeed(30, () =>
    relayoutBoardImages(boardImages, {
      aspectRatiosByReferenceId: Object.fromEntries(boardImages.map((image, index) => [image.referenceId, index % 2 === 0 ? 0.72 : 1.42])),
      sizeMultipliersByReferenceId: Object.fromEntries(boardImages.map((image, index) => [image.referenceId, index % 2 === 0 ? 1.14 : 1])),
      renderMetadataByReferenceId
    })
  );

  assertNoRenderedBoundsOverlap(relaid.images, renderMetadataByReferenceId);
});

test("generateBoard expands board footprint for higher image counts without overlap", () => {
  const references = Array.from({ length: 30 }, (_, index) => ({
    id: `wide_layout_ref_${index}`,
    name: `Wide Layout Ref ${index}`,
    type: "T-Shirt",
    garmentType: "Top",
    layerType: "Inner",
    weight: "Light",
    styleTags: ["Casual"],
    list: "Wardrobe"
  }));

  const { board } = withSeed(27, () =>
    generateBoard({
      items: references,
      imageCount: 25,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY
  };

  for (let index = 0; index < board.images.length; index += 1) {
    bounds.minX = Math.min(bounds.minX, board.images[index].x);
    bounds.minY = Math.min(bounds.minY, board.images[index].y);
    bounds.maxX = Math.max(bounds.maxX, board.images[index].x + board.images[index].width);
    bounds.maxY = Math.max(bounds.maxY, board.images[index].y + board.images[index].height);
  }

  assert.equal(board.images.length, 25);
  assertNoRenderedBoundsOverlap(board.images);
  assert.ok(board.width > 2400, `expected expanded board width, received ${board.width}`);
  assert.ok(board.height > 1800, `expected expanded board height, received ${board.height}`);
  assert.ok(bounds.maxX - bounds.minX > 1600, "expected wider distributed collage footprint");
});

test("relayoutBoardImages preserves ids and removes overlap after board updates", () => {
  const boardImages = Array.from({ length: 6 }, (_, index) => ({
    id: `board_image_${index}`,
    referenceId: `layout_reflow_ref_${index}`,
    generationSlot: null,
    x: 0,
    y: 0,
    width: 180,
    height: 180,
    rotation: 0,
    zIndex: index + 1
  }));

  const relaid = withSeed(28, () =>
    relayoutBoardImages(boardImages, {
      aspectRatiosByReferenceId: Object.fromEntries(boardImages.map((image, index) => [image.referenceId, index % 2 ? 0.76 : 1.18])),
      sizeMultipliersByReferenceId: Object.fromEntries(boardImages.map((image, index) => [image.referenceId, index % 3 ? 1 : 1.16]))
    })
  );

  assert.deepEqual(relaid.images.map((image) => image.id), boardImages.map((image) => image.id));

  assertNoRenderedBoundsOverlap(
    relaid.images,
    Object.fromEntries(relaid.images.map((image, index) => [image.referenceId, { aspectRatio: index % 2 ? 0.76 : 1.18 }]))
  );
});

test("guided board first pick is weighted-random and not based on array order", () => {
  const references = [
    createMoodboardReference("board_first_a"),
    createMoodboardReference("board_first_b"),
    createMoodboardReference("board_first_c")
  ];

  const result = withMockRandom(0.99, () =>
    generateBoard({
      items: references,
      imageCount: 1,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(result.board.images[0].referenceId, "board_first_c");
});

test("guided board filters act as a hard gate for controls matching", () => {
  const references = [
    createMoodboardReference("board_hard_filter_a", ["style/vintage", "region/eu", "source/french", "medium/photograph"], { favorite: true }),
    createMoodboardReference("board_hard_filter_b", ["style/vintage", "region/eu", "source/french"]),
    createMoodboardReference("board_hard_filter_c", ["style/vintage", "region/eu", "medium/photograph"]),
    createMoodboardReference("board_hard_filter_d", ["style/minimal", "region/us", "source/studio", "medium/illustration"])
  ];

  const result = withSeed(91, () =>
    generateBoard({
      items: references,
      imageCount: 4,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true },
      boardFilters: {
        tags: ["style/vintage", "region/eu", "source/french", "medium/photograph"],
        excludedTags: [],
        tagMatchMode: "all",
        favorite: ""
      }
    })
  );

  assert.equal(result.board.images.length, 1);
  assert.deepEqual(result.board.images.map((image) => image.referenceId), ["board_hard_filter_a"]);
});

test("guided board grouped filters use OR within a group and AND across groups", () => {
  const references = [
    createMoodboardReference("board_grouped_a", ["collection/aw21", "source/lookbook"], { favorite: true }),
    createMoodboardReference("board_grouped_b", ["collection/aw21", "source/fit"]),
    createMoodboardReference("board_grouped_c", ["collection/aw21", "website/fit"]),
    createMoodboardReference("board_grouped_d", ["collection/ss22", "source/lookbook"])
  ];

  const result = withSeed(92, () =>
    generateBoard({
      items: references,
      imageCount: 10,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true },
      boardFilters: {
        tags: ["collection/aw21", "source/lookbook", "source/fit"],
        excludedTags: [],
        tagMatchMode: "grouped",
        favorite: ""
      }
    })
  );

  assert.equal(result.board.images.length, 2);
  assert.deepEqual(
    new Set(result.board.images.map((image) => image.referenceId)),
    new Set(["board_grouped_a", "board_grouped_b"])
  );
});

test("guided board grouped filters still short-circuit exclusions", () => {
  const references = [
    createMoodboardReference("board_grouped_excluded_a", ["collection/aw21", "source/lookbook"]),
    createMoodboardReference("board_grouped_excluded_b", ["collection/aw21", "source/fit", "color/red"])
  ];

  const result = withSeed(93, () =>
    generateBoard({
      items: references,
      imageCount: 10,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true },
      boardFilters: {
        tags: ["collection/aw21", "source/lookbook", "source/fit"],
        excludedTags: ["color/red"],
        tagMatchMode: "grouped",
        favorite: ""
      }
    })
  );

  assert.equal(result.board.images.length, 1);
  assert.deepEqual(result.board.images.map((image) => image.referenceId), ["board_grouped_excluded_a"]);
});

test("generateBoard returns a safe empty board when no references are available", () => {
  const result = withSeed(95, () =>
    generateBoard({
      items: [],
      imageCount: 10,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(result.board.images.length, 0);
  assert.ok(result.board.width > 0);
  assert.ok(result.board.height > 0);
});

test("generateBoard returns all available filtered matches when fewer than requested exist", () => {
  const references = [
    createMoodboardReference("board_filtered_small_a", ["style/vintage", "region/eu", "source/french", "medium/photograph"]),
    createMoodboardReference("board_filtered_small_b", ["style/vintage", "region/eu", "source/french", "medium/photograph", "color/black"]),
    createMoodboardReference("board_filtered_small_c", ["style/minimal", "region/us", "source/studio", "medium/illustration"])
  ];

  const result = withSeed(96, () =>
    generateBoard({
      items: references,
      imageCount: 10,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true },
      boardFilters: {
        tags: ["style/vintage", "region/eu", "source/french", "medium/photograph"],
        excludedTags: [],
        tagMatchMode: "all",
        favorite: ""
      }
    })
  );

  assert.equal(result.board.images.length, 2);
  assert.equal(new Set(result.board.images.map((image) => image.referenceId)).size, 2);
  assert.deepEqual(
    new Set(result.board.images.map((image) => image.referenceId)),
    new Set(["board_filtered_small_a", "board_filtered_small_b"])
  );
});

test("guided board soft maxPerTag still produces a full board when alternatives are limited", () => {
  const references = [
    createMoodboardReference("board_soft_tag_a", ["theme/art", "project/a"]),
    createMoodboardReference("board_soft_tag_b", ["theme/art", "project/b"]),
    createMoodboardReference("board_soft_tag_c", ["theme/art", "project/c"])
  ];

  const result = withSeed(92, () =>
    generateBoard({
      items: references,
      imageCount: 3,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(result.board.images.length, 3);
  assert.equal(new Set(result.board.images.map((image) => image.referenceId)).size, 3);
});

test("guided board avoids generating duplicate image ids", () => {
  const references = Array.from({ length: 8 }, (_, index) =>
    createMoodboardReference(`board_unique_${index}`, [`theme/group-${index % 2}`, `project/${index}`])
  );

  const result = withSeed(93, () =>
    generateBoard({
      items: references,
      imageCount: 5,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.equal(result.board.images.length, 5);
  assert.equal(new Set(result.board.images.map((image) => image.referenceId)).size, 5);
});

test("guided board keeps reference ids unique across repeated larger board generations", () => {
  const references = Array.from({ length: 18 }, (_, index) =>
    createMoodboardReference(`board_repeat_${index}`, [
      `theme/${index % 4}`,
      `project/${index}`,
      `medium/${index % 3}`
    ], {
      favorite: index % 5 === 0
    })
  );

  withSeed(131, () => {
    Array.from({ length: 12 }).forEach((_, iteration) => {
      const result = generateBoard({
        items: references,
        imageCount: 10,
        generationMode: "guided",
        generationLists: { Wardrobe: true, Wishlist: true }
      });

      assert.equal(
        new Set(result.board.images.map((image) => image.referenceId)).size,
        result.board.images.length,
        `duplicate reference selected on iteration ${iteration + 1}`
      );
    });
  });
});

test("guided board debug top candidates are skipped in normal mode and capped in debug mode", () => {
  const references = Array.from({ length: 10 }, (_, index) =>
    createMoodboardReference(`board_debug_${index}`, [`theme/${index % 3 === 0 ? "art" : "business"}`, `project/${index}`], {
      favorite: index === 0
    })
  );

  const normalResult = withSeed(94, () =>
    generateBoard({
      items: references,
      imageCount: 4,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );
  const debugResult = withSeed(94, () =>
    generateBoard({
      items: references,
      imageCount: 4,
      generationMode: "guided",
      generationLists: { Wardrobe: true, Wishlist: true },
      boardGuidedOptions: {
        collectTopCandidates: true
      }
    })
  );

  normalResult.guidedDebugPayload.forEach((entry) => {
    assert.equal((entry.topCandidates ?? []).length, 0);
  });
  debugResult.guidedDebugPayload.forEach((entry) => {
    assert.ok((entry.topCandidates ?? []).length <= 5);
  });
});

test("rerollBoardImage falls back to the full pool when the slot pool is empty", () => {
  const topOnlyReferences = [
    {
      id: "fallback_top_a",
      name: "Fallback Top A",
      type: "T-Shirt",
      garmentType: "Top",
      layerType: "Inner",
      weight: "Light",
      styleTags: ["Casual"],
      list: "Wardrobe"
    },
    {
      id: "fallback_top_b",
      name: "Fallback Top B",
      type: "T-Shirt",
      garmentType: "Top",
      layerType: "Inner",
      weight: "Light",
      styleTags: ["Casual"],
      list: "Wardrobe"
    },
    {
      id: "fallback_top_c",
      name: "Fallback Top C",
      type: "T-Shirt",
      garmentType: "Top",
      layerType: "Inner",
      weight: "Light",
      styleTags: ["Casual"],
      list: "Wardrobe"
    }
  ];

  const result = withSeed(24, () =>
    rerollBoardImage({
      board: {
        id: "board_test",
        width: 1600,
        height: 1200,
        images: [
          {
            id: "image_a",
            referenceId: "fallback_top_a",
            generationSlot: "Headwear",
            x: 10,
            y: 20,
            width: 220,
            height: 260,
            rotation: 2.5,
            zIndex: 1
          },
          {
            id: "image_b",
            referenceId: "fallback_top_b",
            generationSlot: "TopInner",
            x: 50,
            y: 80,
            width: 220,
            height: 260,
            rotation: -1.5,
            zIndex: 2
          }
        ]
      },
      imageId: "image_a",
      items: topOnlyReferences,
      generationLists: { Wardrobe: true, Wishlist: true }
    })
  );

  assert.ok(result);
  assert.equal(result.boardImage.id, "image_a");
  assert.equal(result.boardImage.generationSlot, "Headwear");
  assert.notEqual(result.boardImage.referenceId, "fallback_top_a");
  assert.ok(topOnlyReferences.some((item) => item.id === result.boardImage.referenceId));
  assert.equal(result.boardImage.x, 10);
  assert.equal(result.boardImage.y, 20);
  assert.equal(result.boardImage.width, 220);
  assert.equal(result.boardImage.height, 260);
  assert.equal(result.boardImage.rotation, 2.5);
  assert.equal(result.boardImage.zIndex, 1);
});
