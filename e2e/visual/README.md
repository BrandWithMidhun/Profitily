# Visual regression baselines

`*.visual.spec.ts` compare the rendered UI against committed PNG baselines via
Playwright `toHaveScreenshot`. Screenshots are **renderer-specific**: a baseline made on
Windows/macOS will not match the Linux CI runner. So **baselines are generated on Linux
inside the official Playwright Docker image** (matching the nightly runner) and committed
to `*-snapshots/` next to each spec.

- The `visual` project runs **nightly only** (`pnpm test:visual`), on the Linux runner.
- `pnpm test:e2e` (smoke + a11y) does **not** include visual, so it stays cross-OS safe.

## Regenerating baselines (after an intentional shell/UI change)

Run from a clean checkout of the branch (committed state — `node_modules` is gitignored,
so this does not touch your working install):

```bash
# from the repo root, on the committed branch state:
git worktree add --detach ../profitily-visual HEAD

docker run --rm -v "$(pwd)/../profitily-visual:/work" -w /work \
  mcr.microsoft.com/playwright:v1.61.0-noble \
  bash -lc "corepack enable && corepack prepare pnpm@11.1.2 --activate && \
            pnpm install --frozen-lockfile && \
            pnpm exec playwright test --project=visual --update-snapshots"

# copy the regenerated -linux baselines back into the repo, then commit:
cp -r ../profitily-visual/e2e/visual/*-snapshots e2e/visual/
git worktree remove ../profitily-visual
```

Pin the image tag to the repo's `@playwright/test` version (`v1.61.0-noble`). Commit the
updated PNGs in the same PR as the UI change so the nightly run stays green.
