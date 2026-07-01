# Client Layering and Ownership

Generated OpenAPI transport types are wire contracts, not screen state. Each
client keeps the same visual design and state contracts while moving toward a
consistent ownership stack:

`generated transport DTO -> mapper -> repository -> use case/ViewModel -> UI state -> screen`

## Layer rules

| Layer | Web | Android | iOS | May import |
|---|---|---|---|---|
| Transport | `shared/src/generated/api.ts`, one API adapter | `com.menumaker.generated.api`, Retrofit adapter | `MenuMaker/Generated/API` | generated DTOs, HTTP primitives |
| Mapper | `frontend/src/services/*Mapper.ts` | `data/mapper/*` | `Core/Mappers/*` | transport DTOs, domain models |
| Repository | `frontend/src/stores/*Store.ts` or service repositories | `data/repository/*Repository.kt` | `Core/Services/*Repository.swift` | mappers, domain models, persistence |
| Use case/ViewModel | React Query hooks/stores | `viewmodel/*ViewModel.kt` | SwiftUI observable models | repositories, UI state types |
| UI state | page-local state objects | sealed UI state classes | view state structs | domain values only |
| Screen | React components/pages | Compose screens | SwiftUI views | UI state, callbacks, design tokens |

Screens must not import generated DTOs, mutable persistence entities, endpoint
strings, or repositories directly. Repositories must not import platform
screens. DTO-to-domain mapping is the boundary where generated contracts meet
client behavior.

## Flow ownership

| Flow | Cache owner | Repository owner | UI-state owner | Notes |
|---|---|---|---|---|
| Auth/session | Identity | auth repository/store | login/signup/session state | refresh token and sign-out are owned by session boundary |
| Seller menu/order | Business Catalog + Ordering | menu/order repositories | seller dashboard/order states | generated DTOs mapped before screens |
| Customer cart/checkout | Ordering + Payments/Billing | cart/payment repositories | cart/checkout/payment states | payment cannot mutate order state directly |
| Settings | Identity + Business Catalog | settings repository | settings screen state | user settings and business settings remain separate |

## Representative file mapping

| Platform | Transport | Repository | ViewModel/store | Screen |
|---|---|---|---|---|
| Web auth | `shared/src/generated/api.ts` | `frontend/src/services/api.ts` adapter | `frontend/src/stores/authStore.ts` | auth pages |
| Web seller menu/order | generated API adapter | menu/order store services | dashboard/order stores | seller pages |
| Android customer cart | generated API adapter | `android/app/src/main/kotlin/com/menumaker/data/repository/CartRepository.kt` | `CartViewModel` | customer Cart/Checkout screens |
| Android seller menu/order | generated API adapter | menu/order repositories | `SellerViewModel` | seller screens |
| iOS transport | `ios/MenuMaker/Generated/API/MenuMakerGeneratedAPI.swift` | `MenuMakerAPITransport` + repositories | SwiftUI observable state | seller/customer views |

## Verification policy

Architecture checks fail when:

- UI imports `shared/src/generated`, `com.menumaker.generated.api`, or
  `MenuMaker/Generated/API` directly.
- Screens declare literal `/api/` endpoint strings.
- Repositories import `screens`, `Views`, or platform UI frameworks.
- Two repositories claim the same persistence cache without a documented
  owner.

Existing visual behavior, design tokens, and state names remain authoritative.
Layering changes are structural, not a redesign.
