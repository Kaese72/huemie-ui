# Humi design: the Appliance UI

How the Appliance UI (this repo) should look, in dark and light mode. It is
the companion to the cloud guide, **[`cloud-ui/DESIGN.md`](../cloud-ui/DESIGN.md)**,
which holds the shared foundation. Both UIs are one product and must look like
it.

Where things live in this repo:

| File | What |
|---|---|
| `src/theme.css`, `src/ui.css` | Copied unchanged from cloud-ui (tokens, shared classes) |
| `src/appliance.css` | Appliance-only classes: list pages, detail panes, tabs, data tables, values, status pages |
| `src/components/AppTopBar.vue` | The desktop top bar (sections, More menu, theme toggle, user chip, log out) |
| `src/components/BrandMark.vue`, `ThemeToggle.vue`, `UserChip.vue` | Copied unchanged from cloud-ui |
| `src/composables/useTheme.js` | Copied unchanged from cloud-ui |
| `src/composables/useCurrentUser.js` | Appliance version (same interface as cloud-ui's), feeds `UserChip` |
| `src/App.vue` | The layouts (section 3) |

## 0. How the two guides fit together

| Topic | Where it is defined |
|---|---|
| Idea, colour meanings, colour tokens, light/dark values | Cloud guide, sections 1–2 |
| Theme switching (toggle, `localStorage`, time-of-day default) | Cloud guide, section 2 "Theme switching" |
| Typography, shape, buttons, badges, icons, house mark | Cloud guide, sections 3–5 |
| Motion: easings, durations, reduced motion | Cloud guide, section 6 |
| Shared app classes (`.btn`, `.panel`, `.input`, `.badge`, `.alert`, `.dialog`, `.auth-card`, …) | Cloud guide, section 8, and `cloud-ui/src/ui.css` |
| What is specific to the Appliance: dense tables, detail panes, device control, rules, AI chat, mobile view | **This guide** |

Rules for keeping them aligned:

1. **The cloud-ui is the source of truth for the shared files.** Copy these
   files into this repo unchanged:
   - `src/theme.css`
   - `src/ui.css`
   - `src/composables/useTheme.js`
   - the inline theme script in `index.html`
   - `ThemeToggle.vue`
   - `BrandMark.vue`
   - `UserChip.vue`

   To change one, change it in cloud-ui first, then copy it across. Never
   change a copy only here.
2. **Appliance-only styles go in `src/appliance.css`**: tables, detail
   panes, control cards, rule blocks and chat. They are built only from
   tokens in `theme.css`, so a new theme value reaches both UIs.
3. **A new token or a new meaning goes into the cloud guide first.**
   Nothing gets a colour that the cloud guide doesn't define. If the
   Appliance needs something new, such as a new status colour, add it to
   the cloud guide, then use it here.
4. Run the cloud checklist (cloud guide, section 9) on every Appliance
   screen too, then the extra items in section 9 below.

The theme rules are the same as in the cloud:
- The sun/moon toggle is always reachable.
- A manual choice is saved in `localStorage` under `humi-theme`.
- With no saved choice, it is light from 07:00 to 19:00 and dark otherwise.

The Appliance runs on its own hostname, so it keeps its own saved choice,
separate from the cloud's.

## 1. Idea: the lit house, from the inside

The cloud's landing page shows the house from the outside. The Appliance UI
is the **inside of the house**: the same night, the same warm light, but a
place where you get things done. Compared with the cloud:

- **Denser and calmer.** People come here to look at and act on many
  devices, rules and users. Tables and lists come first, and decoration
  comes second. There are no scroll scenes, no fireflies and no shimmer,
  except the "Humi" wordmark on the login card.
- **Warm is at home here.** The whole UI is "home", so amber is not the
  thing that makes a screen special. Use it for **things that are on** and
  for **commands you send to devices**, as the cloud guide says
  (outbound = amber, inbound = green).
- **The Cloud is a guest.** Anything Cloud-related (Cloud Connect, "Log in
  with Humi Cloud", cloud-linked users) uses the Cloud styling: blue,
  dashed and secondary. Nothing else is blue. In particular, selection,
  links and focus are **not** blue (the old UI used blue for those).

## 2. Colour meanings in Appliance terms

Tokens and values come from `theme.css` (cloud guide, section 2). This
table maps them onto Appliance concepts.

| Meaning | Token | In the Appliance |
|---|---|---|
| On / lit / outbound command | `--warm`, `--warm-ink` | Device or group "on" state, brightness/colour values that are on, the capability trigger button, rule **actions** |
| Live / connected / OK / inbound | `--green`, `--green-ink` | Adapter connected, boolean `true`, AI agent idle, rule **conditions** that currently match, focus ring, selected row |
| Cloud / optional | `--cloud`, `--cloud-ink` (dashed) | Cloud Connect page and status, "Log in with Humi Cloud", cloud-linked user badge |
| Danger | `--danger`, `--danger-ink` | Delete, Revoke, Stop, Forget conversation, errors, failed tool calls |
| Neutral | `--text`, `--muted`, `--faint`, `--ink` tints | Everything else: off devices, `false`, unknown/N/A, AND/OR logic, pagination |

Specific replacements for the old palette:

| Old | New |
|---|---|
| `#42b983` buttons and active nav | `.btn-primary` (theme-dependent), active nav = `--text` on an `--ink` 7% pill |
| `#1890ff` / `#e6f7ff` selection, sort/filter highlight | `--green` (bar/border) and `color-mix(--green 10%)` (fill) |
| `#1565c0` links, segmented control, AND | Links `--green-ink`. Segments: active = `--text` on `--ink` 10%. AND: neutral (section 6) |
| `#6a1b9a` OR | Neutral (section 6) |
| `#52c41a` / `#c9c9c9` bool circle | `--green` with a `--surface` tick / `--track` |
| `#e65100` Stop / in-progress | Stop = danger ghost. In progress = `.badge-warm` with a pulsing dot |
| `#c62828`, `#c0392b`, `#e53935`, `#fdecea`, … | `--danger-ink` and `.alert-error` |
| `#fff` / `#ddd` / `#f5f5f5` surfaces and borders | `--surface`, hairline `--ink` 6–8%, fill `--ink` 4% |

## 3. Layouts

| Layout | Routes | Chrome |
|---|---|---|
| auth | `/login`, `/setup`, `/cloud-login/callback` | Same as the cloud's auth layout: slim header with `BrandMark` and `ThemeToggle`, and one centred `.auth-card` |
| app (desktop) | everything else signed in | `AppTopBar`, built like the cloud's (cloud guide, section 8). Sections: Home, Devices, Groups, Rules, AI Control, then a **More** menu with Adapters, Users and Cloud Connect. Right side: `ThemeToggle`, `UserChip` (→ own user), log out |
| app (mobile) | `/mobile/*` | Mobile bar (section 7) |

- **Height:** below the 64px top bar, the content fills the rest of the
  viewport, because tables size their page from the available height. Use
  `height: calc(100vh - 64px)` on the main area. Don't let the page scroll.
- **Content width:** list pages use the full width, with `24px` side
  padding. Forms and settings pages (AI Control settings, Cloud Connect,
  Setup) use `.page` / `.page-narrow` from `ui.css`.
- **Nav look:** links are the same text pills as the cloud's, with no
  emoji. If an icon is needed, use the cloud's stroke icon style
  (24×24, `stroke-width 1.6`, round caps).
- **AI Control's sub-pages** (Chat, Settings) are tabs at the top of the
  AI Control page, not a sub-menu in the nav.
- **"Switch to mobile view"** is an entry in the More menu.
- **Page heading block:** a `.page-title` (short noun) and, where helpful,
  a `.page-lede`. Use them on list pages and on narrow pages alike. On list
  pages the primary action ("New rule", "Add user") sits on the heading
  row, on the right.

## 4. Tables (`TableShell`, `TableHeaderCell`)

Tables are where people spend most of their time here. Keep them quiet so
the values stand out.

- **Container:** a `.panel` with no inner padding and `overflow: hidden`,
  radius `20px`. The table fills it.
- **Header row:** `40px` (`HEADER_HEIGHT_PX`). Uppercase, `0.72rem`, weight
  700, letter-spacing `0.12em`, `--faint`. Background `--ink` at 3%.
  Hairline bottom border.
- **Rows:** `40px` (`ROW_HEIGHT_PX`; keep it in sync with
  `tableLayout.js`). Text is `0.9rem` `--text`, with secondary cells in
  `--muted`.
  - Rows are divided by hairlines (`--ink` 6%), with no zebra stripes.
  - Hover: `--ink` 4% fill.
- **Selected row** (detail open): `color-mix(--green 10%)` fill and a `3px`
  `--green` bar on the left edge (an inset box-shadow, so layout doesn't
  move).
- **Sorting and filtering:** an active sort or filter shows as a small
  `--green-ink` icon next to the header label.
  - The header dialog is a `.dialog`-styled popover: `--surface`, radius
    `16px`, depth shadow, hairline border, no backdrop.
  - Its controls are `.input` and `.btn-sm`.
  - The "applying… / applied" state uses `.hint` text.
- **Pagination footer:** `40px`. Page buttons are round `32px`. The current
  page is `--text` on `--ink` 10%, and the others are `--muted`. First and
  last use chevron stroke icons.
- **Cell content:**
  - **Booleans:** `BoolBadge`. True is a filled `--green` circle with a
    tick; false is a `--track` circle with no tick.
  - **Unknown or missing values:** `N/A` in `--faint`.
  - **Status:** `.badge` with the colour from section 2.
  - **IDs, hostnames and raw JSON:** monospace (`ui-monospace,
    SFMono-Regular, Menlo, Consolas, monospace`), `0.85rem`, `--muted`.
  - **Row actions:** `.btn-sm` ghost buttons, or danger buttons for
    destructive ones. They are always visible; don't reveal them only on
    hover.
- **Empty or loading:** a centred `.empty` line inside the panel
  ("No devices yet.", "Loading…").

## 5. Detail panes (`DetailOverlay`)

- The pane floats over the right `50%` (`DETAIL_OVERLAY_WIDTH`) of the
  table area.
  - Background `--surface`, with a hairline left border.
  - Depth shadow pointing left:
    `-12px 0 40px color-mix(in srgb, var(--shadow-ink) 35%, transparent)`.
  - Radius `20px 0 0 20px`.
- It enters from the right: `translateX(24px)` plus a fade, `0.35s`, with
  the default "out" easing.
- **Header:** the item name as a `1.4rem`/700 title, an id/type line in
  `--muted` monospace, and a close button (round, ghost, ✕ stroke icon) at
  the top right.
- **Tabs** (State / Capabilities / …): pill tabs. Active is `--text` on
  `--ink` 7%, and the others are `--muted`. They are the same as the nav
  links.
- **Content sections:** `.panel-subtitle` headings and `.details` key/value
  lists.
  - Attribute values use the cell rules from section 4.
  - Device state that is on, such as a lit bulb or brightness > 0, gets a
    small `--warm` dot with a soft glow next to its value. Off has no dot.
- **Capabilities:** each capability is a round ghost button, with the
  capability's name in sentence case.
  - It opens `CapabilityDialog`, a `.dialog` with `.field`s for the
    arguments.
  - The dialog's primary action is **Send**, styled as `.btn-primary`.
    Sending a command is the one place a warm accent leads the screen.

## 6. Rules (`RuleDetail`, `ConditionNode`)

A rule reads as a sentence: **when** the conditions hold, **do** the
actions.

- **Condition blocks:** small panels, radius `16px`, with a hairline
  border.
  - A condition that currently matches gets a `--green` left bar and a
    green "Matching" `.badge`.
  - Cooldowns show as `.badge-neutral` ("Cooldown 30 s").
- **AND / OR:** the logic itself is neutral. It doesn't use accents.
  - **AND:** conditions stack inside one shared container with a solid
    `--ink` 10% border, and an `AND` label chip (uppercase badge style,
    `--muted` text, `--ink` 7% fill) sits on the joins.
  - **OR:** groups are separated by a full-width divider line with an `OR`
    chip in the middle, the same chip as AND but outlined (no fill).
  - Don't use blue or purple, and never use a dashed line (dashed means
    Cloud).
- **Drag and drop:** while dragging, the drop zones show as solid `2px`
  outlines in `--ink` 12%, radius 12.
  - The zone under the pointer turns `--green` with a 10% tint.
  - The swap/AND/OR zone buttons use the same neutral chip style with the
    `∧` / `∨` symbol, and turn green on hover.
- **Actions:** each action row starts with an outbound arrow icon in
  `--warm`, matching outbound = amber.

## 7. Mobile view (`/mobile/*`)

The mobile view is a remote control: big targets and few words.

- **Mobile bar:** the glass top bar (as in the cloud: `--bg` 70% plus blur
  and a hairline).
  - Left: a back button (round, ghost, chevron stroke icon) or, on the
    mobile home page, `BrandMark`.
  - Centre: the title, `1.1rem`/700.
  - Right: `ThemeToggle`.
  - Height `56px`, side padding `16px`.
- **Category cards** (mobile home): `.panel`s in a two-column grid, each
  with a stroke icon in a `44px` disc (`--surface-2`) and a label. No
  emoji.
- **Device / group rows:** full-width `.row`s, `56px` minimum height, with
  the on/off state as a `--warm` glowing dot or a `--track` dot.
- **Capability cards:** full-width ghost cards, radius `20px`, padding
  `20px`, weight 600.
  - Pressing one shows the `--warm` tint and border briefly (`0.2s`), so
    "command sent" is lit.
  - Errors use `.alert-error`, not plain red text.
- All tap targets are at least `44px`.

## 8. AI Control (chat)

- The **message list** is centred, max width `760px`, gap `12px`.
- **User bubble:** right-aligned, `color-mix(--warm 14%)` fill, `--text`.
  Radius `20px 20px 6px 20px`.
- **Agent bubble:** left-aligned, `--surface` with a hairline border.
  Radius `20px 20px 20px 6px`.
  - "Thinking…" is an agent bubble with three breathing dots (`--muted`).
    The reduced-motion version is static.
- **Tool calls:** quiet one-line notes, no bubble.
  - `0.85rem` `--faint`, with a small stroke icon in front.
  - The expanded result is a monospace box, `--ink` 4% fill, radius
    `12px`.
  - Failed calls use `--danger-ink` and a `--danger` 25% border.
- **Agent errors:** an `.alert-error` in the flow.
- **System notes** ("Conversation stopped."): centred, `--faint`, uppercase
  kicker style.
- **Composer:** sticks to the bottom.
  - An `.input` textarea (radius `20px`) and a round **Send**
    `.btn-primary`.
  - While the agent works, Send is replaced by a **Stop** button, which is
    danger ghost.
- **Conversation status in the list:**
  - Idle is `.badge-green`.
  - In progress is `.badge-warm` with a pulsing dot.

## 9. Copy

- The product is **Humi**. "Huemie" in titles and headings, such as
  "Huemie" on the login card and "Welcome to Huemie UI", becomes "Humi".
  Code names (repos, packages) don't change.
- **Login card:** "Welcome home." with "Humi" as the gradient wordmark
  above it. The Cloud button text is "Log in with Humi Cloud", styled as a
  Cloud ghost button (dashed `--cloud` border, `--cloud-ink` text).
- **Titles and buttons:**
  - Page titles are short nouns: "Devices", "Rules", "AI Control".
  - Buttons are verbs in sentence case: "New rule", "Send", "Revoke".
- **Product names:** "Appliance" and "Humi Cloud" are capitalised as
  product names, the same as in the cloud.

## 10. Quick checklist (in addition to the cloud guide's section 9)

- [ ] Shared files (`theme.css`, `ui.css`, `useTheme.js`, the toggle,
      `BrandMark`) are unchanged copies from cloud-ui.
- [ ] The theme toggle is reachable on every layout, including mobile.
- [ ] No blue except for Cloud things. Selection and focus are green.
- [ ] Amber only for "on" and outbound commands. Green only for
      live/OK/inbound and selection.
- [ ] Rule logic (AND/OR) is neutral, and nothing uses a dashed line
      except Cloud.
- [ ] Table rows and headers stay `40px` (`tableLayout.js`).
- [ ] No emoji as icons. Use stroke icons in the cloud style.
- [ ] Dense, but still round: buttons, chips and badges are pills, and
      panels have a radius of 16–24px.
