---
name: VibeChat
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d8'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#918fa1'
  outline-variant: '#464555'
  surface-tint: '#c3c0ff'
  primary: '#c3c0ff'
  on-primary: '#1d00a5'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#4d44e3'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#4edea3'
  on-tertiary: '#003824'
  tertiary-container: '#006e4b'
  on-tertiary-container: '#67f4b7'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
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

This design system delivers a focused, fluid, and low-fatigue workspace for high-velocity personal and team communication. The brand personality is electric yet disciplined—pairing the precision of technical developer tools with the expressive warmth of modern social communication. 

The aesthetic is a synthesis of **Modern Utilitarian** and **Subtle Glassmorphism**. Layouts prioritize typographic balance, dense spatial efficiency, and optical clarity across marathon messaging sessions. Surfaces rely on layered slate tones rather than harsh absolute blacks, paired with low-contrast luminous outlines, localized backdrop blurs, and vibrant energetic indicators that direct user attention without visual exhaustion.

## Colors

The color palette is built on a dark slate canvas engineered to prevent eye strain during sustained screen time.

- **Primary (`#4F46E5` - Electric Indigo):** Reserved for active interactive triggers, self-authored chat bubble backgrounds, primary call-to-actions, and focused navigation states.
- **Secondary (`#8B5CF6` - Vivid Violet):** Used sparingly for secondary callouts, thread replies, mention highlights (`@user`), and gradient accents.
- **Tertiary (`#10B981` - Emerald Signal):** Dedicated functional color for real-time presence, active voice channels, delivery confirmations, and positive states.
- **Neutral (`#0F172A` - Base Dark Slate):** Anchors the app background. Structural steps include `#1E293B` (Surface/Panels), `#334155` (Borders/Dividers), and text tiers spanning `#F8FAFC` (Primary Text), `#94A3B8` (Muted/Timestamps), and `#64748B` (Inactive/Placeholders).

## Typography

The type system blends the character and geometric presence of **Plus Jakarta Sans** for headers, room titles, and channel navigations with the legibility of **Inter** for real-time body copy, logs, metadata, and controls.

- **Scale & Rhythm:** Chat messages use `body-md` (14px/21px) by default for optimal scan density. Compact displays gracefully step down to `body-sm` (13px).
- **Metadata Clarity:** Message timestamps, read receipts, and status indicators strictly leverage `timestamp` or `label-sm` with tabular numbers (`font-variant-numeric: tabular-nums`) to prevent layout shifting during real-time dynamic updates.
- **Hierarchy:** Channel group titles and category headers use `label-sm` with uppercase transformation and tracking to provide structural distinction without visual heaviness.

## Layout & Spacing

The layout is built around a responsive 3-column structural architecture tailored for instant messaging ergonomics:

1. **Primary Navigation Bar (72px fixed):** Direct workspace, channel cluster, and user profile toggles.
2. **Conversations/Channel Drawer (288px fixed):** Direct message lists, pinned channels, search, and unread feeds.
3. **Active Chat Stage (Fluid flex):** The central conversation stream. Maximum readability container capped at `840px` within the center stream.
4. **Context / User Details Panel (320px contextual):** Collapsible drawer displaying user presence, media drawer, and thread views.

### Responsive Reflow Rules
- **Desktop (≥ 1280px):** Full 3-to-4 pane interface simultaneously visible.
- **Tablet (768px - 1279px):** Details panel collapses into an overlay slide-out. Conversations drawer remains visible alongside active chat stream.
- **Mobile (< 768px):** Single-pane view stack. Bottom tab navigation; selecting a conversation triggers a horizontal slide-in transition taking 100% viewport width.

## Elevation & Depth

Visual depth is achieved through layered tonal surfaces, micro-borders, and targeted glassmorphic blurs rather than diffuse muddy dropshadows.

