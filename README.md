# FarmAssist (Multi-State Agricultural Support Platform)

This is a comprehensive farmer assistance platform supporting multiple Indian states.

## Supported States
- **Jharkhand** (Fully implemented - Pilot)
- **Bihar** (Implemented with sample schemes)
- West Bengal (Framework ready)
- Odisha (Framework ready)
- Chhattisgarh (Framework ready)

## Key Features Implemented
- State-specific data organization under `src/data/states/`
- Dynamic state loading and region management
- Multi-state scheme recommendations
- State-specific admin verification queues
- Dynamic frontend state selection
- RESTful API with state parameters

## Folder structure
- src/server.js: API + static hosting
- src/engine: eligibility and ranking logic
- src/services: repositories and utilities
- src/data: pilot data (schemes + district/block master)
- public: simple frontend UI
- scripts/validateSchemes.js: data verification checks

## Run
1. Install dependencies
   npm install
2. Start app
   npm start
3. Open
   http://localhost:3010

## Deploy on Render (for access from India)
This repo includes a Render blueprint at `render.yaml`.

### Option A: Blueprint deploy (recommended)
1. Push this project to GitHub.
2. In Render, click New + -> Blueprint.
3. Select your GitHub repository.
4. Confirm Render detects `farmassist/render.yaml`.
5. Click Apply.
6. After deploy, open `https://<your-render-service>.onrender.com` from the India computer.

### Option B: Manual Web Service
1. In Render, click New + -> Web Service.
2. Connect your GitHub repository.
3. If this is a monorepo, set Root Directory to `farmassist`.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add environment variables from `.env.example`.

### Post-deploy checks
1. Open `/api/health` and confirm `{ "ok": true, ... }` response.
2. Open the homepage and test recommendation flow.
3. Test document scan with a small sample PDF/image.

### Important
- Keep `LLM_AADHAAR_FALLBACK=false` unless you have a valid key.
- Replace admin keys in `ADMIN_USERS_JSON` with strong secrets.
- Render automatically sets `PORT`; no manual `PORT` value is required there.

## API
- GET /api/health
- GET /api/languages
- GET /api/regions
- GET /api/regions?district=Ranchi
- POST /api/recommend
- GET /api/verification/report
- GET /api/admin/me (requires x-admin-key)
- GET /api/admin/verification/queue (requires reviewer/superadmin key)
- GET /api/admin/verification/queue.csv (requires reviewer/superadmin key)
- POST /api/admin/verification/:id/decision (requires reviewer/superadmin key)
- GET /api/admin/audit?limit=100 (requires auditor/reviewer/superadmin key)
- GET /api/admin/audit.csv?limit=100 (requires auditor/reviewer/superadmin key)

## Environment
- PORT=3010
- DEFAULT_LANGUAGE=English
- DEFAULT_STATE=Jharkhand
- VERIFIED_ONLY=true
- STRICT_VERIFIED_MODE=true
- ADMIN_KEY=change-me-in-env (legacy single-admin fallback)
- ADMIN_USERS_JSON=[{"id":"admin-1","name":"Program Admin","role":"superadmin","key":"change-me-superadmin"},{"id":"admin-2","name":"District Reviewer","role":"reviewer","key":"change-me-reviewer"},{"id":"admin-3","name":"Audit Officer","role":"auditor","key":"change-me-auditor"}]
- LLM_AADHAAR_FALLBACK=false (set true to enable optional fallback)
- LLM_AADHAAR_API_URL=https://api.openai.com/v1/chat/completions
- LLM_AADHAAR_API_KEY=... (required when fallback is enabled)
- LLM_AADHAAR_MODEL=gpt-4.1-mini
- LLM_AADHAAR_TIMEOUT_MS=12000

### Optional: LLM fallback for Aadhaar extraction

When enabled, the server uses OCR/PDF text first, then:
- uses LLM text fallback if no Aadhaar is found in extracted text
- uses LLM vision fallback for image uploads when OCR fails outright
Guardrails implemented:
- Fallback is disabled by default.
- Returned number is accepted only if it is 12 digits and Verhoeff checksum-valid.
- On any LLM failure/timeout, flow degrades safely to normal "not detected" behavior.

When STRICT_VERIFIED_MODE=true, recommendations always use verified records only, even if client payload sends verifiedOnly=false.

## Important note on "all district and block level verified schemes"
No product can honestly claim complete district/block coverage from day one without a formal verification pipeline.

This starter includes:
- verified central/state seeds
- district/block-capable schema
- pending template entries
- strict verification report endpoint

For production-grade completeness, use this workflow:
1. Source every scheme from official district/state circulars
2. Capture circular number + active date + source URL
3. Mark pending until human verification is complete
4. Publish only verified records in production mode

## Startup roadmap (recommended)
1. Build authoritative scheme registry (Jharkhand only first)
2. Add district nodal office directory and assisted application flow
3. Add document readiness score and deadline reminders
4. Add WhatsApp follow-ups for application progress
5. Track outcomes: applied, approved, rejected, disbursed

## Product moat
- Verified local data
- Application completion workflow
- Field partner network (CSC/FPO/NGO)
- Outcome tracking (not just scheme listing)
