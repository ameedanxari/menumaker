# UI Reference Source Map

This document defines the central design context for MenuMaker.

| Reference Category | Observed Pattern | Product Decision | Non-copy Boundary | Components Affected | Tokens Affected | States Affected | Responsive Notes | Accessibility Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Theme Authority | Token-based styling | Strict adherence to JSON tokens | CSS-in-JS vs CSS | All Components | Primary/Neutral | All | Tailwind-responsive | WCAG 2.1 compliance |

## Existing Theme Authority
- **Authority:** `frontend/src/design-tokens.json`
- **Tailwind Config:** `frontend/tailwind.config.js`
- **Mobile CSS:** `frontend/src/styles/mobile.css`

## Component Inventory
- **Web:** React-based components under `frontend/src/components/`.
- **iOS:** SwiftUI views under `ios/MenuMaker/Views/`.
- **Android:** Jetpack Compose views under `android/app/src/main/kotlin/com/menumaker/ui/`.

## Screen Fidelity
- Android and iOS screens must adhere to the layout patterns defined in `frontend/src/pages/` and the design tokens.
- All new UI implementation must use the token-based variables (`--color-primary-500`, etc.) or their mobile equivalents.
