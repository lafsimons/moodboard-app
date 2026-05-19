export const layerTypes = ["Outer", "Inner", "Both"];
export const weightOptions = ["Light", "Medium", "Heavy"];
export const itemLists = ["Wardrobe", "Wishlist"];
export const styleTagOptions = ["Casual", "Smart Casual", "Formal", "Athleisure"];

export const emptyForm = {
  id: "",
  name: "",
  description: "",
  imageUrl: "",
  images: {
    original: {
      src: "",
      mimeType: "",
      width: 0,
      height: 0,
      fileSize: 0,
      originalFilename: ""
    },
    preview: {
      src: "",
      mimeType: "",
      width: 0,
      height: 0,
      fileSize: 0,
      originalFilename: ""
    },
    thumbnail: {
      src: "",
      mimeType: "",
      width: 0,
      height: 0,
      fileSize: 0,
      originalFilename: ""
    }
  },
  originalPreserved: false,
  imageScale: 100,
  imageFrameScale: 100,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageCropX: 0,
  imageCropY: 0,
  imageCropWidth: 100,
  imageCropHeight: 100,
  value: "",
  retailValue: "",
  brand: "",
  tags: [],
  type: "",
  createdAt: 0,
  importedAt: 0,
  updatedAt: "",
  itemUuid: "",
  sourceNamespace: "",
  sourceRelativePath: "",
  sourceOriginalFilename: "",
  sourceFileSize: 0,
  sourceImageWidth: 0,
  sourceImageHeight: 0,
  sourceLastModified: 0,
  relinkStatus: "pending",
  originalFilename: "",
  fileExtension: "",
  fileSize: 0,
  mimeType: "",
  imageWidth: 0,
  imageHeight: 0,
  aspectRatio: 0,
  orientation: "",
  capturedAt: 0,
  originalCreatedAt: 0,
  cameraMake: "",
  cameraModel: "",
  lensModel: "",
  focalLength: "",
  fNumber: "",
  exposureTime: "",
  iso: "",
  colorSpace: "",
  colorProfile: "",
  size: "",
  favorite: false,
  garmentType: "Top",
  layerType: "Both",
  accessorySlot: "",
  color: "",
  weight: "",
  list: "Wardrobe",
  quantity: 1,
  styleTags: [],
  climateTags: []
};

export const typeDerivedFields = ["garmentType", "layerType", "accessorySlot", "weight", "size", "list", "styleTags"];

export const defaultTypeSuggestions = [
  "Bag",
  "Belt",
  "Jewelry",
  "Watch",
  "Glasses",
  "Sun Glasses",
  "Suspender",
  "Socks",
  "Beanie",
  "Cap",
  "Sport Cap",
  "Hat",
  "Sneakers",
  "Canvas Sneakers",
  "Leather Sneakers",
  "Boots",
  "Derby",
  "Slides",
  "Jeans",
  "Jeans (light)",
  "Trousers",
  "Pants",
  "Shorts",
  "Swim Shorts",
  "Sport Shorts",
  "Sport Pants",
  "Sweat Pants",
  "T-Shirt",
  "Sport T-Shirt",
  "LS T-Shirt",
  "Sport LS T-Shirt",
  "LS T-Shirt (light)",
  "LS T-Shirt (thick)",
  "Shirt",
  "Shirt (heavier cotton, wool)",
  "Wool Shirt",
  "Sweatshirt",
  "Sweatshirt (thin)",
  "Overshirt",
  "Knit Sweater",
  "Thick Knit Sweater",
  "Knit Vest",
  "Jacket",
  "Jacket (light)",
  "Twill Jacket",
  "Twill Jacket (light)",
  "Denim Jacket",
  "Denim Jacket (light)",
  "Fleece Sweater",
  "Fleece Jacket",
  "Shell Jacket",
  "Wool Jacket",
  "Wool Coat",
  "Cotton Coat",
  "Puffer",
  "Light trousers",
  "Sneakers (thin)",
  "Light Boots",
  "Boots (chunky, winter, lined)",
  "Heavy Wool Trousers",
  "Heavy Wool Layers",
  "Scarf",
  "Thick Scarf",
  "Beanie (light)",
  "Heavy Beanie",
  "Sunglasses"
];

