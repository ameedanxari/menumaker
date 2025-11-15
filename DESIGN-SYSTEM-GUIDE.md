# MenuMaker Design System Guide

**Phase 3: Design System & Theming (US3.12)**
**Version**: 1.0.0
**Last Updated**: 2025-11-15

---

## Overview

The MenuMaker Design System provides a comprehensive set of design tokens, components, and guidelines to ensure visual consistency, accessibility, and maintainability across the platform.

### Key Features

✅ **Design Tokens**: Centralized color, typography, spacing, and other design values
✅ **Component Library**: 5+ core components (Button, Input, Card, Modal, Table)
✅ **Dark Mode**: System preference detection + manual override
✅ **Accessibility**: WCAG 2.1 AA compliant (4.5:1 color contrast)
✅ **Responsive**: Mobile-first approach with 5 breakpoints
✅ **Type-Safe**: Full TypeScript support with prop types

---

## Design Tokens

All design tokens are stored in `/frontend/src/design-tokens.json` and consumed by Tailwind CSS.

### Colors

#### Primary (Orange)
Warm, inviting color for food industry. Used for CTAs, links, and interactive elements.

```json
"primary": {
  "50": "#FFF3E0",   // Lightest
  "500": "#FF9800",  // Base
  "900": "#E65100"   // Darkest
}
```

**Usage**:
- `bg-primary-500` - Primary buttons
- `text-primary-600` - Links
- `border-primary-500` - Focus rings

#### Neutral (Grayscale)
Used for text, backgrounds, and borders.

```json
"neutral": {
  "0": "#FFFFFF",    // White
  "500": "#737373",  // Mid-gray
  "950": "#0A0A0A"   // Near-black
}
```

**Usage**:
- `text-neutral-900` - Primary text (light mode)
- `bg-neutral-50` - Surface backgrounds
- `border-neutral-300` - Default borders

#### Semantic Colors

```json
"success": { "500": "#22C55E" },  // Green
"warning": { "500": "#F59E0B" },  // Amber
"error":   { "500": "#EF4444" },  // Red
"info":    { "500": "#3B82F6" }   // Blue
```

**Usage**:
- Success: Form validation, success messages
- Warning: Caution alerts, pending states
- Error: Form errors, destructive actions
- Info: Informational messages, tooltips

### Typography

#### Font Families

```json
"fontFamily": {
  "sans": "Inter, system-ui, sans-serif",
  "mono": "JetBrains Mono, Consolas, monospace"
}
```

**Usage**:
- `font-sans` - Default for all text
- `font-mono` - Code snippets, API responses

#### Font Sizes

```json
"fontSize": {
  "xs":   "0.75rem",   // 12px
  "sm":   "0.875rem",  // 14px
  "base": "1rem",      // 16px (default)
  "lg":   "1.125rem",  // 18px
  "2xl":  "1.5rem",    // 24px
  "4xl":  "2.25rem"    // 36px
}
```

**Usage**:
- `text-sm` - Helper text, captions
- `text-base` - Body text
- `text-2xl` - Card titles
- `text-4xl` - Page headings

#### Font Weights

```json
"fontWeight": {
  "normal": 400,
  "medium": 500,
  "semibold": 600,
  "bold": 700
}
```

**Usage**:
- `font-normal` - Body text
- `font-medium` - Buttons
- `font-semibold` - Headings
- `font-bold` - Emphasis

### Spacing

Based on 4px grid (0.25rem = 4px).

```json
"spacing": {
  "1": "0.25rem",   // 4px
  "2": "0.5rem",    // 8px
  "4": "1rem",      // 16px
  "6": "1.5rem",    // 24px
  "8": "2rem",      // 32px
  "12": "3rem"      // 48px
}
```

**Usage**:
- `p-4` - Default padding (16px)
- `gap-2` - Small spacing between elements
- `space-y-6` - Vertical spacing between sections

### Border Radius

```json
"borderRadius": {
  "sm": "0.25rem",   // 4px
  "md": "0.5rem",    // 8px
  "lg": "0.75rem",   // 12px
  "full": "9999px"   // Circular
}
```

**Usage**:
- `rounded-md` - Default for buttons, inputs
- `rounded-lg` - Cards, modals
- `rounded-full` - Avatar images, badges

### Shadows

```json
"shadows": {
  "sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  "md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  "lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
}
```

**Usage**:
- `shadow-sm` - Subtle elevation (buttons)
- `shadow-md` - Elevated cards
- `shadow-2xl` - Modals, dropdowns

### Breakpoints

Mobile-first approach.

```json
"breakpoints": {
  "sm": "640px",    // Phone landscape
  "md": "768px",    // Tablet portrait
  "lg": "1024px",   // Tablet landscape / Small desktop
  "xl": "1280px"    // Desktop
}
```