- **Base Layer (L0 - Background):** `#0F172A` (Pure canvas ground).
- **Surface Layer (L1 - Drawers & Sidebars):** `#1E293B` at 95% opacity with an interior low-contrast border (`1px solid rgba(255, 255, 255, 0.06)`).
- **Elevated Floating Layer (L2 - Popovers, Toolbars, Menus):** Backdrop blur of `16px`, background color `rgba(30, 41, 59, 0.82)`, bordered by `rgba(255, 255, 255, 0.12)`. Shadow: `0 8px 32px -4px rgba(0, 0, 0, 0.45)`.
- **Chat Bubbles Elevation:**
  - *Incoming:* Subtle fill (`rgba(255, 255, 255, 0.05)`), hairline edge border (`rgba(255, 255, 255, 0.08)`), no shadow.
  - *Outgoing:* `#4F46E5` background, with a soft indigo atmospheric glow: `0 4px 14px 0 rgba(79, 70, 229, 0.35)`.

## Shapes

The geometric identity relies on softened, organic forms that differentiate conversational elements from structural application chrome.

- **Containers & Sidebars:** `rounded-lg` (0.75rem / 12px) to keep outer structural frames clean and stable.
- **Buttons, Inputs, & Pills:** Fully pill-rounded (`9999px`) or `rounded-xl` (1rem / 16px) for an accessible, touch-friendly tactile footprint.
- **Chat Bubbles:** 
  - Base body: `rounded-2xl` (1.25rem / 20px).
  - Directional Tail Notch: The anchor corner nearest the sender (bottom-right for self, bottom-left for incoming) collapses to `4px` radius, giving a directional conversational speech bubble silhouette.
- **Avatars:** Rounded squircle (`rounded-xl`) for server/workspace icons; complete circles (`rounded-full`) for human users to maintain visual distinction.

## Components

### 1. Buttons
- **Primary:** Background `#4F46E5`, text `#FFFFFF`, subtle inner glow. On hover, background shifts to `#4338CA` with scaling of 1.01.
- **Ghost/Icon:** Transparent background, text `#94A3B8`. Hover states apply `rgba(255, 255, 255, 0.08)` with text shifting to `#F8FAFC`.
- **Danger Action:** `rgba(239, 68, 68, 0.15)` fill with `#EF4444` border and label.

### 2. Chat Bubbles & Thread Anchors
- **Outgoing:** Primary Indigo background, crisp white typography (`#FFFFFF`), right-aligned. Corner radii: `1.25rem 1.25rem 0.25rem 1.25rem`. Metadata timestamp placed inline right in `rgba(255, 255, 255, 0.7)`.
- **Incoming:** Deep slate tint (`#1E293B`), `#F8FAFC` typography, left-aligned. Corner radii: `1.25rem 1.25rem 1.25rem 0.25rem`.
- **Consecutive Grouping:** Successive messages from the same sender collapse vertical gap to `2px` and strip the tail radius until the sequence completes.

### 3. Input Bar (Message Composer)
- Suspended island style floating above bottom viewport.
- Background: `rgba(30, 41, 59, 0.90)` with `backdrop-filter: blur(12px)`.
- Border: `1px solid rgba(255, 255, 255, 0.10)`. Focus within introduces a vibrant `#4F46E5` border accent.
- Integrated action accessories: Left-anchored media/attachment trigger, right-anchored emoji picker, audio voice note record button, and send arrow.

### 4. Status Indicators & Presence Pills
- **Online Badge:** 10px circular pill `#10B981` with a `2px` solid `#0F172A` masking ring, positioned at the bottom-right quadrant of user avatars.
- **Unread Counter Pill:** Pill-shaped (`rounded-full`), height `20px`, min-width `20px`, padding `0 6px`. Background `#8B5CF6`, bold white 11px numbers.

### 5. Avatar Clusters
- Overlapping stacked circles with negative margin (`-space-x-2`).
- Each avatar features a `2px` border matching the immediate panel background to maintain isolation.
- Tail indicator circle (`+N`) uses `#334155` background with `#94A3B8` text.

### 6. Lists & Channel Items
- Channel rows feature an interactive `#` prefix that changes from `#64748B` to `#8B5CF6` on hover.
- Selected channel state uses a subtle `rgba(79, 70, 229, 0.12)` background tint with a vertical `3px` active bar on the left edge.