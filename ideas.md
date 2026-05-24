# Series Calculator — Design Brainstorm

<response>
<probability>0.07</probability>
<idea>
**Design Movement:** Neo-Brutalist Academic

**Core Principles:**
- Raw structural honesty: visible borders, stark contrast, no decorative softness
- Mathematical rigor reflected in grid-locked, rule-based layout
- Ink-on-paper metaphor: dark type on cream/off-white, like a printed textbook
- Sections separated by thick horizontal rules, not cards or shadows

**Color Philosophy:**
- Background: warm off-white `#F5F0E8` (aged paper)
- Primary text: near-black `#1A1A1A`
- Accent: deep vermillion `#C0392B` for headings, section labels, and key formula highlights
- Secondary accent: slate blue `#2C3E6B` for step numbering and proof annotations
- No gradients; flat fills only

**Layout Paradigm:**
- Full-width two-column split: left 40% input panel (fixed), right 60% scrollable output
- Section headings use large serif numerals (01, 02, 03) as structural anchors
- Input fields styled as underline-only (no box borders) to mimic handwritten worksheets

**Signature Elements:**
- Thick 3px top border on every section card in vermillion
- Monospaced font for all math expressions before KaTeX renders them
- Section labels in small-caps with letter-spacing

**Interaction Philosophy:**
- Buttons feel like rubber stamps: slight scale-down on press, no hover glow
- Copy button produces a brief "stamp" animation

**Animation:**
- Result panels slide in from bottom with 200ms ease-out
- Step-by-step proof items stagger in at 50ms intervals
- No looping animations; motion is purposeful and brief

**Typography System:**
- Display/headings: `Playfair Display` (serif, bold)
- Body/labels: `Source Serif 4` (readable serif)
- Math input/output: `JetBrains Mono` (monospace, for raw expressions)
- KaTeX for rendered math
</idea>
</response>

<response>
<probability>0.06</probability>
<idea>
**Design Movement:** Swiss International Typographic Style (Modernist Grid)

**Core Principles:**
- Mathematical clarity mirrored in typographic clarity
- Asymmetric grid with deliberate column offsets
- Information hierarchy through weight and size alone, no decorative elements
- White space as the primary organizational tool

**Color Philosophy:**
- Pure white background
- Black text
- Single accent: electric blue `#0057FF` used exclusively for interactive elements and formula boxes
- Proof steps use alternating `#F7F7F7` row backgrounds

**Layout Paradigm:**
- 12-column grid; input occupies columns 1–4, output occupies 5–12
- Section titles are left-aligned in a narrow column, content flows in the wider column to the right
- No card containers; sections are delineated by thin 1px rules and generous vertical spacing

**Signature Elements:**
- Large oversized section numbers in light-weight `#EEEEEE` as background watermarks
- Blue underline on active input fields that animates width from 0 to 100%
- Proof steps numbered with blue circular badges

**Interaction Philosophy:**
- Hover states shift text color to blue; no background changes
- Submit button is full-width, black fill, white text — like a print button

**Animation:**
- Proof steps reveal with a 40ms stagger, sliding up 8px from initial position
- Formula result fades in at 250ms

**Typography System:**
- Headings: `DM Sans` (geometric sans, bold)
- Body: `DM Sans` (regular weight)
- Math: KaTeX default (Computer Modern)
</idea>
</response>

<response>
<probability>0.08</probability>
<idea>
**Design Movement:** Dark Academic / Chalkboard

**Core Principles:**
- Deep slate/charcoal background evoking a lecture hall chalkboard
- Warm chalk-white and amber tones for all text and math
- Generous line-height and letter-spacing to mimic hand-written lecture notes
- Sections feel like notebook pages pinned to a board

**Color Philosophy:**
- Background: `#1E2433` (deep blue-slate)
- Card surfaces: `#252D3D`
- Primary text: `#E8DFC8` (warm chalk-white)
- Accent gold: `#D4A843` for headings and highlighted results
- Proof step numbers: `#6B9BD2` (soft blue)
- Borders: `rgba(255,255,255,0.08)` subtle glass-like

**Layout Paradigm:**
- Single centered column, max-width 860px, with wide left margin reserved for step annotations
- Cards have a slight inset shadow to appear as pinned paper
- Input section at top, proof section below, numeric evaluator at bottom — linear vertical scroll

**Signature Elements:**
- Dotted grid texture on card backgrounds (SVG pattern, very subtle)
- Gold left-border accent on formula result boxes
- Step numbers in a circular badge on the left margin

**Interaction Philosophy:**
- Inputs glow with a soft amber border on focus
- Calculate button pulses once on click to confirm
- Copy button shows a checkmark for 1.5s after copying

**Animation:**
- Cards fade in with `opacity 0→1` and `translateY 12px→0` at 220ms ease-out
- Proof steps stagger at 60ms each
- Smooth scroll to results section after calculation

**Typography System:**
- Headings: `Cormorant Garamond` (elegant serif, bold italic for section titles)
- Body/labels: `Inter` (clean sans for UI labels only)
- Math expressions: KaTeX with custom color overrides to match chalk-white
- Step annotations: `Lora` (readable serif)
</idea>
</response>

---

## Selected Design: **Dark Academic / Chalkboard** (Option 3)

This approach best reflects the academic context of mathematical induction and series proofs. The chalkboard metaphor is immediately recognizable to students and teachers, the warm amber highlights draw attention to key results, and the dark background reduces eye strain during extended study sessions.
