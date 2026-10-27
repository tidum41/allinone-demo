# Interaction audit — All in One

Guided by Emil Kowalski’s design-engineering principles ([Great Animations](https://emilkowal.ski/ui/great-animations)): purposeful, fast (ease-out, &lt;300ms), interruptible (prefer transitions), accessible (`prefers-reduced-motion`), performant (`transform`/`opacity`), never from `scale(0)`, and no motion on high-frequency actions (typing, arrow-key nav).

## Shared tokens (source of truth)

| Token | Value | Role |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | Snappy UI enter / settle |
| `--ease-out-soft` | `cubic-bezier(0.2, 0, 0, 1)` | Soft layout (rail, accordion) |
| `--dur-fast` | `150ms` | Colour, opacity, press |
| `--dur-base` | `200ms` | Width morph, menu, rail |
| `--dur-slow` | `250ms` | Rare state changes |
| `--press-scale` | `0.97` | `:active` on pressable controls |
| `--focus-ring` | `2px solid var(--color-text-secondary)` | Consistent `:focus-visible` |
| `--focus-offset` | `2px` | Ring offset |
| `--transition-fast` | `var(--dur-fast) var(--ease-out)` | Back-compat alias |
| `--transition-normal` | `var(--dur-base) var(--ease-out)` | Back-compat alias |

Rules applied everywhere below:

- Hover paint only under `@media (hover: hover)`.
- Pressable chips/buttons get `:active { transform: scale(var(--press-scale)) }` (interruptible transition, not a keyframe).
- Menus/popovers enter at `opacity` + `scale(0.95)` with `transform-origin` from the trigger; never `scale(0)`.
- Keyboard / typing paths: no enter animation on focus move between menu items or while editing text.
- `prefers-reduced-motion: reduce` collapses motion to near-instant opacity-only where needed.

## Element table

| Element | Current hover / active / focus | Gap | Decision |
| --- | --- | --- | --- |
| Sidebar toggle | Colour darken on hover+active; no scale; focus-visible elsewhere inconsistently | No press scale; hover fires on touch | **Add** hover-only colour + `:active` scale 0.97 + shared focus ring |
| Title (static) | None | — | **None** — not interactive |
| Aa format toggle | Colour hover; format popover `scale(0.95)` ✓ | Active merged with hover; no press scale on trigger | **Add** press scale; keep popover enter; gate hover |
| Undo | Colour hover | Same as icons | **Add** press scale + focus ring + hover gate |
| Bullet / checklist icons | Colour hover | Same | **Add** press scale + focus ring + hover gate |
| Categories pill | Bg on hover; inset when open | No press scale; hover on touch | **Add** press scale; keep pressed/open; hover gate |
| Sort | Opacity hover; scale 0.93 active; labelIn from 0.8 | Active scale slightly aggressive; labelIn below 0.95 | **Tune** active → 0.97; labelIn from 0.95; use tokens |
| Blob checkbox (square) | Hover is no-op; no focus ring; no tick draw on toggle | Weak affordance | **Add** hover border (hover:hover); focus ring; fast tick draw on check; press scale |
| Task checkbox | Completing: bounce + tick path (good purpose) | Rest hover weak; focus missing | **Add** rest hover/focus/press; **keep** completion path draw, tighten to ~200ms ease-out |
| Task row | Drag/select only; enter `taskIn` | No hover chrome (correct — row is a drop target) | **None** for hover chrome — selection/drag already communicate; keep short enter |
| Task text edit | None on type | — | **None** — high-frequency typing must not animate |
| Urgency badge (filled) | Inset shadow hover/expanded; width morph; chevron | Hover not gated; press scale missing | **Add** hover gate + press scale; **keep** morph/crossfade/menu |
| Urgency empty `+` | Opacity reveal on row hover | Fine; add press | **Add** press scale when visible; hover gate |
| Urgency / ••• PopoverMenu | fade opacity only; no origin | Should match Emil enter (0.95+opacity) + origin from trigger | **Add** scale 0.95→1 + opacity, `transform-origin` from anchor, tokens; item hover gated; **no** anim on arrow-key focus |
| Category header + chevron | Opacity 0.75/0.55; chevron rotate | Opacity dims the whole label (muddy) | **Change** hover → colour only (no whole-header opacity); keep chevron rotate with tokens; light press scale |
| Edit categories link | None | Missing hover/focus/press | **Add** colour hover (gated), focus ring, press opacity |
| Category rail close × | Bg hover | No press scale | **Add** press scale + hover gate |
| Category rail row | Bg hover | OK for list rows; no scale (rows aren’t chips) | **Keep** bg hover (gated); **no** scale — row hit target |
| Category ••• trigger | Bg + colour when hover/expanded | No press scale | **Add** press scale + hover gate |
| Menu items (Edit/Delete/urgency) | Bg hover | Hover on touch; focus ok | **Add** hover gate; focus-visible = same bg; **no** enter anim per-item |
| + Add category | Colour hover | No press feedback | **Add** press opacity/scale subtle + hover gate |
| Swipe delete | Instant reveal | Gesture-driven | **None** extra — finger motion is the feedback |
| Delete confirm | Static dialog | Enter could help once | **Add** short opacity+0.95 scale on confirm card only |
| Undo toast | toastIn translateY | Good purpose; tune easing | **Tune** to ease-out + tokens; press on Undo |
| Sheet grabber / detents | Height follows drag | Already interruptible | **Keep**; reduced-motion → snap without lag |
| Categories rail slide | 200ms ease-out width+transform | Already on-principle | **Keep**; map to `--dur-base` / `--ease-out` |
| Agentation FAB | Third-party | Out of product chrome | **None** — don’t restyle vendor FAB; only hide when categories open |
| Summary / note editor controls | Mixed | Same chip rules | **Align** icon buttons to shared press/focus tokens where touched by this pass |

## Purposeful “no motion” list

- Caret / text input while typing  
- Arrow-key movement across menu items (focus only)  
- Checkbox uncheck (instant clear — check-on gets the draw)  
- Swipe distance itself (physics from touch)  
- Agentation FAB internals  

## Implementation notes

1. Define tokens once in `tokens.css`; alias legacy `--transition-*`.  
2. Prefer CSS `transition` on `transform`/`opacity` over one-shot keyframes so Esc/re-click can interrupt.  
3. `@media (hover: hover) { …:hover }` for paint hovers; keep `:focus-visible` and `:active` outside that query.  
4. Menu `transform-origin`: `top right` when aligned to badge/••• end and opening downward; flip to `bottom right` when flipped up.  
