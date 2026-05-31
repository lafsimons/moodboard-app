# Hub Architecture

The Hub is an ecosystem layer above individual libraries and applications.

Its purpose is to enable shared discovery, relationships, search, and ecosystem services while preserving independent ownership of workflows and data.

Libraries remain independent but can participate in shared discovery, relationships, and ecosystem services.

## Hub Responsibilities

The Hub is an ecosystem layer above individual applications and libraries.

The Hub owns:

- library discovery
- cross-library search
- relationship resolution
- ecosystem-wide indexing
- shared navigation
- backup orchestration

The Hub does not own:

- outfit generation
- board generation
- item editing
- library-specific workflows

Those remain the responsibility of OA, MBA, and future applications.

The Hub coordinates libraries and ecosystem services but is not itself a primary content-creation application.

---

## Libraries vs Tools Architecture

Potential long-term evolution of the Hub concept.

### **Core Insight**

The ecosystem should distinguish between:

- Libraries (data)
- Tools (workflows)

Rather than thinking in terms of separate applications (MBA vs OA), the system can be viewed as a collection of libraries that can be accessed by different tools.

### **Libraries**

Libraries are where information lives.

Examples:

```text
Personal MBA
T.T MBA
OA Wardrobe
OA Wishlist
OA Interested
OA Fitpics
Future Research Libraries
```

Each library remains independently accessible and manageable.

Users should never lose the ability to work inside a single library exactly as they do today.

Examples:

- Open Personal MBA only
- Open T.T MBA only
- Open OA only

The Hub should not force everything into one giant library.

### **Aggregate Views**

The Hub adds optional cross-library functionality.

Examples:

```text
Search:
[x] Personal MBA
[x] T.T MBA
[ ] OA
```

```text
Generate Board:
[x] Personal MBA
[x] T.T MBA
```

### Ecosystem Services

Ecosystem services are capabilities shared across libraries and applications.

Examples:

- search
- relationships
- indexing
- backup orchestration
- entity discovery
- synchronization

Applications consume ecosystem services but do not necessarily own them.

### **Tools**

Tools operate on libraries.

Examples:

```text
Generate Board
Generate Outfit
Search
Explore Links
Compare
```

A tool can draw from one or many libraries.

### **Example: Board Generation**

```text
Generate Board

Sources:
[x] Personal MBA
[x] T.T MBA
```

Board generation becomes a workflow operating on selected libraries rather than belonging exclusively to MBA.

### **Example: Outfit Generation**

```text
Generate Outfit

Wardrobe Source:
[x] OA Wardrobe

Inspiration Sources:
[x] Personal MBA
[x] T.T MBA
```

This enables outfit generation to use OA as the clothing source while simultaneously using research libraries as inspiration sources.

### **Benefits**

- Preserves independent libraries
- Allows combined workflows
- Scales naturally as additional libraries are added
- Avoids creating one massive database
- Makes cross-library generation possible
- Makes cross-library relationships possible
- Creates a foundation for a broader knowledge ecosystem

### **Long-Term Vision**

The Hub is not primarily an application launcher.

Instead, it becomes a layer above all libraries that:

- manages libraries
- enables relationships between libraries
- enables tools to operate across libraries
- preserves the ability to work within any single library independently

The result is a flexible ecosystem where data remains separated when desired but can be combined when useful.

---


## Multi-Library Ecosystem

Long-term evolution from individual applications toward a unified personal knowledge and wardrobe ecosystem.

### **Motivation**

As the number of libraries grows, managing separate app instances becomes increasingly cumbersome.

Currently, the main libraries exist as separate application instances and databases:

- MBA Personal Library (~2,000 images)
- MBA T.T Research Library (~6,000 images)
- OA (Wardrobe, Wishlist, Interested, Fitpics)

While OA already provides a unified experience across its internal libraries, moving between MBA Personal, MBA T.T, and OA remains cumbersome. Searching, generating, linking references, and surfacing ideas across these systems requires running separate instances and manually switching contexts.

At the moment, each library exists as a separate application instance or database, making it difficult to switch between libraries, search across them, generate boards using multiple sources, or create relationships between them.

### **Core Idea**

Instead of one MBA and one OA, introduce a Hub that manages multiple libraries.

```text
Hub
├─ Personal MBA
├─ T.T MBA
├─ Vintage Workwear MBA
├─ Footwear MBA
├─ OA Wardrobe
├─ OA Wishlist
├─ OA Fitpics
└─ Future Libraries
```

### **Principles**

#### **Libraries are first-class entities**

Each library should have:

- Stable ID
- Independent settings
- Independent metadata
- Independent backups
- Independent exports
- Independent sharing permissions (future)

#### **Cross-library access**

Examples:

- Search across multiple libraries simultaneously
- Generate boards using multiple libraries as sources
- View references from different libraries in a single feed
- Link entities between libraries

Example:

```text
Generate Board

Sources:
[x] Personal MBA
[x] T.T MBA
[ ] Vintage MBA
```

### **Relationships**

The Hub enables future relationships such as:

- MBA Reference ↔ OA Item
- MBA Reference ↔ MBA Board
- MBA Board ↔ OA Outfit
- OA Item ↔ Fitpic
- OA Outfit ↔ Inspiration References
- MBA Reference ↔ Philosophy Node

This creates a unified knowledge graph rather than isolated libraries.

### **Benefits**

- Easier navigation between projects
- Unified search across libraries
- Shared generation workflows
- Better scalability as libraries grow
- Cleaner backup and export architecture
- Foundation for cloud sync and sharing
- Foundation for future knowledge graph features

### **Design Considerations**

Current development does not require building the Hub immediately.

However, future-proofing should begin now:

- Stable IDs for all entities
- Stable IDs for all libraries
- Data models should not assume a single MBA library
- Data models should not assume a single OA library
- Relationships should be possible across library boundaries

### **Vision**

The long-term goal is not simply a Moodboard App and an Outfit App.

The goal is a personal visual knowledge ecosystem where multiple research libraries, wardrobe libraries, outfits, fitpics, and references can coexist, interact, and surface ideas across the entire system while remaining independently manageable.

**Libraries are first-class ecosystem objects.**

Each library has:

- stable library ID
- metadata
- ownership
- settings
- backup/export history
- future sharing permissions

Relationships may eventually exist not only between entities but also between libraries.

The Hub may eventually coordinate ecosystem-level backups spanning multiple libraries while preserving independent library exports.

Library Selection

Tools may operate on one or more selected libraries.

Examples:
- Search
- Board Generation
- Outfit Generation
- Relationship Exploration