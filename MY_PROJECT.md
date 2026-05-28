# My Project

## Brief (required)

The project is MenuMaker, an existing application that needs an exhaustive gap analysis and remediation. The goal is a "Gap-closure" using the `audit-and-remediate.md` engine. I need a full component audit to determine what exists, what works, and what is broken across the backend, frontend, and mobile (iOS/Android) targets. This should result in a prioritized gap list (ordered by severity and dependencies) and atomic remediation tasks that point to specific existing files to achieve production-readiness.

## Product identity
- **Name**: MenuMaker
- **Short Name**: MenuMaker
- **Bundle ID**: com.menumaker.app
- **Package ID**: com.menumaker

## Platforms
- **Web**: Frontend (React)
- **Mobile**: iOS (Swift/SwiftUI) and Android (Kotlin/Jetpack Compose)
- **Backend**: Node.js/Express

## Tech preferences
- **Frontend (web)**: React, TypeScript, Vite, Tailwind CSS, Vitest, Playwright.
- **Mobile**: Native iOS (Swift), Native Android (Kotlin).
- **Backend**: Node.js, Express, Jest.
- **Infrastructure**: Terraform, AWS.

## Users / roles
- Business Owner (Menu Creator)
- Customer (Menu Viewer)
- Admin (System Manager)

## Constraints
- Must audit existing codebases in `frontend/`, `backend/`, `ios/`, and `android/`.
- Must respect existing architecture in `shared/` and `infrastructure/`.

## Reference material
- Existing source code in the project root directories: `frontend/`, `backend/`, `ios/`, `android/`, `shared/`, `infrastructure/`.
- Existing documentation in `docs/` and `specs/`.

## Restrict
- Do not suggest entire stack rewrites; focus on fixing, completing, and productionizing the existing codebase.

## Non-goals
- Implementing entirely new major features not already present or implied by the existing code until the baseline is stable.