export const typeDefaultsByKey = {
  cap: { garmentType: "Headwear", size: "OS", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  "sport cap": { garmentType: "Headwear", size: "OS", weight: "Light", styleTags: ["Athleisure"] },
  beanie: { garmentType: "Headwear", size: "OS", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  "beanie (light)": { garmentType: "Headwear", size: "OS", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  "heavy beanie": { garmentType: "Headwear", size: "OS", weight: "Heavy", styleTags: ["Casual", "Athleisure"] },
  hat: { garmentType: "Headwear", size: "OS", weight: "Light", styleTags: ["Casual", "Smart Casual"] },
  "t-shirt": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  "sport t-shirt": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Athleisure"] },
  "ls t-shirt": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  "ls t-shirt (light)": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  "ls t-shirt (thick)": { garmentType: "Top", layerType: "Inner", weight: "Medium", styleTags: ["Casual"] },
  "sport ls t-shirt": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Athleisure"] },
  shirt: { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  "shirt (heavier cotton, wool)": { garmentType: "Top", layerType: "Inner", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  "casual shirt": { garmentType: "Top", layerType: "Inner", weight: "Light", styleTags: ["Casual"] },
  "wool shirt": { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual"] },
  sweatshirt: { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  "sweatshirt (thin)": { garmentType: "Top", layerType: "Both", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  hoodie: { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  "fleece sweater": { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  knit: { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "knit sweater": { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "thick knit sweater": { garmentType: "Top", layerType: "Both", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] },
  "knit vest": { garmentType: "Top", layerType: "Both", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  overshirt: { garmentType: "Top", layerType: "Both", weight: "Medium", styleTags: ["Smart Casual"] },
  "heavy wool layers": { garmentType: "Top", layerType: "Both", weight: "Heavy", styleTags: ["Smart Casual", "Formal"] },
  jacket: { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual"] },
  "jacket (light)": { garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Casual"] },
  "twill jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "twill jacket (light)": { garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Casual", "Smart Casual"] },
  "denim jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual"] },
  "denim jacket (light)": { garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Casual"] },
  "fleece jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  "heavy fleece jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Casual", "Athleisure"] },
  "shell jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  "wool jacket": { garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Smart Casual", "Formal"] },
  "wool coat": { garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Formal", "Smart Casual"] },
  blazer: { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  coat: { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "cotton coat": { garmentType: "Outerwear", layerType: "Outer", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  puffer: { garmentType: "Outerwear", layerType: "Outer", weight: "Heavy", styleTags: ["Casual"] },
  trousers: { garmentType: "Bottom", weight: "Medium", styleTags: ["Smart Casual", "Formal"] },
  "light trousers": { garmentType: "Bottom", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  "heavy wool trousers": { garmentType: "Bottom", weight: "Heavy", styleTags: ["Smart Casual", "Formal"] },
  jeans: { garmentType: "Bottom", weight: "Medium", styleTags: ["Casual"] },
  "jeans (light)": { garmentType: "Bottom", weight: "Light", styleTags: ["Casual"] },
  shorts: { garmentType: "Bottom", weight: "Light", styleTags: ["Casual"] },
  "swim shorts": { garmentType: "Bottom", weight: "Light", styleTags: ["Athleisure"] },
  "sport shorts": { garmentType: "Bottom", weight: "Light", styleTags: ["Athleisure"] },
  "sport pants": { garmentType: "Bottom", weight: "Medium", styleTags: ["Athleisure"] },
  "sweat pants": { garmentType: "Bottom", weight: "Medium", styleTags: ["Casual", "Athleisure"] },
  sneakers: { garmentType: "Footwear", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  "sneakers (thin)": { garmentType: "Footwear", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  "canvas sneakers": { garmentType: "Footwear", weight: "Light", styleTags: ["Casual"] },
  "leather sneakers": { garmentType: "Footwear", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  derby: { garmentType: "Footwear", weight: "Medium", styleTags: ["Formal", "Smart Casual"] },
  boots: { garmentType: "Footwear", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] },
  "light boots": { garmentType: "Footwear", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "boots (chunky, winter, lined)": { garmentType: "Footwear", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] },
  sandals: { garmentType: "Footwear", weight: "Light", styleTags: ["Casual"] },
  slides: { garmentType: "Footwear", weight: "Light", styleTags: ["Casual", "Athleisure"] },
  bag: { garmentType: "Accessory", accessorySlot: "Bag", size: "OS", weight: "Light", styleTags: ["Casual"] },
  belt: { garmentType: "Accessory", accessorySlot: "Belt", size: "OS", weight: "Light", styleTags: ["Casual", "Smart Casual"] },
  glasses: { garmentType: "Accessory", accessorySlot: "Glasses", size: "OS", weight: "Light", styleTags: ["Casual"] },
  sunglasses: { garmentType: "Accessory", accessorySlot: "Glasses", size: "OS", weight: "Light", styleTags: ["Casual"] },
  jewelry: { garmentType: "Accessory", accessorySlot: "LeftHand", size: "OS", weight: "Light", styleTags: ["Smart Casual"] },
  watch: { garmentType: "Accessory", accessorySlot: "LeftHand", size: "OS", weight: "Light", styleTags: ["Smart Casual", "Formal"] },
  "sun glasses": { garmentType: "Accessory", accessorySlot: "Glasses", size: "OS", weight: "Light", styleTags: ["Casual"] },
  suspender: { garmentType: "Accessory", accessorySlot: "Belt", size: "OS", weight: "Light", styleTags: ["Formal"] },
  socks: { garmentType: "Accessory", accessorySlot: "", size: "OS", weight: "Light", styleTags: ["Casual"] },
  scarf: { garmentType: "Accessory", accessorySlot: "Neck", size: "OS", weight: "Medium", styleTags: ["Casual", "Smart Casual"] },
  "thick scarf": { garmentType: "Accessory", accessorySlot: "Neck", size: "OS", weight: "Heavy", styleTags: ["Casual", "Smart Casual"] },
  dress: { garmentType: "Dresses/Jumpsuits" },
  dresses: { garmentType: "Dresses/Jumpsuits" },
  jumpsuit: { garmentType: "Dresses/Jumpsuits" }
};

export function normalizeList(list) {
  if (typeof list !== "string") {
    return "Wardrobe";
  }

  const normalizedList = list.trim();
  return normalizedList || "Wardrobe";
}

export function normalizeItemType(type) {
  return type === "Derbies" ? "Derby" : type;
}

export function normalizeWeight(value) {
  return weightOptions.includes(value) ? value : "";
}

export function normalizeTagList(value, options) {
  return Array.isArray(value)
    ? value.filter((tag, index) => options.includes(tag) && value.indexOf(tag) === index)
    : [];
}

export function normalizeType(type) {
  return type?.trim().toLowerCase() ?? "";
}

const TYPE_KEYWORD_FALLBACKS = [
  { match: ["swim shorts", "board shorts"], map: "swim shorts" },
  { match: ["swim", "boardshort"], map: "swim shorts" },
  { match: ["tank"], map: "t-shirt" },
  { match: ["polo"], map: "shirt" },
  { match: ["tee", "t shirt"], map: "t-shirt" },
  { match: ["long sleeve", "longsleeve"], map: "ls t-shirt" },
  { match: ["shirt"], map: "shirt" },
  { match: ["overshirt", "flannel", "rugby"], map: "overshirt" },
  { match: ["hoodie"], map: "hoodie" },
  { match: ["sweatshirt", "crewneck"], map: "sweatshirt" },
  { match: ["jumper", "pullover"], map: "knit sweater" },
  { match: ["knit", "sweater", "cardigan"], map: "knit sweater" },
  { match: ["short"], map: "shorts" },
  { match: ["trouser", "pants", "chino", "slack"], map: "trousers" },
  { match: ["jean", "denim"], map: "jeans" },
  { match: ["cargo"], map: "trousers" },
  { match: ["jogger", "sweatpants", "track pants"], map: "sport pants" },
  { match: ["leather sneaker"], map: "leather sneakers" },
  { match: ["sneaker", "trainer", "runner", "running shoe"], map: "sneakers" },
  { match: ["loafer"], map: "derby" },
  { match: ["derby", "oxford"], map: "derby" },
  { match: ["chelsea"], map: "boots" },
  { match: ["boot"], map: "boots" },
  { match: ["sandal"], map: "sandals" },
  { match: ["slide", "flip flop"], map: "slides" },
  { match: ["running", "training", "gym", "sport", "athletic", "track", "workout"], map: "sport t-shirt" },
  { match: ["wool coat"], map: "wool coat" },
  { match: ["coat", "trench", "parka", "mac"], map: "coat" },
  { match: ["blazer"], map: "blazer" },
  { match: ["puffer"], map: "puffer" },
  { match: ["rain jacket", "shell", "windbreaker"], map: "shell jacket" },
  { match: ["fleece"], map: "fleece jacket" },
  { match: ["jacket"], map: "jacket" },
  { match: ["sport cap", "baseball cap"], map: "sport cap" },
  { match: ["cap"], map: "cap" },
  { match: ["beanie"], map: "beanie" },
  { match: ["bucket hat"], map: "hat" },
  { match: ["hat"], map: "hat" },
  { match: ["belt"], map: "belt" },
  { match: ["tote", "backpack", "bag"], map: "bag" },
  { match: ["scarf"], map: "scarf" },
  { match: ["watch"], map: "watch" },
  { match: ["sunglasses", "glasses"], map: "sunglasses" },
  { match: ["ring", "necklace", "bracelet", "jewelry"], map: "jewelry" },
  { match: ["sock"], map: "socks" }
];

export function normalizeTypeForKeywordFallback(type) {
  return normalizeType(type)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveExactTypePresetKey(type) {
  const normalized = normalizeType(type).replace(/[_\s]+/g, " ");
  return typeDefaultsByKey[normalized] ? normalized : "";
}

export function resolveAliasTypePresetKey(type) {
  const normalized = normalizeType(type).replace(/[_\s]+/g, " ");

  if (["t-shirt", "t shirt", "tshirt", "tee"].includes(normalized)) return "t-shirt";
  if (["ls t-shirt", "ls t shirt", "longsleeve", "long sleeve t-shirt", "long sleeve tee", "ls tee"].includes(normalized)) return "ls t-shirt";
  if (["ls t-shirt (light)", "light ls t-shirt", "ls tee light"].includes(normalized)) return "ls t-shirt (light)";
  if (["ls t-shirt (thick)", "thick ls t-shirt", "heavy ls t-shirt"].includes(normalized)) return "ls t-shirt (thick)";
  if (["pants"].includes(normalized)) return "trousers";
  if (["sport pants", "track pants", "training pants", "joggers"].includes(normalized)) return "sport pants";
  if (["sweat pants", "sweatpants", "sweats", "jogging pants"].includes(normalized)) return "sweat pants";
  if (["light trousers", "linen trousers", "cotton trousers light"].includes(normalized)) return "light trousers";
  if (["heavy wool trousers"].includes(normalized)) return "heavy wool trousers";
  if (["denim", "denim pants"].includes(normalized)) return "jeans";
  if (["jeans (light)", "light jeans"].includes(normalized)) return "jeans (light)";
  if (["sweater"].includes(normalized)) return "knit sweater";
  if (["fleece", "fleece pullover", "fleece sweater"].includes(normalized)) return "fleece sweater";
  if (["thick knit sweater", "heavy knit sweater"].includes(normalized)) return "thick knit sweater";
  if (["vest", "knitted vest"].includes(normalized)) return "knit vest";
  if (["overshirt"].includes(normalized)) return "overshirt";
  if (["shirt (heavier cotton, wool)", "heavy shirt", "wool cotton shirt"].includes(normalized)) return "shirt (heavier cotton, wool)";
  if (["sweatshirt (thin)", "thin sweatshirt"].includes(normalized)) return "sweatshirt (thin)";
  if (["sneaker", "sneakers"].includes(normalized)) return "sneakers";
  if (["sneakers (thin)", "thin sneakers"].includes(normalized)) return "sneakers (thin)";
  if (["sandal", "sandals"].includes(normalized)) return "sandals";
  if (["slide", "slides"].includes(normalized)) return "slides";
  if (["boot", "boots"].includes(normalized)) return "boots";
  if (["light boots"].includes(normalized)) return "light boots";
  if (["boots (chunky, winter, lined)", "chunky boots", "winter boots", "lined boots"].includes(normalized)) return "boots (chunky, winter, lined)";
  if (["derby", "derbies"].includes(normalized)) return "derby";
  if (["sunglasses"].includes(normalized)) return "sunglasses";
  if (normalized === "cap") return "cap";
  if (["beanie (light)"].includes(normalized)) return "beanie (light)";
  if (["heavy beanie"].includes(normalized)) return "heavy beanie";
  if (["jacket (light)", "light jacket"].includes(normalized)) return "jacket (light)";
  if (["twill jacket (light)", "twill jacket (thin)", "thin twill jacket"].includes(normalized)) return "twill jacket (light)";
  if (["denim jacket (light)", "light denim jacket", "thin denim jacket"].includes(normalized)) return "denim jacket (light)";
  if (["puffer", "puffer jacket"].includes(normalized)) return "puffer";
  if (["heavy fleece jacket"].includes(normalized)) return "heavy fleece jacket";
  if (["heavy wool layers"].includes(normalized)) return "heavy wool layers";
  if (["thick scarf"].includes(normalized)) return "thick scarf";

  return "";
}

export function resolveKeywordFallbackPresetKey(type) {
  const normalized = normalizeTypeForKeywordFallback(type);

  if (!normalized) {
    return "";
  }

  const compact = normalized.replace(/\s+/g, "");

  const matchedFallback = TYPE_KEYWORD_FALLBACKS.find((entry) =>
    entry.match.some((match) => {
      const normalizedMatch = normalizeTypeForKeywordFallback(match);
      return normalized.includes(normalizedMatch) || compact.includes(normalizedMatch.replace(/\s+/g, ""));
    })
  );

  return matchedFallback?.map ?? "";
}

export function getTypePresetKey(type) {
  return resolveExactTypePresetKey(type) || resolveAliasTypePresetKey(type) || resolveKeywordFallbackPresetKey(type) || "";
}

export function getTypeMatchKeys(type) {
  const normalized = normalizeType(type);
  const presetKey = getTypePresetKey(type);
  const matches = new Set([normalized, presetKey].filter(Boolean));

  if (presetKey?.startsWith("ls t-shirt")) matches.add("ls t-shirt");
  if (presetKey?.startsWith("sport ls t-shirt")) {
    matches.add("sport ls t-shirt");
    matches.add("ls t-shirt");
  }
  if (presetKey?.startsWith("sweatshirt")) matches.add("sweatshirt");
  if (presetKey === "fleece sweater") matches.add("fleece sweater");
  if (presetKey?.startsWith("twill jacket")) matches.add("twill jacket");
  if (presetKey?.startsWith("denim jacket")) matches.add("denim jacket");
  if (presetKey?.startsWith("jacket")) matches.add("jacket");
  if (presetKey?.startsWith("beanie")) matches.add("beanie");
  if (presetKey?.startsWith("boots")) matches.add("boots");
  if (presetKey?.startsWith("sneakers")) matches.add("sneakers");
  if (presetKey?.includes("scarf")) matches.add("scarf");
  if (presetKey === "overshirt") matches.add("wool shirt");
  if (presetKey === "shirt (heavier cotton, wool)") {
    matches.add("shirt");
    matches.add("wool shirt");
  }
  if (presetKey === "light trousers" || presetKey === "heavy wool trousers") matches.add("trousers");
  if (presetKey === "sport pants" || presetKey === "sweat pants") matches.add("pants");
  if (presetKey === "jeans (light)") matches.add("jeans");
  if (presetKey === "thick knit sweater") matches.add("knit sweater");
  if (presetKey === "sunglasses") matches.add("sun glasses");

  return matches;
}

export function resolveTypeDefaults(type) {
  const normalizedItemTypeValue = normalizeItemType(type?.trim() ?? "");
  const presetKey = getTypePresetKey(normalizedItemTypeValue);
  const defaults = presetKey ? typeDefaultsByKey[presetKey] ?? {} : {};

  return {
    ...emptyForm,
    type: normalizedItemTypeValue,
    ...defaults,
    weight: normalizeWeight(defaults.weight),
    styleTags: normalizeTagList(defaults.styleTags, styleTagOptions)
  };
}

export function hasTypeDefaults(type) {
  return Boolean(getTypePresetKey(type));
}

export function applyMappedStyleWeightDefaults(item) {
  if (!hasTypeDefaults(item.type)) {
    return item;
  }

  const defaults = resolveTypeDefaults(item.type);

  return {
    ...item,
    weight: defaults.weight,
    styleTags: [...defaults.styleTags]
  };
}
