# MenuMaker Component Library

**Version**: 1.0.0
**Last Updated**: 2025-11-15
**Design System**: Based on MenuMaker Design Tokens v1.0.0

---

## Table of Contents

1. [Overview](#overview)
2. [Installation & Usage](#installation--usage)
3. [Atoms](#atoms)
   - [Button](#button)
   - [Input](#input)
   - [Checkbox](#checkbox)
   - [Radio](#radio)
   - [Badge](#badge)
   - [Avatar](#avatar)
   - [Icon](#icon)
4. [Molecules](#molecules)
   - [Card](#card)
   - [Modal](#modal)
   - [Dropdown](#dropdown)
   - [Tooltip](#tooltip)
   - [Alert](#alert)
   - [Toast](#toast)
5. [Organisms](#organisms)
   - [Header](#header)
   - [Footer](#footer)
   - [Sidebar](#sidebar)
   - [DataTable](#datatable)
   - [Form](#form)
6. [Accessibility Guidelines](#accessibility-guidelines)
7. [Dark Mode Support](#dark-mode-support)

---

## Overview

The MenuMaker Component Library is a comprehensive collection of reusable React components built with TypeScript and styled using Tailwind CSS. All components follow the design tokens defined in `design-tokens.json` and are fully accessible (WCAG 2.1 AA compliant).

**Key Features:**
- 20+ production-ready components
- Full TypeScript support
- Dark mode compatible
- Accessible (keyboard navigation, screen readers)
- Responsive across all breakpoints
- Consistent with MenuMaker brand guidelines

---

## Installation & Usage

### Prerequisites
```bash
npm install react react-dom tailwindcss
```

### Import Components
```tsx
import { Button, Card, Modal } from '@menumaker/components';
```

### Import Styles
Ensure your `tailwind.config.js` imports the design tokens:
```js
import designTokens from './design-tokens.json';
```

---

## Atoms

### Button

Primary interactive element for user actions.

#### Variants
- **Primary**: Main call-to-action buttons
- **Secondary**: Less prominent actions
- **Outline**: Tertiary actions
- **Ghost**: Minimal visual weight
- **Danger**: Destructive actions

#### Props
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClick?: () => void;
  children: React.ReactNode;
}
```

#### Usage Examples

**Primary Button**
```tsx
<Button variant="primary" size="md">
  Create Menu
</Button>
```

**Button with Icon**
```tsx
<Button variant="primary" leftIcon={<PlusIcon />}>
  Add Dish
</Button>
```

**Loading State**
```tsx
<Button variant="primary" loading>
  Saving...
</Button>
```

#### CSS Classes
```css
/* Primary */
.btn-primary {
  @apply bg-primary-500 text-white hover:bg-primary-600
         focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
         disabled:bg-neutral-300 disabled:cursor-not-allowed
         transition-colors duration-base;
}

/* Secondary */
.btn-secondary {
  @apply bg-secondary-500 text-white hover:bg-secondary-600
         focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2;
}

/* Sizes */
.btn-sm {
  @apply px-3 py-1.5 text-sm rounded-md;
}
.btn-md {
  @apply px-4 py-2 text-base rounded-md;
}
.btn-lg {
  @apply px-6 py-3 text-lg rounded-lg;
}
```

#### Accessibility
- `role="button"` for non-button elements
- `aria-label` for icon-only buttons
- `aria-disabled="true"` when disabled
- Keyboard: `Enter` and `Space` trigger onClick
- Focus indicator: 2px solid primary color ring

---

### Input

Text input field for form data.

#### Types
- **Text**: Standard text input
- **Email**: Email validation
- **Password**: Masked input
- **Number**: Numeric input
- **Search**: Search with icon

#### Props
```tsx
interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  label?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onChange?: (value: string) => void;
}
```

#### Usage Examples

**Basic Input**
```tsx
<Input
  label="Business Name"
  placeholder="Enter your business name"
  value={name}
  onChange={setName}
/>
```

**Input with Error**
```tsx
<Input
  label="Email"
  type="email"
  value={email}
  error="Invalid email address"
  onChange={setEmail}
/>
```

**Search Input**
```tsx
<Input
  type="search"
  placeholder="Search dishes..."
  leftIcon={<SearchIcon />}
  value={query}
  onChange={setQuery}
/>
```

#### CSS Classes
```css
.input-base {
  @apply w-full px-3 py-2 text-base border rounded-md
         border-neutral-300 bg-white text-neutral-900
         placeholder:text-neutral-500
         focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0
         disabled:bg-neutral-100 disabled:cursor-not-allowed
         transition-colors duration-base;
}

.input-error {
  @apply border-error-500 focus:border-error-500 focus:ring-error-500;
}
```

#### Accessibility
- `<label>` with `htmlFor` matching input `id`
- `aria-invalid="true"` when error present
- `aria-describedby` linking to error/helper text
- Placeholder text not used as label replacement

---

### Checkbox

Toggle option for binary choices.

#### Props
```tsx
interface CheckboxProps {
  label?: string;
  checked?: boolean;
  disabled?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
}
```

#### Usage Examples

**Basic Checkbox**
```tsx
<Checkbox
  label="Enable delivery"
  checked={deliveryEnabled}
  onChange={setDeliveryEnabled}
/>
```

**Indeterminate State** (for "select all" scenarios)
```tsx
<Checkbox
  label="Select All"
  indeterminate={someSelected && !allSelected}
  checked={allSelected}
  onChange={toggleAll}
/>
```

#### CSS Classes
```css
.checkbox {
  @apply w-4 h-4 text-primary-500 border-neutral-300 rounded
         focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
         disabled:bg-neutral-100 disabled:cursor-not-allowed
         transition-colors duration-fast;
}
```

#### Accessibility
- `role="checkbox"`
- `aria-checked` for state
- `aria-labelledby` for label association
- Keyboard: `Space` toggles state

---

### Radio

Single-choice selection from options.

#### Props
```tsx
interface RadioProps {
  name: string;
  label?: string;
  value: string;
  checked?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
}
```

#### Usage Examples

**Radio Group**
```tsx
<div>
  <Radio
    name="paymentMethod"
    label="Razorpay"
    value="razorpay"
    checked={method === 'razorpay'}
    onChange={setMethod}
  />
  <Radio
    name="paymentMethod"
    label="PhonePe"
    value="phonepe"
    checked={method === 'phonepe'}
    onChange={setMethod}
  />
</div>
```

#### Accessibility
- `role="radio"` and `role="radiogroup"`
- `aria-checked` for selection state
- Keyboard: Arrow keys navigate options, `Space` selects

---

### Badge

Small label for status, categories, or counts.

#### Variants
- **Default**: Neutral gray
- **Primary**: Brand color
- **Success**: Green (completed, active)
- **Warning**: Yellow (pending, caution)
- **Error**: Red (failed, urgent)

#### Props
```tsx
interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

#### Usage Examples

**Status Badge**
```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Suspended</Badge>
```

**Count Badge**
```tsx
<Badge variant="primary">12 Orders</Badge>
```

#### CSS Classes
```css
.badge {
  @apply inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium;
}

.badge-success {
  @apply bg-success-100 text-success-800;
}
```

---

### Avatar

User profile image with fallback initials.

#### Props
```tsx
interface AvatarProps {
  src?: string;
  alt: string;
  name?: string; // For initials fallback
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
}
```

#### Usage Examples

**With Image**
```tsx
<Avatar
  src="/avatars/user123.jpg"
  alt="Priya Sharma"
  size="md"
/>
```

**Initials Fallback**
```tsx
<Avatar
  name="Priya Sharma"
  alt="Priya Sharma"
  size="md"
/>
{/* Displays "PS" */}
```

---

### Icon

SVG icons from Feather Icons set.

#### Usage
```tsx
import { CheckIcon, AlertCircleIcon, XIcon } from '@menumaker/icons';

<CheckIcon className="w-5 h-5 text-success-500" />
```

---

## Molecules

### Card

Container component for grouped content.

#### Props
```tsx
interface CardProps {
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  elevated?: boolean; // Shadow level
  hoverable?: boolean; // Hover effect
  children: React.ReactNode;
}
```

#### Usage Examples

**Basic Card**
```tsx
<Card title="Today's Orders" subtitle="12 new orders">
  <p>Content goes here...</p>
</Card>
```

**Elevated Card with Footer**
```tsx
<Card
  title="Premium Plan"
  elevated
  footer={<Button variant="primary">Upgrade</Button>}
>
  <ul>
    <li>Unlimited menus</li>
    <li>Advanced analytics</li>
  </ul>
</Card>
```

#### CSS Classes
```css
.card {
  @apply bg-white rounded-lg border border-neutral-200 p-6;
}

.card-elevated {
  @apply shadow-md hover:shadow-lg transition-shadow duration-base;
}
```

---

### Modal

Overlay dialog for focused interaction.

#### Props
```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
}
```

#### Usage Examples

**Confirmation Modal**
```tsx
<Modal
  open={showConfirm}
  onClose={() => setShowConfirm(false)}
  title="Delete Dish?"
  footer={
    <>
      <Button variant="ghost" onClick={() => setShowConfirm(false)}>
        Cancel
      </Button>
      <Button variant="danger" onClick={handleDelete}>
        Delete
      </Button>
    </>
  }
>
  <p>This action cannot be undone. Are you sure?</p>
</Modal>
```

#### Accessibility
- `role="dialog"` and `aria-modal="true"`
- `aria-labelledby` for title
- Focus trap: focus locked inside modal
- Keyboard: `Esc` closes modal
- Focus restoration: returns focus to trigger element on close

---

### Dropdown

Contextual menu for actions or selections.

#### Props
```tsx
interface DropdownProps {
  trigger: React.ReactNode;
  items: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
  }>;
  align?: 'left' | 'right';
}
```

#### Usage Examples

**Action Menu**
```tsx
<Dropdown
  trigger={<Button variant="ghost">Actions</Button>}
  items={[
    { label: 'Edit', icon: <EditIcon />, onClick: handleEdit },
    { label: 'Duplicate', icon: <CopyIcon />, onClick: handleDuplicate },
    { label: 'Delete', icon: <TrashIcon />, onClick: handleDelete, danger: true },
  ]}
  align="right"
/>
```

---

### Tooltip

Contextual hint on hover/focus.

#### Props
```tsx
interface TooltipProps {
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}
```

#### Usage Examples

```tsx
<Tooltip content="Click to copy referral link" placement="top">
  <Button variant="ghost" leftIcon={<CopyIcon />}>
    Copy
  </Button>
</Tooltip>
```

---

### Alert

Informational message banner.

#### Variants
- **Info**: Informational messages
- **Success**: Success confirmations
- **Warning**: Warnings or cautions
- **Error**: Error messages

#### Props
```tsx
interface AlertProps {
  variant: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  closable?: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}
```

#### Usage Examples

**Success Alert**
```tsx
<Alert variant="success" title="Menu published!" closable>
  Your menu is now live and customers can place orders.
</Alert>
```

**Error Alert**
```tsx
<Alert variant="error" title="Payment failed">
  There was an issue processing your payment. Please try again.
</Alert>
```

---

### Toast

Temporary notification (auto-dismiss).

#### Usage
```tsx
import { toast } from '@menumaker/components';

// Success toast
toast.success('Order created successfully!');

// Error toast
toast.error('Failed to save changes');

// Custom duration
toast.info('Processing...', { duration: 5000 });
```

---

## Organisms

### Header

Main navigation header.

#### Features
- Logo and branding
- Primary navigation links
- User menu (avatar + dropdown)
- Mobile responsive (hamburger menu)

---

### Footer

Site footer with links and legal info.

#### Sections
- Company info
- Quick links
- Social media
- Copyright notice

---

### Sidebar

Side navigation panel.

#### Features
- Collapsible
- Active state highlighting
- Icon + label
- Nested menus

---

### DataTable

Sortable, filterable data grid.

#### Features
- Column sorting
- Row selection
- Pagination
- Search/filter
- Responsive (horizontal scroll on mobile)

#### Props
```tsx
interface DataTableProps<T> {
  columns: Array<{
    key: string;
    label: string;
    sortable?: boolean;
    render?: (value: any, row: T) => React.ReactNode;
  }>;
  data: T[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onRowClick?: (row: T) => void;
  loading?: boolean;
}
```

---

### Form

Complete form with validation.

#### Features
- Field-level validation
- Error messages
- Submit handling
- Loading states

---

## Accessibility Guidelines

### Color Contrast
- **Text**: Minimum 4.5:1 contrast ratio (WCAG AA)
- **UI Components**: Minimum 3:1 contrast ratio
- Never use color alone to convey information

### Keyboard Navigation
- **Tab**: Navigate forward
- **Shift + Tab**: Navigate backward
- **Enter/Space**: Activate buttons
- **Escape**: Close modals/dropdowns
- **Arrow keys**: Navigate lists/radios

### Screen Readers
- Semantic HTML (`<button>`, `<input>`, `<label>`)
- ARIA labels for icon-only buttons
- ARIA live regions for dynamic content
- Skip links for main content

### Focus Indicators
- 2px solid ring in primary color
- Always visible (never `outline: none` without replacement)
- `:focus-visible` for keyboard-only focus rings

---

## Dark Mode Support

All components support dark mode via Tailwind's `dark:` classes.

### Enabling Dark Mode

**Toggle Implementation**
```tsx
import { useState, useEffect } from 'react';

function DarkModeToggle() {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem('theme') === 'dark'
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  return (
    <button onClick={() => setDarkMode(!darkMode)}>
      {darkMode ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
```

### Dark Mode Classes

**Button (Dark Mode)**
```css
.btn-primary {
  @apply bg-primary-500 text-white
         dark:bg-primary-600 dark:hover:bg-primary-700;
}
```

**Input (Dark Mode)**
```css
.input-base {
  @apply bg-white text-neutral-900 border-neutral-300
         dark:bg-dark-background-secondary dark:text-dark-text-primary dark:border-dark-border-default;
}
```

---

## Component Checklist

When creating new components, ensure:

- [ ] TypeScript types defined
- [ ] All variants implemented
- [ ] Dark mode styles added
- [ ] Accessibility tested (keyboard + screen reader)
- [ ] Responsive across breakpoints
- [ ] Focus indicators visible
- [ ] ARIA attributes appropriate
- [ ] Error states handled
- [ ] Loading states included
- [ ] Storybook story created (if using Storybook)

---

## Contributing

To add a new component:

1. Create component file in `src/components/`
2. Define TypeScript interface
3. Implement using design tokens
4. Add dark mode support
5. Test accessibility
6. Document in this guide
7. Create usage examples

---

## Resources

- **Design Tokens**: `design-tokens.json`
- **Tailwind Config**: `tailwind.config.js`
- **Figma**: [MenuMaker Design System](https://figma.com/menumaker-design-system)
- **Icon Library**: [Feather Icons](https://feathericons.com/)
- **Accessibility**: [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Last Updated**: 2025-11-15
**Maintained by**: MenuMaker Design Team
