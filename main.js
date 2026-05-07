import { wardrobe } from "./wardrobe.js";

const slots = ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"];

let state = {
  layering: false,
  locked: {},
  outfit: {}
};

/* ---------- HELPERS ---------- */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isTopBoth(item) {
  return wardrobe.TopBoth.some(i => i.id === item.id);
}

function getTopPool(slot) {
  if (slot === "TopInner") {
    return [...wardrobe.TopInner, ...wardrobe.TopBoth];
  }
  if (slot === "TopOuter") {
    return [...wardrobe.TopOuter, ...wardrobe.TopBoth];
  }
  return [];
}

/* ---------- GENERATION ---------- */

function generateOutfit() {
  let usedTopBoth = false;

  for (let slot of slots) {
    if (state.locked[slot] && state.outfit[slot]) continue;

    if (slot === "TopInner" || slot === "TopOuter") {
      let pool = getTopPool(slot);
      let item = pick(pool);

      if (isTopBoth(item)) {
        if (usedTopBoth) {
          item = pick(
            slot === "TopInner"
              ? wardrobe.TopInner
              : wardrobe.TopOuter
          );
        } else {
          usedTopBoth = true;
        }
      }

      state.outfit[slot] = item;
      continue;
    }

    state.outfit[slot] = pick(wardrobe[slot]);
  }

  render();
}

/* ---------- INTERACTIONS ---------- */

function reroll(slot) {
  if (state.locked[slot]) return;

  if (slot === "TopInner" || slot === "TopOuter") {
    state.outfit[slot] = pick(getTopPool(slot));
  } else {
    state.outfit[slot] = pick(wardrobe[slot]);
  }

  render();
}

function toggleLock(slot) {
  state.locked[slot] = !state.locked[slot];
  render();
}

function toggleLayering() {
  state.layering = !state.layering;

  document.getElementById("layerBtn").textContent =
    state.layering ? "Layering: ON" : "Layering: OFF";

  render();
}

/* ---------- RENDER ---------- */

function render() {
  const container = document.getElementById("outfit");
  container.innerHTML = "";

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (state.layering && slot === "TopInner") {
      const row = document.createElement("div");
      row.className = "top-row";

      row.appendChild(renderLayer("TopInner"));
      row.appendChild(renderLayer("TopOuter"));

      container.appendChild(row);
      i++;
      continue;
    }

    if (state.layering && slot === "TopOuter") continue;
    if (!state.layering && slot === "TopInner") continue;

    container.appendChild(renderItem(slot));
  }
}

/* ---------- COMPONENTS ---------- */

function renderItem(slot) {
  const item = state.outfit[slot];
  if (!item) return document.createElement("div");

  const div = document.createElement("div");
  div.className = "item" + (state.locked[slot] ? " locked" : "");

  div.innerHTML = `
    <img src="${item.img}">
    <div class="lock-indicator">LOCKED</div>
    <button class="reroll">↻</button>
  `;

  div.querySelector("img").onclick = () => toggleLock(slot);
  div.querySelector("button").onclick = (e) => {
    e.stopPropagation();
    reroll(slot);
  };

  return div;
}

function renderLayer(slot) {
  const item = state.outfit[slot];
  if (!item) return document.createElement("div");

  const div = document.createElement("div");
  div.className = "layer-item" + (state.locked[slot] ? " locked" : "");

  div.innerHTML = `
    <img src="${item.img}">
    <div class="lock-indicator">LOCKED</div>
    <button class="reroll">↻</button>
  `;

  div.querySelector("img").onclick = () => toggleLock(slot);
  div.querySelector("button").onclick = (e) => {
    e.stopPropagation();
    reroll(slot);
  };

  return div;
}

/* ---------- GLOBAL BINDINGS (needed for buttons) ---------- */

window.generateOutfit = generateOutfit;
window.toggleLayering = toggleLayering;

/* ---------- INIT ---------- */

generateOutfit();import { wardrobe } from "./wardrobe.js";

