# AGENTS.md

## Cursor Cloud specific instructions

This is a Next.js 15 (App Router) single-page application called **Eve Clinic Autonomy Diagnostic**. It is a lead-generation tool for clinic owners.

### Services

| Service | Required | How to run |
|---------|----------|------------|
| Next.js dev server | Yes | `npm run dev` (port 3000) |
| Supabase (cloud) | No — app degrades gracefully | Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` |
| MCP endpoint | No — falls back to mock projections | Set `MCP_ENDPOINT` in `.env.local` |
| OpenAI API | No — falls back to template narrative | Set `OPENAI_API_KEY` in `.env.local` |

### Key commands

- **Dev server**: `npm run dev`
- **Lint**: `npm run lint`
- **Build**: `npm run build`
- **Production serve**: `npm start`

### Non-obvious caveats

- The project ships without an ESLint config file. One was added at `eslint.config.mjs` during setup. The codebase has pre-existing `@typescript-eslint/no-unused-vars` warnings (in `app/diagnostic/[id]/page.tsx` and `lib/pdf-report.ts`) that are downgraded to warnings so the build passes.
- Without real Supabase credentials, the API returns `id: null` and the frontend stores results in `sessionStorage`, redirecting to `/diagnostic/results` instead of `/diagnostic/[id]`. This is the expected graceful-degradation path.
- A `.env.local` with placeholder Supabase values is sufficient to run the app — the Supabase client will be created but operations will fail, triggering the inline-result fallback.
- Package manager is **npm** (lockfile: `package-lock.json`).
