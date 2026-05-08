{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fnil\fcharset0 LucidaGrande;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww8100\viewh17620\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # Moodboard App Architecture Roadmap\
\
## Current State\
- Local IndexedDB app\
- Preview/thumbnail/original image model\
- itemUuid + relink/source fields\
- preview-only lightweight backups\
- Vite + React\
\
## Key Decisions\
- previews are canonical render assets\
- originals are optional archival assets\
- browser storage should not be the long-term source of truth for originals\
- multi-user support is planned\
- workspace-based ownership model\
\
## Chosen Future Stack\
- Vercel frontend\
- Supabase Auth + Postgres\
- Cloudflare R2 image storage\
- IndexedDB as cache/offline layer only\
\
## Storage Strategy\
- previews/thumbnails stored in cloud\
- originals optional and quota-limited\
- no base64 image storage in database rows\
- itemUuid is immutable\
\
## Planned Migration Order\
1. Repository abstraction\
2. Supabase schema + RLS\
3. R2 upload/presign flow\
4. Cloud-backed item pipeline\
5. Local IndexedDB 
\f1 \uc0\u8594 
\f0  cloud migration\
6. Optional original uploads\
7. Public board sharing\
8. Offline/cache improvements\
\
## Important Constraints\
- normal backup JSON remains preview-only\
- originals should never be required for normal board usage\
- previews remain canonical for rendering\
\pard\tx404\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0
\cf0 - do not expose originals publicly}