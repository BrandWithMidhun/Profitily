# 10 — Setup: Local Folder + Git + Claude Code

Wires up the **local folder**, a **git repo**, and **Claude Code** as the executor.
Everything runs locally with **no paid account** (Claude Code itself needs a paid
Claude plan or Console API billing — the free Claude.ai plan doesn't include it).
Canonical install steps: <https://code.claude.com/docs/en/setup>.

## 1. Prerequisites
- **Git** 2.23+ · **Docker** + Docker Compose · **Node.js 22 LTS** + **pnpm 9+** (npm
  path) — or use the native Claude Code installer (no Node needed for the CLI itself).

## 2. Project folder
Put the repo files in e.g. `~/projects/profitily-ai` (unzip there if you downloaded
the archive):
```bash
mkdir -p ~/projects && cd ~/projects
# unzip/move files into ~/projects/profitily-ai
cd profitily-ai
```

## 3. Git
```bash
git init
git add .
git commit -m "chore: scaffold docs, schema, plan, templates"
# GitHub (create an empty repo first)
git remote add origin git@github.com:<you>/profitily-ai.git
git branch -M main
git push -u origin main
# create the long-lived develop branch (auto-deploys to Railway staging)
git checkout -b develop && git push -u origin develop
```
Enable **branch protection** on `main` **and** `develop` (require PR + passing CI).
Feature branches start from `develop`; PRs target `develop`. See `docs/12 §7` for the
branch→environment auto-deploy mapping.

## 4. Install Claude Code
**Native (recommended, no Node):**
```bash
curl -fsSL https://claude.ai/install.sh | bash        # macOS/Linux
```
```powershell
irm https://claude.ai/install.ps1 | iex               # Windows PowerShell
```
**npm (if npm is your standard tooling):**
```bash
npm install -g @anthropic-ai/claude-code              # do NOT use sudo
```
If `EACCES`: set a user npm prefix (`~/.npm-global`) and add its `bin` to PATH rather
than using sudo. Verify:
```bash
claude --version
claude doctor
```
A GUI option: the **Claude desktop app** (macOS/Windows) runs Claude Code without a
terminal — point it at the same folder.

## 5. Connect Claude Code to the folder
Claude Code operates on the directory you launch it in — that's the connection.
```bash
cd ~/projects/profitily-ai
claude
```
First launch opens browser OAuth (or set `ANTHROPIC_API_KEY` for Console billing).
Claude Code reads `CLAUDE.md` from the root every session.

## 6. Bring up local infra (all OSS)
```bash
cp .env.example .env
docker compose -f tooling/docker-compose.yml up -d    # PG+Timescale, Redis, MinIO, Mailpit, Ollama
pnpm install
pnpm db:migrate && pnpm db:seed
```
For Shopify webhooks in dev, expose `apps/api` with a tunnel
(`cloudflared tunnel --url http://localhost:3001`) and register that URL in your
Shopify dev app.

## 7. First executor session
In `claude`, paste:
> Read `CLAUDE.md` and `docs/07-PROJECT-PLAN.md`. Confirm the current `ACTIVE TASK`,
> then give me your implementation plan (files + tests) **before** writing code.
> Branch per our convention and stop at the acceptance criteria.

Then bring its PR back here (planner) for review per `docs/09-WORKFLOW.md`.

## 8. Round-trip
```
Planner chat  ──▶  fill BUILD-REQUEST.md, paste into Claude Code
Claude Code   ──▶  branch → plan → tests → code → gates → PR
You           ──▶  paste PR back to planner chat
Planner       ──▶  APPROVE / change requests
Claude Code   ──▶  merge on approval; planner marks DONE, sets next ACTIVE
```

## 9. Useful commands
| Command | Purpose |
|---|---|
| `claude` | start a session in the folder |
| `claude -p "…"` | headless one-shot (CI/scripts) |
| `/help` `/clear` | slash commands inside a session |
| `claude doctor` | diagnose install/auth/config |
| `claude update` | apply pending update |

## 10. Troubleshooting
- `command not found: claude` → PATH not updated; reopen shell / re-source profile.
- npm update/permission errors → switch to the native installer.
- Webhooks not arriving → tunnel down or URL not registered in the Shopify dev app.
- Containers unhealthy → `docker compose logs <svc>`; ensure ports free.

## 11. Next steps
- **Designing UI?** Drop pages into `design/<surface>/<slug>/` per
  `docs/11-UI-DEVELOPMENT.md` so Claude Code can implement them.
- **Deploying?** Follow `docs/12-DEPLOYMENT-RAILWAY.md` (Railway services, Timescale,
  Redis, cron, CI-gated deploys). Dev stays local/free; Railway is staging/prod.
