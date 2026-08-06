## Summary
Readability and mobile UX improvements across the blog.

### Typography & readability
- Body: `line-height: 1.78`, `max-width: 66ch`, `font-size: clamp(1.05rem, 1.1vw, 1.1rem)`
- Post reader: `max-width: 720px` (was 760px)
- Lists: tighter spacing (`li + li { margin-top: .45em }`), proper `padding-inline-start`
- Blockquotes: accent left border, muted text
- Focus-visible: 3px accent outline with 3px offset

### Mobile (≤560px)
- 16px base input font (prevents iOS zoom)
- 44px min-height touch targets: nav links, theme toggle, source-picker labels, action buttons, filetree items
- 32px side gutters (was 22px)
- Source picker: single-column stack, 44px labels, 44px group actions
- Query mode picker: 44px labels
- News shell: 32px gutters + 30px top padding

### Provider-neutral copy
- "Latest note" → "Latest research note"
- "Gemma 4 expand" → "AI-assisted expansion"
- blog-lab.mjs: model label shows provider name or "AI-assisted"/"local fallback"

### Tests
- CSS budget: 41,800 → 43,000 bytes
- Browser E2E: mobile touch-target height ≥44px, input font-size ≥16px, post body font-size ≥17px, line-height ≥29.5px
- All unit/lint/contract/browser tests pass