const slots = ["Headwear", "TopInner", "TopOuter", "Bottom", "Footwear"];

let state = {
  layering: false,
  locked: {},
  outfit: {}
};

/* ---------- HELPERS ---------- */

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isTopBoth(item) {
  return wardrobe.TopBoth.some(i => i.id === item.id);
}

function getTopPool(slot) {
  if (slot === "TopInner") {
    return [...wardrobe.TopInner, ...wardrobe.TopBoth];
  }
  if (slot === "TopOuter") {
    return [...wardrobe.TopOuter, ...wardrobe.TopBoth];
  }
  return [];
}

/* ---------- GENERATION ---------- */

function generateOutfit() {
  let usedTopBoth = false;

  for (let slot of slots) {
    if (state.locked[slot] && state.outfit[slot]) continue;

    if (slot === "TopInner" || slot === "TopOuter") {
      let pool = getTopPool(slot);
      let item = pick(pool);

      if (isTopBoth(item)) {
        if (usedTopBoth) {
          item = pick(
            slot === "TopInner"
              ? wardrobe.TopInner
              : wardrobe.TopOuter
          );
        } else {
          usedTopBoth = true;
        }
      }

      state.outfit[slot] = item;
      continue;
    }

    state.outfit[slot] = pick(wardrobe[slot]);
  }

  render();
}

/* ---------- INTERACTIONS ---------- */

function reroll(slot) {
  if (state.locked[slot]) return;

  if (slot === "TopInner" || slot === "TopOuter") {
    state.outfit[slot] = pick(getTopPool(slot));
  } else {
    state.outfit[slot] = pick(wardrobe[slot]);
  }

  render();
}

function toggleLock(slot) {
  state.locked[slot] = !state.locked[slot];
  render();
}

function toggleLayering() {
  state.layering = !state.layering;

  document.getElementById("layerBtn").textContent =
    state.layering ? "Layering: ON" : "Layering: OFF";

  render();
}

/* ---------- RENDER ---------- */

function render() {
  const container = document.getElementById("outfit");
  container.innerHTML = "";

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (state.layering && slot === "TopInner") {
      const row = document.createElement("div");
      row.className = "top-row";

      row.appendChild(renderLayer("TopInner"));
      row.appendChild(renderLayer("TopOuter"));

      container.appendChild(row);
      i++;
      continue;
    }

    if (state.layering && slot === "TopOuter") continue;
    if (!state.layering && slot === "TopInner") continue;

    container.appendChild(renderItem(slot));
  }
}

/* ---------- COMPONENTS ---------- */

function renderItem(slot) {
  const item = state.outfit[slot];
  if (!item) return document.createElement("div");

  const div = document.createElement("div");
  div.className = "item" + (state.locked[slot] ? " locked" : "");

  div.innerHTML = `
    <img src="${item.img}">
    <div class="lock-indicator">LOCKED</div>
    <button class="reroll">↻</button>
  `;

  div.querySelector("img").onclick = () => toggleLock(slot);
  div.querySelector("button").onclick = (e) => {
    e.stopPropagation();
    reroll(slot);
  };

  return div;
}

function renderLayer(slot) {
  const item = state.outfit[slot];
  if (!item) return document.createElement("div");

  const div = document.createElement("div");
  div.className = "layer-item" + (state.locked[slot] ? " locked" : "");

  div.innerHTML = `
    <img src="${item.img}">
    <div class="lock-indicator">LOCKED</div>
    <button class="reroll">↻</button>
  `;

  div.querySelector("img").onclick = () => toggleLock(slot);
  div.querySelector("button").onclick = (e) => {
    e.stopPropagation();
    reroll(slot);
  };

  return div;
}

/* ---------- GLOBAL BINDINGS (needed for buttons) ---------- */

window.generateOutfit = generateOutfit;
window.toggleLayering = toggleLayering;

/* ---------- INIT ---------- */

generateOutfit();