# Working Notes
OA = Outfit-App
MBA = Moodboard-App

## **Current local environments**

npm run dev -- --host 0.0.0.0

- OA
	- https://layerfit.vercel.app/ (main dataset on mobile here right now)
	- http://localhost:5173/ 
- MBA
	- http://localhost:5174/ (main dataset on mac right now)

---

## **OA current fixes**

- improve cropping

---

## **OA mobile notes**

- move wardrobe controls below cards
- bottom-sheet behavior
- separate sort from filter

---

## **OA feature transfers from MBA**

- bulk editing
- multi-select
- double-click preview
- tag improvements
- auto metadata
- library virtualization if performance becomes an issue

---

## OA architectural & generator concerns

- Dresses/Jumpsuits slot integration
- TopInner accepting Outerwear
- minimum guided-score floor
- config-table refactor for defaults
- add tiny wardrobe test fixtures

---

## **OA temporary implementation notes**

- preserve import metadata
- preserve timestamps
- update updatedAt on edit only
- generation behavior must remain stable
- no UI redesign during metadata migration
- preserve backward compatibility for exports/imports where feasible

---

## **MBA fixes**

### **Tags**

- infinite nesting support
- keyboard selection improvements
- rename hierarchy issues

### **Crop**

- incorrect crop boundaries
- oversized crop UI on tall images

### **Canvas**

- occasional distortion
- preview/render mismatch

---

## **MBA temporary ideas**

- bulk rename
- ordered board generation
- higher image counts
- auto backup updates
- remove default images
