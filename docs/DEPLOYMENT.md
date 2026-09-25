# MonsoonPulse AI — Deployment & Production Readiness Guide (`docs/DEPLOYMENT.md`)

---

## 1. Three-Tier Deployment Architecture

1. **Frontend & API Orchestration (`Next.js 15.1.6`)**:
   - Deployable on Vercel, Docker, or Node.js (`>= 20.x`).
   - Build command: `npm run build`
   - Start command: `npm start`
   - Health check endpoint: `GET /api/system/health`
   - Readiness check endpoint: `GET /api/system/readiness`

2. **Database & Persistence (`Supabase PostgreSQL`)**:
   - Apply SQL migrations sequentially:
     - `supabase/migrations/001_initial_schema.sql`
     - `supabase/migrations/002_external_data_ingestion.sql`
     - `supabase/migrations/003_ai_prediction_engine.sql`
     - `supabase/migrations/004_communication_and_alerts.sql`
     - `supabase/migrations/005_crop_advisory_decision_engine.sql`
     - `supabase/migrations/006_sih_final_indexes.sql`

3. **AI Inference Service (`Python FastAPI — MPAI-ENS-0.1`)**:
   - Working directory: `ml-service/`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
   - Endpoints:
     - `GET /health`
     - `GET /readiness`
     - `GET /model-metrics`
     - `POST /predict`

---

## 2. Security & Privacy Checklist

- `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, and `SMS_API_KEY` have **no** `NEXT_PUBLIC_` prefix and are restricted to server-side execution.
- All subscriber phone numbers are masked to `+91 ******1234` before serialization to UI views or delivery logs.
- Rate limiting (`checkDispatchRateLimit`) protects `/api/alerts/send` and `/api/alerts/send-bulk`.