**Usage**:
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
  {/* Full width on mobile, half on tablet, third on desktop */}
</div>
```

---

## Component Library

All components are located in `/frontend/src/components/ui/` and can be imported from `@/components/ui`.

### Button

A flexible button component with multiple variants and sizes.

**Props**:
- `variant`: `'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'`
- `size`: `'sm' | 'md' | 'lg'`
- `loading`: `boolean`
- `fullWidth`: `boolean`

**Example**:
```tsx
import { Button } from '@/components/ui';

<Button variant="primary" size="md" onClick={handleClick}>
  Click me
</Button>

<Button variant="outline" loading={isLoading}>
  Loading...
</Button>

<Button variant="danger" fullWidth>
  Delete Account
</Button>
```

**Variants**:
- **Primary**: Orange background, white text - Main CTAs
- **Secondary**: Gray background - Secondary actions
- **Outline**: Transparent with border - Less prominent actions
- **Ghost**: Transparent, no border - Tertiary actions
- **Danger**: Red background - Destructive actions

### Input

Text input with label, error states, and helper text.

**Props**:
- `label`: `string`
- `helperText`: `string`
- `error`: `string`
- `leftIcon`: `ReactNode`
- `rightIcon`: `ReactNode`
- `fullWidth`: `boolean`

**Example**:
```tsx
import { Input } from '@/components/ui';

<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  helperText="We'll never share your email"
  required
/>

<Input
  label="Password"
  type="password"
  error="Password is required"
/>

<Input
  leftIcon={<SearchIcon />}
  placeholder="Search..."
/>
```

**States**:
- **Default**: Gray border
- **Focus**: Blue ring
- **Error**: Red border + error message
- **Disabled**: Grayed out, not interactive

### Card

Container component with header, body, and footer sections.

**Props**:
- `variant`: `'default' | 'elevated' | 'outlined'`
- `interactive`: `boolean` (adds hover effect)

**Example**:
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from '@/components/ui';

<Card variant="elevated">
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Optional description</CardDescription>
  </CardHeader>
  <CardBody>
    Card content goes here
  </CardBody>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

<Card variant="outlined" interactive>
  <CardBody>
    Clickable card with hover effect
  </CardBody>
</Card>
```

### Modal

Dialog component with backdrop, animations, and keyboard navigation.

**Props**:
- `open`: `boolean`
- `onClose`: `() => void`
- `size`: `'sm' | 'md' | 'lg' | 'xl' | 'full'`
- `closeOnBackdropClick`: `boolean` (default: `true`)
- `closeOnEscape`: `boolean` (default: `true`)
- `showCloseButton`: `boolean` (default: `true`)

**Example**:
```tsx
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from '@/components/ui';
import { useState } from 'react';

const [isOpen, setIsOpen] = useState(false);

<Modal open={isOpen} onClose={() => setIsOpen(false)} size="md">
  <ModalHeader>
    <ModalTitle>Confirm Action</ModalTitle>
  </ModalHeader>
  <ModalBody>
    Are you sure you want to delete this item?
  </ModalBody>
  <ModalFooter>
    <Button variant="ghost" onClick={() => setIsOpen(false)}>
      Cancel
    </Button>
    <Button variant="danger" onClick={handleDelete}>
      Delete
    </Button>
  </ModalFooter>
</Modal>
```

**Features**:
- Backdrop overlay with blur
- Prevents body scroll when open
- ESC key to close
- Click outside to close
- Animated entrance/exit
- Renders in portal (outside DOM hierarchy)

### Table

Responsive table with sorting, striping, and hover states.

**Props**:
- `striped`: `boolean`
- `hoverable`: `boolean`

**Example**:
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui';

<Table striped hoverable>
  <TableHeader>
    <TableRow>
      <TableHead sortable sortDirection="asc" onSort={handleSort}>
        Name
      </TableHead>
      <TableHead>Email</TableHead>
      <TableHead className="text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map((user) => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell className="text-right">
          <Button size="sm">Edit</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Features**:
- Sortable columns with direction indicator
- Striped rows (alternating backgrounds)
- Hover states
- Responsive (horizontal scroll on small screens)

---

## Dark Mode

Dark mode is implemented using Tailwind's class-based approach with React Context.

### Setup

Wrap your app with `ThemeProvider`:

```tsx
import { ThemeProvider } from '@/providers/ThemeProvider';

function App() {
  return (
    <ThemeProvider defaultTheme="system">
      {/* Your app */}
    </ThemeProvider>
  );
}
```

### Theme Toggle

Add theme toggle button:

```tsx
import { ThemeToggle } from '@/components/ui';

<ThemeToggle variant="icon" />
// Or dropdown variant:
<ThemeToggle variant="dropdown" />
```

### Using Dark Mode in Components

Use Tailwind's `dark:` prefix:

