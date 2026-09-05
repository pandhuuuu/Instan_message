---
name: Ultra-Clean Light Mode
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464555'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#005338'
  on-tertiary: '#ffffff'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-pure: '#ffffff'
  surface-subtle: '#f8fafc'
  surface-muted: '#f1f5f9'
  surface-active: '#e2e8f0'
  border-subtle: '#e2e8f0'
  border-strong: '#cbd5e1'
  text-primary: '#0f172a'
  text-secondary: '#334155'
  text-muted: '#64748b'
  text-inverse: '#ffffff'
  chat-bubble-inbound: '#f1f5f9'
  chat-bubble-outbound: '#4f46e5'
  signal-online: '#10b981'
  signal-danger: '#ef4444'
  signal-warning: '#f59e0b'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.005em
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
  timestamp:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  sidebar-compact: 4.5rem
  sidebar-default: 18rem
  chat-pane-min: 24rem
  details-pane: 20rem
  gutter-xs: 0.25rem
  gutter-sm: 0.5rem
  gutter-md: 1rem
  gutter-lg: 1.5rem
  gutter-xl: 2rem
  bubble-p-x: 1rem
  bubble-p-y: 0.625rem
---

## Brand & Style

This design system establishes an ultra-clean, high-efficiency conversational interface reimagined for bright daytime clarity and minimal cognitive strain. The brand voice balances technical discipline with fluid conversational warmth: purposeful, agile, and refreshingly light.

The design movement combines **Minimalist High-Contrast Utility** with **Subtle Structural Glassmorphism**. Layouts leverage crisp white canvases (`#FFFFFF`), cool slate and zinc secondary planes (`#F8FAFC`, `#F1F5F9`), laser-precise architectural borders (`#E2E8F0`), and rich dark slate typography (`#0F172A`, `#334155`). Vibrant electric indigo and violet accents (`#4F46E5`, `#6366F1`) energize key touchpoints, delivering crisp scannability and elevated optical depth without clutter.

## Colors

The color palette is engineered specifically for bright light-mode ergonomics, maximizing readability and contrast ratios across continuous multi-hour collaboration sessions.

- **Primary (`#4F46E5` / `#6366F1` - Electric Indigo):** Anchors primary call-to-actions, active workspace toggles, sent outgoing message bubbles, and focused input indicators.
- **Secondary (`#6366F1` - Vibrant Violet/Iris):** Drives secondary highlights, interactive tags, unread counter badges, and focused active-state indicators.
- **Tertiary (`#10B981` - Emerald Signal):** Reserved for real-time presence indicators, active audio signals, and verified delivery receipts.
- **Neutrals & Surfaces:**
  - `surface-pure` (`#FFFFFF`): Primary conversation canvas, cards, floating menus, and popovers.
  - `surface-subtle` (`#F8FAFC`): Base workspace background and pinned conversation rails.
  - `surface-muted` (`#F1F5F9`): Inbound message bubbles, inactive search bars, and sub-panels.
  - `border-subtle` (`#E2E8F0`): Hairline structural dividers and input outlines.
  - `text-primary` (`#0F172A`): Maximum-contrast headlines, message text, and names.
  - `text-secondary` (`#334155`): Channel categories, thread counts, and sub-labels.
  - `text-muted` (`#64748B`): Timestamps, inactive hints, and breadcrumbs.

## Typography

The type system blends the energetic geometric authority of **Plus Jakarta Sans** for structural chrome, user titles, and room headers with the high-density legibility of **Inter** for real-time messages and UI controls.

- **Conversation Stream:** Defaults to `body-md` (14px/21px) rendered in `#0F172A` for inbound messages and `#FFFFFF` on outbound indigo messages to achieve contrast ratios surpassing 9:1.
- **Tabular Timestamps:** `timestamp` styles enforce `font-variant-numeric: tabular-nums` to ensure numerical alignment down message streams without layout jumps.
- **Structural Channel Tags:** Category dividers and sidebar sections utilize `label-sm` transformed to uppercase with a tracking of `+0.02em` in `#64748B`.

## Layout & Spacing

The structural layout utilizes an adaptive multi-column fixed-and-fluid framework optimized for desktop ergonomics and fluid single-pane mobile flows.

### Architecture Layout
- **Global Rail (72px fixed):** Icon-only workspace switchers, notifications, and profile settings on `#F8FAFC`.
- **Channel / Chat List Pane (288px fixed):** Direct messages, unread filters, and pinned rooms on `#FFFFFF` with a crisp right border of `1px solid #E2E8F0`.
- **Primary Stage (Fluid flex):** The active message stream on `#FFFFFF` with max-width content flow restricted to `840px` for optimal reading eye tracking.
- **Context / Profile Drawer (320px fixed/overlay):** Collapsible right drawer for participant lists, shared media, and pinned threads.

### Responsive Breakpoints
- **Desktop (≥ 1280px):** 3 to 4 panels visible simultaneously.
- **Tablet (768px – 1279px):** Details drawer collapses to a right floating sheet; channel drawer and primary chat stage remain visible side-by-side.
- **Mobile (< 768px):** Single-pane model with horizontal slide transitions; bottom tab navigation persists on list views.

## Elevation & Depth

