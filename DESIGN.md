# Design System Specification: The Nocturnal Editor (Impeccable)

## 1. Overview & Creative North Star

This design system is built to provide a **premium, editorial, and high-contrast dark theme** experience for the VietTruyen application. We call this the **Nocturnal Editor** (utilizing the "Impeccable" design standards).

Our goal is to eliminate generic AI-generated design patterns—such as nested cards, heavy borders, and standard chat bubbles—in favor of an intentional, editorial, and sophisticated aesthetic. The interface acts as a quiet, authoritative canvas that focuses entirely on the creative writing process, with AI tools integrated seamlessly rather than disruptively.

## 2. Colors & Surface Philosophy

The palette moves away from standard grays and pure blacks, instead using deep, warm ink-blacks and rich ambient accents to create depth.

### Surface Hierarchy & Nesting
We treat the UI as a physical stack built out of dark ink and subtle glass.
*   **Base Background:** `bg-deep` (`#120f0d`) – The deepest void, used for the main app background.
*   **Low Surface:** `surface-container-lowest` (`#15110e`) / `surface-container-low` (`#1c1713`) – Used for sidebars and secondary navigational areas.
*   **Primary Focus:** `bg-surface` (`#1a1512`) / `bg-elevated` (`#241c17`) – Used for active content areas, cards, and the main writing canvas.
*   **Elevated Elements:** `surface-container-high` (`#2c2420`) / `surface-container-highest` (`#362d28`) – Used for hovering panels, dropdowns, and highlighted interactive zones.

### Accents & Typography Colors
*   **Primary (Warm Amber):** `primary` / `accent-amber` (`#f0c59a`) – Used for primary actions, active highlights, and the creative "spark."
*   **Secondary (Teal):** `secondary` / `accent-teal` (`#2dd4bf`) – Used for success states, tags, and secondary conceptual highlights.
*   **Tertiary (Rose):** `tertiary` / `accent-rose` (`#e8708a`) – Used for warnings, destructive actions, or special literary interactions.
*   **Text:** 
    *   `text-primary` (`#fff6ef`): Primary readability.
    *   `text-secondary` (`#c8beb0`): Metadata and secondary information.
    *   `text-muted` (`#8f7f73`): Disabled states, subtle hints, and borders.

## 3. Typography: Editorial Authority

We pair a modern sans-serif for the interface with a sophisticated serif for the act of creation, enforcing a clear distinction between the "tool" and the "art."

*   **UI Framework (Manrope):** `font-sans`, `font-display`, `font-label`. Manrope is used for all navigation, buttons, labels, and system status. It is clean, modern, and geometrically precise.
*   **The Manuscript (Newsreader):** `font-script`. Used for all story content, reading modes, and generative AI prose. The high x-height and elegant serifs turn the digital screen into a literary artifact.

## 4. Elevation, Depth & Borders

Hierarchy is established through subtle tonal shifts, ambient shadows, and extremely delicate borders.

*   **Borders:** Standard rigid borders are minimized. When used, they employ highly transparent white layers: `border-subtle` (`rgba(255,255,255,0.08)`) and `border-default` (`rgba(255,255,255,0.12)`).
*   **Shadows:** We use wide, diffused ambient shadows rather than harsh drop shadows.
    *   `shadow-card`: `0 2px 12px rgba(0, 0, 0, 0.30)` (Resting state).
    *   `shadow-ambient`: `0 4px 24px rgba(0, 0, 0, 0.40)` (Hover/Active state).
*   **Transitions:** We rely on custom cubic-bezier curves (e.g., `editorial: cubic-bezier(0.2, 0, 0, 1)`) for buttery, deliberate architectural motion.

## 5. Core Components

### Cards (`.card`, `.card-interactive`)
*   **Background:** `#1c1713` with `rounded-2xl` and a `1.5px` subtle border (`rgba(255,255,255,0.10)`).
*   **Interaction:** Interactive cards lift on hover (`translateY(-2px)`) and increase their shadow to `shadow-ambient`.

### Inputs & Textareas (`.input-base`, `.textarea-base`)
*   **Style:** Seamless inline areas using `bg-surface-container` with an inset shadow acting as a subtle border.
*   **Focus State:** On focus, the inset shadow transitions to the `primary` color (`#f0c59a`), creating a glowing field effect without shifting the layout geometry.

### Buttons (`.btn`)
*   **`.btn-primary`:** Solid `primary` background (`#f0c59a`) with dark text (`#1b140f`). Lifts and gains an ambient shadow on hover.
*   **`.btn-secondary`:** Subtle surface background with an outline variant border.
*   **`.btn-ghost`:** Transparent background, `primary` text. Soft background highlight on hover.

### Tags (`.tag-chip`)
*   **Style:** Pill-shaped, subtle semi-transparent background with muted text.
*   **Interaction:** On hover, the border takes on the `secondary` (Teal) color, and the text becomes primary.
*   **Active:** Solid `secondary` background with deep dark text, accompanied by a subtle teal glow.

### AI Suggestion Hub (`.ai-bubble`, `.ai-result-box`)
*   **Style:** Rejects traditional chat-bubbles. Implemented as sophisticated `rounded-xl` panels that break out of the standard flow with an authoritative `shadow-card` and an `outline-default` boundary.

## 6. Do’s and Don’ts

### Do
*   **Do** use extreme whitespace. If a section feels disjointed, increase padding to let the elements breathe.
*   **Do** use `.tag-chip` and badges to classify metadata intelligently.
*   **Do** utilize slow, deliberate fade and slide animations (`animate-fade-in`, `animate-slide-in-up`) for AI-generated outputs so they feel like they are "arriving" rather than abruptly popping in.
*   **Do** separate "UI" from "Prose" aggressively through our typography system (Manrope vs. Newsreader).

### Don't
*   **Don't** use pure black (`#000000`) or pure white backgrounds. Everything must be tinted with the deep, warm amber-ink palette.
*   **Don't** use standard 1px fully opaque borders. Always use the predefined transparent rgba borders (`border-subtle`, `border-default`).
*   **Don't** stack "cards inside cards." Use background color tonal shifts (`bg-deep` -> `bg-surface` -> `bg-elevated`) to establish hierarchy instead of boxed borders.