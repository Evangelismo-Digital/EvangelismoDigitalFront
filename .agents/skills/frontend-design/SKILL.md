---
name: frontend-design
description: >-
  Expert guidelines and design patterns for modern React 19, Next.js 16, Material UI 9,
  and Tailwind CSS 4. Use when building UI components, responsive layouts, design tokens,
  and ensuring accessibility (a11y) and touch-friendly controls.
---

# Frontend Design & UI System Guidelines

This skill defines the visual architecture, component reuse conventions, and responsive design principles for high-quality frontend development.

## 1. Mobile-First Responsiveness (Mandatory)

Every component must be built mobile-first (`xs: ~360px` first, then progressive breakpoint overrides for `sm: 600px`, `md: 900px`, `lg: 1200px`).

### Rules:

1. **Object Syntax over Fixed Units**: Always use MUI sx breakpoint objects (e.g. `direction={{ xs: 'column', sm: 'row' }}`, `fontSize: { xs: '0.875rem', md: '1.125rem' }`). Never hardcode fixed desktop widths.
2. **Horizontal Overflow Prevention**:
   - Flex containers must wrap or reflow cleanly (`useFlexGap`, `flexWrap: 'wrap'`).
   - Flex children that contain text truncation must use `minWidth: 0` along with `textOverflow: 'ellipsis'`.
3. **Touch-Friendly Controls**: Interactive elements (buttons, icon buttons, tabs, chips) must have minimum `44x44px` touch targets.
4. **Double-Viewport Verification**: Test every visual change at small mobile (`~360px-390px`) and standard desktop (`1280px`).

## 2. Design Tokens & Theme Palette

Avoid hardcoding raw hex values (`#0D2B5C`, `#F97316`, etc.) in components. Always use theme palette keys:

- `primary`: Navy theme token (`primary.main`, `primary.dark`, `primary.light`)
- `mission`: Orange action token (`mission.main`, `mission.dark`, `mission.light`)
- `supporter`: Neutral accent token (`supporter.main`, `supporter.light`)
- `background`: (`background.default`, `background.paper`)
- `divider`, `text.primary`, `text.secondary`

## 3. UI Component Reuse Hierarchy

Before creating new components, always check existing atoms:

- `PillButton` (`src/components/common/PillButton.tsx`): Primary CTA, action buttons, link buttons. Use standard tones (`primaryFilled`, `missionFilled`, `primarySoftOutline`, `cta`, `ghost`). Shared corner is `BUTTON_BORDER_RADIUS` (`10px`) — never a stadium pill or a per-call `borderRadius` override.
- `PhoneField` (`src/components/common/PhoneField.tsx`): International phone inputs with country code selector.
- `StyledTextArea` (`src/components/common/StyledTextArea.tsx`): Multiline profile-edit fields. Keep `RichTextEditor` for posts only.
- `Logo` (`src/components/common/Logo.tsx`): Responsive brand mark (`sm`, `md`, `lg`, `xl`).
- `SectionHeader` (`src/components/common/SectionHeader.tsx`): Section title and subtitle.
- `PageNavbar` / `VisitorNavbar`: Navigation headers.

## 4. Accessibility (A11y)

- All interactive icon-only buttons MUST include an explicit `aria-label` (e.g., `aria-label="Alterar foto de perfil"`).
- Dynamic menus and popovers must have `aria-haspopup="true"` and `aria-expanded`.
- Form inputs must be associated with `<Typography component="label" htmlFor="...">` or MUI `<InputLabel>`.
- Color-blind users (daltonism): never use color as the only status/error cue — pair with text or an icon (WCAG 1.4.1).