In this clean light mode, depth is articulated through crisp hairline borders (`#E2E8F0`) paired with subtle, low-opacity ambient shadows rather than heavy tonal fills.

- **Level 0 (Canvas Base):** `#F8FAFC` (App chrome background) and `#FFFFFF` (Conversation active pane). Zero shadow.
- **Level 1 (Structural Panels & Lists):** `#FFFFFF` with a `1px solid #E2E8F0` border separating panes.
- **Level 2 (Inbound Bubbles & Cards):** `#F1F5F9` surface with an ultra-subtle border `1px solid #E2E8F0` and no shadow to maintain a clean reading cadence.
- **Level 3 (Outbound Bubbles):** Solid `#4F46E5` with an ambient glow shadow: `0 4px 12px -2px rgba(79, 70, 229, 0.25)`.
- **Level 4 (Floating Modals, Flyouts, Popovers):** `#FFFFFF` with `1px solid #E2E8F0` and layered drop shadow: `0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.
- **Level 5 (Composer Bar):** Suspended floating pill with `backdrop-filter: blur(16px)`, background `rgba(255, 255, 255, 0.88)`, border `1px solid #E2E8F0`, and shadow `0 8px 24px -4px rgba(15, 23, 42, 0.06)`.

## Shapes

The design uses a polished, rounded geometric profile (`roundedness: 2`) that balances modern friendliness with professional software structure.

- **Structural Containers & Panels:** `rounded-lg` (0.75rem / 12px) to `rounded-xl` (1rem / 16px) for interior widgets, code snippets, and modal dialogue containers.
- **Action Buttons & Badges:** `rounded-full` (9999px) for status badges, tags, and circular icon controls; `rounded-lg` (0.5rem / 8px) for rectangular utility buttons.
- **Chat Bubbles:**
  - Base body: `rounded-2xl` (1.25rem / 20px).
  - Outbound tail: `1.25rem 1.25rem 0.25rem 1.25rem` (bottom-right anchored notch).
  - Inbound tail: `1.25rem 1.25rem 1.25rem 0.25rem` (bottom-left anchored notch).
  - Grouped consecutive messages flatten to uniform `rounded-xl` (0.75rem / 12px) radii with a 2px vertical gap.
- **Avatars:** User avatars are strictly circular (`rounded-full`); organizational or bot avatars use a squircle profile (`rounded-xl`).

## Components

### 1. Buttons
- **Primary:** Solid `#4F46E5` background, `#FFFFFF` text, `rounded-lg`. Hover state deepens to `#4338CA` with subtle elevation shadow `0 4px 12px rgba(79, 70, 229, 0.2)`. Focus: `2px ring` in `#6366F1` with 2px offset.
- **Secondary / Outline:** Background `#FFFFFF`, border `1px solid #E2E8F0`, text `#334155`. Hover state applies `#F8FAFC` surface with border shifting to `#CBD5E1`.
- **Ghost / Icon:** Transparent fill, `#64748B` icon stroke. On hover, fills with `#F1F5F9` and text shifts to `#0F172A`.

### 2. Chat Bubbles
- **Inbound:** Filled with `#F1F5F9`, bordered by `1px solid #E2E8F0`. Text is `#0F172A`. Metadata and delivery timestamp render in `#64748B` inline.
- **Outbound:** Filled with solid `#4F46E5`, crisp white text (`#FFFFFF`), shadow `0 4px 12px -2px rgba(79, 70, 229, 0.25)`. Metadata and read receipts render in `rgba(255, 255, 255, 0.75)`.
- **System / Event Divider:** Centered `label-sm` on a pill background (`#F1F5F9`) with `#64748B` text, flanked by horizontal hairline `#E2E8F0` divider rules.

### 3. Input Composer Bar
- Suspended island anchored 16px above bottom viewport edge.
- Background: `rgba(255, 255, 255, 0.92)` with `backdrop-filter: blur(12px)` and border `1px solid #E2E8F0`.
- Active focus state: Border shifts to `#4F46E5` with `0 0 0 3px rgba(79, 70, 229, 0.12)`.
- Accessories: Text inputs render in `#0F172A` with `#94A3B8` placeholder. Send action button uses compact `#4F46E5` circle icon.

### 4. High-Contrast Badges & Status Signals
- **Unread Count Pill:** High-contrast solid `#6366F1` background, `#FFFFFF` bold 11px text, min-width 20px, height 20px, `rounded-full`, padding `0 6px`.
- **Presence Badges:** 10px `#10B981` circular status dot with a `2px solid #FFFFFF` mask border, positioned on the bottom-right corner of user avatars.

### 5. Form Controls (Checkboxes, Switches, Radio)
- **Checkbox/Radio:** Inactive state features `1.5px solid #CBD5E1` on `#FFFFFF` ground. Checked state fills with `#4F46E5` and white check icon.
- **Switch:** Track is `#E2E8F0` when off, transitions to `#4F46E5` when toggled on; thumb is solid white with crisp drop shadow.

### 6. Lists & Channel Items
- Regular channel rows render `#64748B` hash icons and `#334155` titles.
- Hover state applies `#F8FAFC` background with `#0F172A` title.
- Selected state adopts `#F1F5F9` background with `#4F46E5` bold title and an active left vertical indicator pill (`3px` width in `#4F46E5`).