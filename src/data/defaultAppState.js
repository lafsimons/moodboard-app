const defaultAppState = {
  layering: true,
  accessoriesEnabled: true,
  locked: {},
  excluded: {},
  outfit: {
    Headwear: null,
    TopInner: null,
    TopOuter: null,
    Bottom: null,
    Footwear: null,
    Bag: null,
    Neck: null,
    LeftHand: null,
    RightHand: null,
    Glasses: null,
    Belt: null
  },
  ignoredImportImages: [],
  savedOutfits: [],
  likedOutfitKeys: {},
  outfitAffinity: {},
  recentOutfits: [],
  generateCount: 0,
  imageCount: 15,
  generationLists: {
    Wardrobe: true,
    Wishlist: true
  },
  generationMode: "guided",
  generationMetadataFilters: {
    tags: [],
    favorite: ""
  },
  wardrobeFilters: {
    tags: [],
    excludedTags: [],
    tagMatchMode: "any",
    laundry: "",
    favorite: ""
  },
  librarySearch: "",
  wardrobeSort: "newest",
  libraryUiState: {
    libraryOpen: false,
    wardrobeFiltersOpen: false,
    wardrobeSavedOpen: false
  },
  outfitFilters: {
    style: [],
    climate: [],
    color: []
  },
  fitpics: []
};

export default defaultAppState;
