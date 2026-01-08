# Style Guide - Retirement Planning Application

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Border Radius](#border-radius)
6. [Shadows](#shadows)
7. [Responsive Breakpoints](#responsive-breakpoints)
8. [Animation & Transitions](#animation--transitions)
9. [Component Patterns](#component-patterns)
10. [Layout Patterns](#layout-patterns)
11. [Code Standards](#code-standards)
12. [Common Pitfalls](#common-pitfalls)
13. [Migration Plan](#migration-plan)

---

## Design Philosophy

### Core Principles

1. **Mobile-First Responsive Design**
   - All components designed for mobile screens first
   - Progressive enhancement for tablet and desktop
   - Touch-friendly interactions with 44x44px minimum tap targets

2. **Glass-Morphism for Premium Feel**
   - Semi-transparent backgrounds with backdrop blur
   - Creates depth and modern aesthetic
   - Used extensively in professional pages

3. **Gradient Backgrounds**
   - Purple gradients for professional/premium sections
   - Blue-purple gradients for primary actions
   - Creates visual hierarchy and brand identity

4. **Accessibility First**
   - WCAG AA color contrast compliance
   - Visible focus states on all interactive elements
   - Semantic HTML and proper ARIA labels
   - 16px minimum font size for inputs (prevents iOS zoom)

---

## Color System

### Primary Colors

| Color | Hex Code | Usage |
|-------|----------|-------|
| Primary Blue | `#4361ee` | Primary buttons, links, active states |
| Primary Blue Hover | `#3b50d9` | Hover state for primary blue |
| Primary Blue Dark | `#3730a3` | Pressed/active state |
| Secondary Purple | `#7c3aed` | Gradient accents, secondary actions |
| Secondary Purple Dark | `#764ba2` | Gradient endpoints |

**CSS Variables:**
```css
--primary-blue: #4361ee;
--primary-blue-hover: #3b50d9;
--primary-blue-dark: #3730a3;
--secondary-purple: #7c3aed;
--secondary-purple-dark: #764ba2;
```

### Semantic Colors

| Color | Hex Code | Usage |
|-------|----------|-------|
| Success Green | `#10b981` | Success messages, positive actions |
| Success Green Hover | `#059669` | Success button hover |
| Error Red | `#ef4444` | Error states, destructive actions |
| Error Red Dark | `#dc2626` | Error hover state |
| Warning Orange | `#f59e0b` | Warnings, cautions |
| Warning Orange Hover | `#d97706` | Warning hover state |

**CSS Variables:**
```css
--success-green: #10b981;
--success-green-hover: #059669;
--error-red: #ef4444;
--error-red-dark: #dc2626;
--warning-orange: #f59e0b;
--warning-orange-hover: #d97706;
```

### Neutral Colors

| Color | Hex Code | Usage |
|-------|----------|-------|
| Text Primary | `#1a1a2e`, `#1e293b` | Primary body text |
| Text Secondary | `#64748b`, `#475569` | Secondary information, labels |
| Text Tertiary | `#94a3b8` | Disabled text, placeholders |
| Text Disabled | `#cbd5e1` | Disabled states |
| Border Light | `#e2e8f0` | Subtle borders, dividers |
| Border Medium | `#cbd5e1` | Standard borders |
| Background White | `#ffffff` | Card backgrounds |
| Background Light | `#f8fafc` | Page backgrounds (light theme) |
| Background Gray | `#f5f7fa` | Alternate backgrounds |

**CSS Variables:**
```css
--text-primary: #1a1a2e;
--text-secondary: #64748b;
--text-tertiary: #94a3b8;
--text-disabled: #cbd5e1;
--border-light: #e2e8f0;
--border-medium: #cbd5e1;
--bg-white: #ffffff;
--bg-light: #f8fafc;
--bg-gray: #f5f7fa;
```

### Gradient Backgrounds

```css
/* Professional page background */
--gradient-professional: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Primary button gradient */
--gradient-button-primary: linear-gradient(135deg, #4361ee 0%, #7c3aed 100%);

/* Success message gradient */
--gradient-success: linear-gradient(135deg, #10b981 0%, #059669 100%);

/* AI/Premium feature gradient */
--gradient-ai: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
```

### Glass-Morphism

```css
/* Light glass effect */
--glass-light: rgba(255, 255, 255, 0.1);

/* Medium glass effect */
--glass-medium: rgba(255, 255, 255, 0.05);

/* Glass border */
--glass-border: rgba(255, 255, 255, 0.1);

/* Always pair with backdrop filter */
backdrop-filter: blur(10px);
```

**Example Usage:**
```css
.card-glass {
  background: var(--glass-light);
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(10px);
  border-radius: 12px;
}
```

---

## Typography

### Font Family

```css
--font-primary: system-ui, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-code: 'SF Mono', Monaco, monospace;
```

**Usage:**
- Body text: Use `--font-primary` (system fonts for best performance)
- Code snippets: Use `--font-code`

### Font Size Scale (Mobile-First)

#### Mobile (Default)

| Token | Size | px Equivalent | Usage |
|-------|------|---------------|-------|
| `--text-xs` | 0.7rem | 11.2px | Small labels, badges |
| `--text-sm` | 0.8rem | 12.8px | Secondary text, captions |
| `--text-base` | 0.85rem | 13.6px | Body text |
| `--text-md` | 0.95rem | 15.2px | Emphasis text |
| `--text-lg` | 1rem | 16px | Headings (H4, H5) |
| `--text-xl` | 1.1rem | 17.6px | Large headings (H3) |
| `--text-2xl` | 1.4rem | 22.4px | Page titles (H1, H2) |

#### Tablet/Desktop (768px+)

| Token | Size | px Equivalent | Usage |
|-------|------|---------------|-------|
| `--text-base-desktop` | 1rem | 16px | Body text |
| `--text-lg-desktop` | 1.1rem | 17.6px | Headings |
| `--text-xl-desktop` | 1.25rem | 20px | Large headings |
| `--text-2xl-desktop` | 1.75rem | 28px | Page titles |

**Example:**
```css
h1 {
  font-size: 1.4rem; /* Mobile */
}

@media (min-width: 768px) {
  h1 {
    font-size: 1.75rem; /* Desktop */
  }
}
```

### Font Weights

```css
--font-normal: 400;   /* Body text */
--font-medium: 500;   /* Emphasis */
--font-semibold: 600; /* Subheadings */
--font-bold: 700;     /* Headings, CTAs */
```

### Line Heights

```css
--leading-tight: 1.1;    /* Large headings */
--leading-snug: 1.4;     /* Compact body text */
--leading-normal: 1.5;   /* Standard body text */
--leading-relaxed: 1.6;  /* Spacious paragraphs */
```

**Usage Guide:**
- Headings (H1-H3): `line-height: 1.1` (tight)
- Body text: `line-height: 1.5` (normal)
- Marketing copy: `line-height: 1.6` (relaxed)

---

## Spacing System

### Base Unit

**8px Grid System** - All spacing uses multiples of 0.5rem (8px)

### Spacing Scale

| Token | Size | px Equivalent | Common Usage |
|-------|------|---------------|--------------|
| `--space-1` | 0.5rem | 8px | Small gaps, icon spacing |
| `--space-2` | 0.75rem | 12px | Button padding (vertical) |
| `--space-3` | 1rem | 16px | Standard gaps, input padding |
| `--space-4` | 1.25rem | 20px | Medium padding |
| `--space-5` | 1.5rem | 24px | Card padding, section gaps |
| `--space-6` | 2rem | 32px | Large padding, card padding (desktop) |
| `--space-8` | 2.5rem | 40px | Section padding |
| `--space-10` | 3rem | 48px | Container padding (desktop) |

### Usage Examples

**Gaps (flexbox/grid):**
```css
.card-grid {
  display: grid;
  gap: var(--space-5); /* 24px between cards */
}
```

**Padding:**
```css
/* Mobile */
.card {
  padding: var(--space-3); /* 16px */
}

/* Desktop */
@media (min-width: 768px) {
  .card {
    padding: var(--space-5); /* 24px */
  }
}
```

**Margins:**
```css
.section {
  margin-bottom: var(--space-6); /* 32px */
}
```

---

## Border Radius

### Consistent Scale

| Token | Size | Usage |
|-------|------|-------|
| `--radius-sm` | 4px | Small badges, chips |
| `--radius-md` | 8px | Buttons, inputs |
| `--radius-lg` | 12px | Standard cards |
| `--radius-xl` | 16px | Large cards, slides |
| `--radius-2xl` | 24px | Premium containers |
| `--radius-full` | 50% | Circular (avatars, pills) |

### Usage Guidelines

```css
/* Buttons and inputs */
.btn, .input {
  border-radius: var(--radius-md); /* 8px */
}

/* Cards */
.card {
  border-radius: var(--radius-lg); /* 12px */
}

/* Slides and large containers */
.slide {
  border-radius: var(--radius-xl); /* 16px */
}

/* Pill-shaped badges */
.badge-pill {
  border-radius: var(--radius-full); /* 50% */
}
```

---

## Shadows

### Shadow System

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.15);
--shadow-xl: 0 20px 60px rgba(0, 0, 0, 0.3);
--shadow-focus: 0 0 0 3px rgba(67, 97, 238, 0.1);
```

### Usage Guide

| Shadow | Usage |
|--------|-------|
| `--shadow-xs` | Minimal depth (subtle hover) |
| `--shadow-sm` | Standard cards, subtle elevation |
| `--shadow-md` | Buttons on hover, dropdowns |
| `--shadow-lg` | Modals, popovers |
| `--shadow-xl` | Slide containers, premium features |
| `--shadow-focus` | Focus states for accessibility |

**Example:**
```css
.card {
  box-shadow: var(--shadow-sm);
}

.card:hover {
  box-shadow: var(--shadow-md);
  transition: box-shadow 0.2s ease;
}

.input:focus {
  box-shadow: var(--shadow-focus);
}
```

---

## Responsive Breakpoints

### Three-Tier System

```css
/* Mobile-first approach (default styles are mobile) */

/* Tablet and up (768px and above) */
@media (min-width: 768px) {
  /* 2-column layouts, increased spacing */
}

/* Desktop and up (1280px and above) */
@media (min-width: 1280px) {
  /* 3-4 column layouts, max-width containers */
}

/* Ultra-mobile (optional, 480px and below) */
@media (max-width: 480px) {
  /* Reduce padding further if needed */
}
```

### Layout Changes by Breakpoint

| Feature | Mobile (< 768px) | Tablet (768px+) | Desktop (1280px+) |
|---------|------------------|-----------------|-------------------|
| Grid columns | 1 column | 2 columns | 3-4 columns |
| Font size | Base (13.6px) | +10-15% | +25% |
| Padding | 16px | 24px | 40px |
| Buttons | Full-width | Auto-width | Auto-width |
| Container max-width | 100% | 100% | 1200px |

### Component-Specific Breakpoints

**Grid Layouts:**
```css
.insight-grid {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 1rem;
}

@media (min-width: 768px) {
  .insight-grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1280px) {
  .insight-grid {
    grid-template-columns: repeat(4, 1fr); /* Desktop: 4 columns */
    gap: 1.5rem;
  }
}
```

**Typography:**
```css
h1 {
  font-size: 1.4rem; /* Mobile */
}

@media (min-width: 768px) {
  h1 {
    font-size: 1.75rem; /* Desktop */
  }
}
```

---

## Animation & Transitions

### Timing Functions

```css
--transition-fast: 0.2s ease;         /* Hover states, color changes */
--transition-base: 0.3s ease;         /* Standard transitions */
--transition-slow: 0.5s ease;         /* Progress bars, slides */
--transition-smooth: 0.5s ease-in-out; /* Smooth entrance/exit */
```

### Standard Keyframe Animations

#### Fade In
```css
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage */
.fade-in-element {
  animation: fadeIn 0.5s ease-in-out;
}
```

#### Slide In
```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Usage */
.slide-in-element {
  animation: slideIn 0.5s ease-out;
}
```

#### Scale In
```css
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Usage */
.scale-in-element {
  animation: scaleIn 0.3s ease;
}
```

#### Spin (Loading)
```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Usage */
.spinner {
  animation: spin 1s linear infinite;
}
```

### Transition Usage Guide

| Timing | Use Case | Example |
|--------|----------|---------|
| 0.2s | Hover effects, color changes | Button hover |
| 0.3s | Modal appear, dropdown | Modal fade in |
| 0.5s | Progress fills, slide changes | Progress bar |
| 0.5s ease-in-out | Smooth entrance/exit | Validation messages |

---

## Component Patterns

### Buttons

#### Primary Button

```css
.btn-primary {
  background: linear-gradient(135deg, #4361ee 0%, #7c3aed 100%);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(67, 97, 238, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
```

#### Secondary Button

```css
.btn-secondary {
  background: #f1f5f9;
  color: #1e293b;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 500;
  font-size: 1rem;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-secondary:hover {
  background: #e2e8f0;
}

.btn-secondary:active {
  background: #cbd5e1;
}
```

#### Danger Button

```css
.btn-danger {
  background: #ef4444;
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
}

.btn-danger:hover {
  background: #dc2626;
}
```

### Cards

#### Standard Card (Light Theme)

```css
.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  border: 1px solid #e2e8f0;
}
```

#### Glass Card (Professional Pages)

```css
.card-glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
}

/* On dark gradient backgrounds */
.card-glass-dark {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #4361ee; /* Blue accent */
  border-radius: 12px;
  padding: 2rem;
}
```

### Input Fields

#### Standard Input

```css
.input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 16px; /* Prevent iOS zoom */
  font-family: inherit;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  transition: border-color 0.2s ease;
  background: white;
}

.input:focus {
  outline: none;
  border-color: #4361ee;
  box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.1);
}

.input::placeholder {
  color: #94a3b8;
}

.input:disabled {
  background: #f5f7fa;
  cursor: not-allowed;
  opacity: 0.6;
}
```

#### Input with Error

```css
.input-error {
  border-color: #ef4444;
}

.input-error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
}
```

### Progress Bars

#### Standard Progress Bar

```css
.progress-container {
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #4361ee;
  border-radius: 4px;
  transition: width 0.5s ease;
}
```

#### Progress Bar with Percentage

```css
.progress-wrapper {
  width: 100%;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  font-size: 0.85rem;
  color: #64748b;
}

.progress-container {
  width: 100%;
  height: 12px;
  background: #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4361ee 0%, #7c3aed 100%);
  border-radius: 6px;
  transition: width 0.5s ease;
}
```

### Badges

```css
.badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-success {
  background: #d1fae5;
  color: #065f46;
}

.badge-warning {
  background: #fef3c7;
  color: #92400e;
}

.badge-error {
  background: #fee2e2;
  color: #991b1b;
}
```

---

## Layout Patterns

### Grid Systems

#### 4-Column Grid (Responsive)

```css
.grid-4 {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: 1 column */
  gap: 1rem;
}

@media (min-width: 768px) {
  .grid-4 {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
    gap: 1.5rem;
  }
}

@media (min-width: 1280px) {
  .grid-4 {
    grid-template-columns: repeat(4, 1fr); /* Desktop: 4 columns */
    gap: 1.5rem;
  }
}
```

#### 2-Column Split

```css
.grid-split {
  display: grid;
  grid-template-columns: 1fr; /* Mobile: single column */
  gap: 1.5rem;
}

@media (min-width: 768px) {
  .grid-split {
    grid-template-columns: 1fr 1fr; /* Tablet+: two columns */
    gap: 2rem;
  }
}
```

### Container Max-Width

```css
.container {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

@media (min-width: 768px) {
  .container {
    padding: 0 1.5rem;
  }
}

@media (min-width: 1280px) {
  .container {
    padding: 0 2rem;
  }
}
```

### Flexbox Patterns

#### Centered Content

```css
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### Space Between

```css
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

#### Vertical Stack

```css
.flex-stack {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
```

---

## Code Standards

### CSS Organization

#### File Structure

```
src/
├── index.css                 # Global styles, CSS resets, CSS variables
├── App.css                   # Main app (light theme)
├── SimpleApp.css             # Simple version page
├── ProfessionalApp.css       # Professional input flow
├── ProfessionalDiagnosis.css # Diagnosis slide presentation
└── ProfessionalScenario.css  # Scenario comparison page
```

#### CSS Variable Declaration (Future)

All CSS variables should be defined in `index.css` within `:root`:

```css
:root {
  /* Colors */
  --primary-blue: #4361ee;
  --success-green: #10b981;

  /* Spacing */
  --space-1: 0.5rem;
  --space-2: 0.75rem;

  /* Typography */
  --text-base: 0.85rem;
  --font-primary: system-ui, sans-serif;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);

  /* Transitions */
  --transition-fast: 0.2s ease;
}
```

### Class Naming Convention

#### Use Kebab-Case

✅ **Correct:**
```css
.card-header { }
.btn-primary { }
.input-group { }
```

❌ **Wrong:**
```css
.cardHeader { }   /* camelCase */
.btn_primary { }  /* snake_case */
.InputGroup { }   /* PascalCase */
```

#### Component Prefix

Use `.prof-` prefix for Professional pages to avoid conflicts:

```css
.prof-wizard { }
.prof-step-indicator { }
.prof-input-group { }
```

#### State Classes

```css
.active { }
.disabled { }
.loading { }
.error { }
.success { }
```

#### Modifier Classes (BEM-like)

```css
.card { }
.card--highlighted { }
.card--large { }

.btn { }
.btn--small { }
.btn--full-width { }
```

### CSS Rule Order

Follow this order for consistency:

1. **Positioning** - `position`, `top`, `right`, `bottom`, `left`, `z-index`
2. **Display & Box Model** - `display`, `flex`, `grid`, `width`, `height`, `padding`, `margin`
3. **Typography** - `font-family`, `font-size`, `font-weight`, `line-height`, `color`, `text-align`
4. **Visual** - `background`, `border`, `border-radius`, `box-shadow`, `opacity`
5. **Misc** - `cursor`, `transition`, `animation`, `transform`

**Example:**
```css
.card {
  /* Positioning */
  position: relative;
  z-index: 1;

  /* Display & Box Model */
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 1.5rem;
  margin-bottom: 1rem;

  /* Typography */
  font-size: 1rem;
  color: #1a1a2e;

  /* Visual */
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

  /* Misc */
  cursor: pointer;
  transition: all 0.2s ease;
}
```

### Mobile-First Approach

**Always write mobile styles first, then enhance for larger screens.**

❌ **Wrong (Desktop-First):**
```css
.card {
  padding: 2rem;
  font-size: 1.25rem;
}

@media (max-width: 768px) {
  .card {
    padding: 1rem;
    font-size: 1rem;
  }
}
```

✅ **Correct (Mobile-First):**
```css
.card {
  padding: 1rem;
  font-size: 1rem;
}

@media (min-width: 768px) {
  .card {
    padding: 2rem;
    font-size: 1.25rem;
  }
}
```

### Accessibility Rules

#### 1. Focus States

**Always provide visible focus indicators:**

```css
button:focus,
a:focus,
input:focus {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}

/* Or use box-shadow for softer appearance */
.btn:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(67, 97, 238, 0.3);
}
```

#### 2. Color Contrast

Ensure WCAG AA compliance:

- **Body text (normal):** 4.5:1 minimum contrast ratio
- **Large text (18px+):** 3:1 minimum contrast ratio
- **Interactive elements:** 3:1 minimum contrast ratio

**Test with tools:**
- Chrome DevTools Lighthouse
- WebAIM Contrast Checker
- axe DevTools

#### 3. Font Size for Inputs

**Never use font-size smaller than 16px for inputs** (prevents iOS auto-zoom):

✅ **Correct:**
```css
input, select, textarea {
  font-size: 16px;
}
```

❌ **Wrong:**
```css
input {
  font-size: 14px; /* Will cause iOS zoom */
}
```

#### 4. Touch Targets

**Minimum 44x44px for mobile interactive elements:**

```css
.btn-mobile {
  min-height: 44px;
  min-width: 44px;
  padding: 0.75rem 1.5rem;
}
```

### Performance Guidelines

#### 1. Use CSS Custom Properties

For values that change frequently (themes, dynamic colors):

```css
:root {
  --primary-color: #4361ee;
}

.btn {
  background: var(--primary-color);
}
```

#### 2. Minimize Repaints

Animate `transform` and `opacity` instead of `top`, `left`, `width`, `height`:

✅ **Performant:**
```css
.slide-in {
  transform: translateX(0);
  opacity: 1;
  transition: transform 0.3s, opacity 0.3s;
}
```

❌ **Poor Performance:**
```css
.slide-in {
  left: 0;
  opacity: 1;
  transition: left 0.3s, opacity 0.3s;
}
```

#### 3. Use `will-change` Sparingly

Only for animations that need optimization:

```css
/* Only during animation */
.animating {
  will-change: transform;
}

/* Remove after animation */
.animation-done {
  will-change: auto;
}
```

#### 4. Optimize Shadows

Use simple shadows instead of multiple stacked box-shadows:

✅ **Good:**
```css
.card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
```

❌ **Avoid:**
```css
.card {
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.12),
    0 1px 2px rgba(0, 0, 0, 0.24),
    0 2px 8px rgba(0, 0, 0, 0.06);
}
```

---

## Common Pitfalls

### ❌ 1. Hardcoded Colors

**Problem:** Colors scattered throughout CSS files, making theme changes difficult.

**Solution:** Use CSS variables defined in `:root`.

```css
/* Bad */
.btn {
  background: #4361ee;
  color: #ffffff;
}

/* Good */
.btn {
  background: var(--primary-blue);
  color: var(--bg-white);
}
```

### ❌ 2. Inconsistent Border Radius

**Problem:** Random border radius values (4px, 6px, 7px, 10px, 12px).

**Solution:** Use standard scale (4, 8, 12, 16, 24).

```css
/* Bad */
.card-a { border-radius: 7px; }
.card-b { border-radius: 10px; }

/* Good */
.card-a { border-radius: 8px; }
.card-b { border-radius: 12px; }
```

### ❌ 3. Random Spacing

**Problem:** Arbitrary padding/margin values (13px, 17px, 23px).

**Solution:** Use spacing scale based on 8px grid (0.5rem increments).

```css
/* Bad */
.section {
  padding: 13px 17px;
  margin-bottom: 23px;
}

/* Good */
.section {
  padding: 0.75rem 1rem;    /* 12px 16px */
  margin-bottom: 1.5rem;    /* 24px */
}
```

### ❌ 4. Desktop-First Media Queries

**Problem:** Using `max-width` media queries requires overriding styles.

**Solution:** Always use mobile-first approach with `min-width`.

```css
/* Bad - Desktop first */
.card {
  padding: 2rem;
}
@media (max-width: 768px) {
  .card { padding: 1rem; }
}

/* Good - Mobile first */
.card {
  padding: 1rem;
}
@media (min-width: 768px) {
  .card { padding: 2rem; }
}
```

### ❌ 5. Missing Focus States

**Problem:** No visible focus indicator for keyboard navigation.

**Solution:** Always style `:focus` states.

```css
/* Bad */
.btn {
  background: #4361ee;
  color: white;
}

/* Good */
.btn {
  background: #4361ee;
  color: white;
}

.btn:focus {
  outline: 2px solid #4361ee;
  outline-offset: 2px;
}
```

### ❌ 6. Overlapping Breakpoints

**Problem:** Mixing `min-width` and `max-width` creates overlaps.

**Solution:** Use `min-width` consistently (mobile-first).

```css
/* Bad - Confusing */
@media (max-width: 768px) { }
@media (min-width: 768px) { }  /* Overlaps at 768px */

/* Good - Clear */
@media (min-width: 768px) { }
@media (min-width: 1280px) { }
```

### ❌ 7. !important Overuse

**Problem:** Indicates specificity issues in CSS structure.

**Solution:** Fix specificity, don't use `!important` as band-aid.

```css
/* Bad */
.text {
  color: #1a1a2e !important;
}

/* Good - Increase specificity properly */
.card .text {
  color: #1a1a2e;
}
```

### ❌ 8. Z-index Chaos

**Problem:** Random z-index values (9, 999, 9999).

**Solution:** Establish z-index scale (10, 20, 30, etc.).

```css
/* Bad */
.modal { z-index: 9999; }
.tooltip { z-index: 99999; }

/* Good */
.dropdown { z-index: 10; }
.modal { z-index: 20; }
.tooltip { z-index: 30; }
```

---

## Migration Plan

### Goal: Introduce CSS Custom Properties Across All Files

This is a **future enhancement** to improve maintainability and consistency.

#### Phase 1: Create `:root` Variables

Add all design tokens to `index.css`:

```css
:root {
  /* Colors */
  --primary-blue: #4361ee;
  --primary-blue-hover: #3b50d9;
  --success-green: #10b981;
  --error-red: #ef4444;
  --text-primary: #1a1a2e;
  --text-secondary: #64748b;
  --bg-white: #ffffff;
  --bg-light: #f8fafc;
  --border-light: #e2e8f0;

  /* Spacing */
  --space-1: 0.5rem;
  --space-2: 0.75rem;
  --space-3: 1rem;
  --space-4: 1.25rem;
  --space-5: 1.5rem;
  --space-6: 2rem;

  /* Typography */
  --text-xs: 0.7rem;
  --text-sm: 0.8rem;
  --text-base: 0.85rem;
  --text-lg: 1rem;
  --text-xl: 1.1rem;
  --font-normal: 400;
  --font-semibold: 600;
  --font-bold: 700;

  /* Shadows */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-focus: 0 0 0 3px rgba(67, 97, 238, 0.1);

  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Transitions */
  --transition-fast: 0.2s ease;
  --transition-base: 0.3s ease;
  --transition-slow: 0.5s ease;
}
```

#### Phase 2: Replace Hardcoded Colors

Gradually replace hardcoded values in existing CSS files:

```css
/* Before */
.btn {
  background: #4361ee;
  color: #ffffff;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
}

/* After */
.btn {
  background: var(--primary-blue);
  color: var(--bg-white);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-5);
}
```

#### Phase 3: Consolidate Duplicate Patterns

Identify and merge duplicate component styles:

```css
/* Before - Duplicated in multiple files */
/* App.css */
.card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* SimpleApp.css */
.simple-card {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* After - Consolidated in index.css */
.card {
  background: var(--bg-white);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}
```

#### Phase 4: Remove Unused CSS

Audit and remove unused classes and selectors to reduce bundle size.

**Tools to help:**
- PurgeCSS
- Chrome DevTools Coverage tab
- Manual code review

---

## Quick Reference

### Color Palette Summary

| Color | Hex | Use Case |
|-------|-----|----------|
| Primary Blue | `#4361ee` | Primary actions, links |
| Success Green | `#10b981` | Success states, positive actions |
| Error Red | `#ef4444` | Errors, destructive actions |
| Warning Orange | `#f59e0b` | Warnings, cautions |
| Text Primary | `#1a1a2e` | Main body text |
| Text Secondary | `#64748b` | Secondary text, labels |
| Border Light | `#e2e8f0` | Subtle borders |
| Background White | `#ffffff` | Card backgrounds |

### Spacing Quick Reference

| Size | rem | px | Usage |
|------|-----|----|-------|
| XS | 0.5rem | 8px | Icon spacing |
| SM | 0.75rem | 12px | Small gaps |
| MD | 1rem | 16px | Standard gaps |
| LG | 1.5rem | 24px | Card padding |
| XL | 2rem | 32px | Section spacing |

### Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | < 768px | Default (mobile-first) |
| Tablet | ≥ 768px | iPad, tablets |
| Desktop | ≥ 1280px | Desktops, large screens |

---

## Conclusion

This style guide ensures consistency across the retirement planning application. Always refer to these guidelines when:

- Creating new components
- Styling pages
- Writing responsive CSS
- Choosing colors and spacing

For questions or suggestions, update this guide through pull requests to keep it current with evolving design patterns.

**Last Updated:** January 2026
