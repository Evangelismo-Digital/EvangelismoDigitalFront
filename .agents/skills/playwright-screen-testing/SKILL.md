---
name: playwright-screen-testing
description: >-
  Verify newly built screens of this site with Playwright: full-page and element
  screenshots, responsive checks across mobile/tablet/desktop, horizontal-overflow and
  accessibility checks, and interactive flows. Use after building or changing any page or
  component, via the Playwright test suite or the Playwright MCP browser tools.
---

# Playwright Screen Verification

Every new or changed screen gets checked on all three projects (`desktop`, `tablet`, `mobile`) before it is called done.

## Two ways to look at a screen

1. **Interactive (Playwright MCP)** — start `npm run dev`, then use the browser tools to navigate to `http://localhost:5173/...`, resize to 390x844 / 768x1024 / 1280x800, take screenshots and read them. Use for quick visual review while building.
2. **Saved tests** — add a spec in `e2e/` so the check is repeatable. `e2e/screens.spec.ts` is the reference.

## Checklist per screen

- Landmarks visible: `navigation`, one `h1`, footer.
- No horizontal overflow: `document.documentElement.scrollWidth <= clientWidth` (helper `expectNoHorizontalOverflow` in `e2e/screens.spec.ts`).
- Fixed-top navbar does not cover the target section after `/?section=...` scrolling.
- Images have meaningful `alt` (pt-BR); `.webp` assets load (no 404 in `page.on('response')`).
- Forms: labels present, Zod error messages appear on invalid submit, success/error modals open with network mocked.
- Full-page screenshot via `page.screenshot({ path: testInfo.outputPath('<name>.png'), fullPage: true })`, then inspect it.
- Accessibility: run the axe-accessibility skill/MCP on the page.

## Locators

`getByRole` > `getByLabel` > `getByText` > `getByPlaceholder`. No CSS-module class selectors (they are hashed). Assert on real Portuguese copy.

## Pitfalls

- Never `waitForTimeout`; rely on web-first `expect(...).toBeVisible()`.
- `ArticlePage` loads MDX lazily — wait for content, not `networkidle`.
- Google Maps in `FindNearestChurch` is disabled by `SHOW_STATIC_MAP`; don't depend on it.
