# PRD — Vietnamese Organic Food Store

## Original Problem Statement
Apply code review fixes + 6 follow-up requests: DB from env, drop Emergent libs, remove all Emergent branding, remove "Made with Emergent" badge, show/hide password toggle on login, real 63-province + full-district dropdowns on register.

## Tech Stack
- Frontend: React (CRA + CRACO), Tailwind, shadcn-ui, axios, sonner, lucide-react
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT + **google-genai** (official Google Gemini SDK)

## Implemented (2026-01)
### Iteration 1 — Code review fixes
- Hardcoded test secrets → env vars
- React hook deps fixed (useCallback for fetchProducts/fetchCart; use-toast subscription)
- localStorage security note on AuthProvider
- Array index keys replaced with stable message ids in chat
- Nested ternaries refactored (lookup map + IIFE helper)
- Removed `console.error`
- `startup_db` split into `_seed_admin_user` + `_seed_sample_products`
- `== True` → truthy assert; App_temp.js & App.js.backup deleted

### Iteration 2 — De-branding & feature additions
- All env: `MONGO_URL`, `DB_NAME`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`
- Replaced `emergentintegrations` with `google-genai` (`google.genai.Client`) for chat + OCR
- Removed `@emergentbase/visual-edits` from `package.json` and `craco.config.js`
- Cleaned `public/index.html` — no emergent scripts, no badge, no posthog, Vietnamese title
- Login: show/hide password toggle (Eye / EyeOff icon)
- Register: Province dropdown (63) + chained District dropdown (696) from static JSON `frontend/src/lib/vn-provinces.json`
- Testing: 19/19 backend tests pass, all frontend flows pass

## Known External Issues
- `GEMINI_API_KEY` provided by user currently has 0 free-tier quota (Google side).
  Chat/OCR integration is wired correctly — call reaches Google and returns 429 until
  quota/billing is enabled on the key or a different key is supplied.

## Prioritized Backlog
P1
- Migrate auth token from localStorage → httpOnly cookie + CSRF
- Extract oversized components (~1242 & ~1683) in App.js into files with sub-components + hooks

P2
- Clean pre-existing F541 f-string warnings in backend tests
- Add rate-limiting on `/api/auth/login`