```tsx
<div className="bg-white dark:bg-neutral-900">
  <p className="text-neutral-900 dark:text-neutral-100">
    This text adapts to theme
  </p>
</div>
```

### System Preference Detection

The `ThemeProvider` automatically detects the user's system preference:

```typescript
const { theme, setTheme, resolvedTheme } = useTheme();

// theme: 'light' | 'dark' | 'system' (user preference)
// resolvedTheme: 'light' | 'dark' (actual theme being used)
```

### Persistence

Theme preference is automatically saved to `localStorage` with key `menumaker-theme`.

---

## Accessibility

All components follow WCAG 2.1 AA standards.

### Color Contrast

- **Text**: 4.5:1 minimum ratio
- **Large text** (18pt+): 3:1 minimum
- **UI elements**: 3:1 minimum

### Keyboard Navigation

- **Tab**: Navigate between interactive elements
- **Enter/Space**: Activate buttons
- **ESC**: Close modals, dropdowns
- **Arrow keys**: Navigate within components

### Focus Indicators

All interactive elements have visible focus rings:

```css
focus-visible:ring-2 focus-visible:ring-primary-500
```

### Screen Readers

- Semantic HTML (`<button>`, `<input>`, `<label>`)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content
- Alt text for all images

### Form Accessibility

```tsx
<Input
  label="Email"           // Linked to input via id
  required                // Shows asterisk
  error="Email required"  // Announced by screen readers
  aria-describedby="email-help"
/>
```

---

## Utilities

Helper functions in `/frontend/src/lib/utils.ts`.

### cn() - Class Name Merger

Merge Tailwind classes safely (handles conflicts):

```tsx
import { cn } from '@/lib/utils';

cn('text-red-500', 'text-blue-500')
// → 'text-blue-500' (last wins)

cn('p-4', isLarge && 'p-8')
// → 'p-8' if isLarge is true
```

### formatCurrency()

Format INR currency:

```tsx
import { formatCurrency } from '@/lib/utils';

formatCurrency(123456)  // → "₹1,234.56"
```

### formatDate()

Format dates in Indian locale:

```tsx
import { formatDate } from '@/lib/utils';

formatDate(new Date())
// → "November 15, 2025"
```

### debounce()

Limit function execution rate:

```tsx
import { debounce } from '@/lib/utils';

const handleSearch = debounce((query) => {
  // API call
}, 300);
```

---

## Best Practices

### 1. Use Design Tokens

**Do**:
```tsx
<div className="bg-primary-500 text-white">
```

**Don't**:
```tsx
<div style={{ backgroundColor: '#FF9800', color: '#FFFFFF' }}>
```

### 2. Mobile-First Responsive

**Do**:
```tsx
<div className="w-full md:w-1/2 lg:w-1/3">
```

**Don't**:
```tsx
<div className="lg:w-1/3 md:w-1/2 w-full">
```

### 3. Semantic HTML

**Do**:
```tsx
<button onClick={handleClick}>Click me</button>
```

**Don't**:
```tsx
<div onClick={handleClick}>Click me</div>
```

### 4. Component Composition

**Do**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

**Don't**:
```tsx
<div className="rounded-lg border p-6">
  <h2>Title</h2>
</div>
```

### 5. Consistent Spacing

Use spacing scale (4px base unit):
- **Tight**: `gap-2` (8px)
- **Normal**: `gap-4` (16px)
- **Loose**: `gap-6` (24px)

---

## Component Checklist

When creating new components:

- [ ] TypeScript props interface
- [ ] Forward ref for DOM access
- [ ] Dark mode support (`dark:` classes)
- [ ] Responsive design (mobile-first)
- [ ] Keyboard navigation
- [ ] ARIA labels (if needed)
- [ ] Loading states (if async)
- [ ] Error states (if applicable)
- [ ] Export from `@/components/ui/index.ts`
- [ ] Document props and examples

---

## Future Enhancements (Phase 3.5+)

- [ ] **Storybook**: Visual component playground
- [ ] **Form Components**: Select, Radio, Checkbox, Textarea
- [ ] **Feedback Components**: Toast, Alert, Badge, Spinner
- [ ] **Navigation Components**: Tabs, Breadcrumbs, Pagination
- [ ] **Data Display**: Avatar, Badge, Progress, Skeleton
- [ ] **Animations**: Framer Motion integration
- [ ] **Charts**: Recharts integration for analytics
- [ ] **Icons**: Icon library (Lucide React)

---

## Support

For questions or issues:
- **GitHub Issues**: https://github.com/ameedanxari/menumaker/issues
- **Internal Wiki**: [Your documentation]

---

**Status**: ✅ Phase 3 Design System Foundation Complete
**Component Count**: 5 core components (Button, Input, Card, Modal, Table)
**Dark Mode**: ✅ Fully implemented
**Accessibility**: ✅ WCAG 2.1 AA compliant
