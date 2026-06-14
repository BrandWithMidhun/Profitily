# Design Drops

Drop UI designs here so Claude Code can implement them. Full process and page specs:
[`../docs/11-UI-DEVELOPMENT.md`](../docs/11-UI-DEVELOPMENT.md).

## How to drop a page
Create a folder named after the page slug from the UI doc and add the design + notes:

```
design/<surface>/<page-slug>/
├── mockup.png        # or mockup.html, Figma export, or a few screenshots
└── notes.md          # behavior, states, data bindings, a11y, acceptance
```
- `<surface>` = `shopify-app` (Polaris) or `portal` (Tailwind).
- `<page-slug>` matches a spec, e.g. `portal/executive-dashboard/`,
  `shopify-app/wizard-4-costs/`.

## What to put in `notes.md`
Page/route · components & layout regions · **data bindings** (which API fields feed
which elements) · states (loading/empty/error) · interactions · responsive intent ·
accessibility notes · acceptance ("what correct looks like"). A template is in
[`../docs/11-UI-DEVELOPMENT.md §1`](../docs/11-UI-DEVELOPMENT.md).

## Optional shared tokens
Put colors/type/spacing in `tokens/tokens.json` and Claude Code will use them for the
portal. If absent, it follows the conventions in the UI doc + the `frontend-design`
skill.

## What Claude Code does with a drop
On a UI Build Request it reads the page §spec **and** this drop, implements the real
component with the page's data contract, adds tests (RTL + Playwright + axe + a visual
snapshot), and flags any mismatch between the drop and the spec to the planner. If no
drop exists for a UI task, it builds to the spec and notes that none was provided.

> Drops are committed to git (they're source of truth for the UI). Use synthetic
> content in mockups — no real merchant data.
