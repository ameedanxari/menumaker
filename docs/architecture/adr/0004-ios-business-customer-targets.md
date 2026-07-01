# ADR 0004: iOS Business and Customer Targets

Status: accepted for implementation
Date: 2026-06-20
Owners: iOS release owner, mobile platform owner, security owner

## Decision

MenuMaker iOS is packaged as two thin applications over one shared source set:

| Product | Scheme | Bundle identifier | Store record | Primary role |
|---|---|---|---|---|
| Business | `MenuMaker-Business` | `com.creatrixe.MenuMaker.business` | MenuMaker Business | Sellers, menus, orders, payouts, reviews |
| Customer | `MenuMaker-Customer` | `com.creatrixe.MenuMaker.customer` | MenuMaker Customer | Marketplace, cart, checkout, orders, profile |

The previous single-app bundle identifier, `com.creatrixe.MenuMaker`, remains a migration compatibility target only. Uploading either new bundle to App Store Connect requires release-owner review of bundle-ID migration, keychain access groups, push provisioning, universal links, and customer communication.

## Ownership map

| Area | Shared ownership | Business ownership | Customer ownership |
|---|---|---|---|
| Source directories | `ios/MenuMaker/Core`, `Data`, `Generated`, `Shared`, `Resources`, common auth views, shared models, repositories, services, design tokens | `ios/MenuMaker/App/MenuMakerBusinessApp.swift`, seller views, seller view models, Business UI tests | `ios/MenuMaker/App/MenuMakerCustomerApp.swift`, customer views, customer view models, Customer UI tests |
| Asset catalogs | `ios/MenuMaker/Assets.xcassets` shared colors and base icons | Business app icon slot and seller imagery when added | Customer app icon slot and marketplace imagery when added |
| Info.plist | `ios/MenuMaker/Info.plist` shared privacy strings and transport policy until split plists are added | Business display name and bundle ID through target build settings | Customer display name and bundle ID through target build settings |
| Entitlements | Shared only when entitlement value is role-neutral | `com.creatrixe.MenuMaker.business` associated domains, push topic, keychain group | `com.creatrixe.MenuMaker.customer` associated domains, push topic, keychain group |
| URL schemes | Shared callback parser in Core | `menumaker-business` | `menumaker-customer` |
| Push environment | Shared notification service implementation | Business APNs topic and seller notification categories | Customer APNs topic and customer notification categories |
| Tests | `MenuMakerTests` for shared unit coverage | `MenuMaker-BusinessUITests`, `MenuMaker-Business` scheme/test plan configuration | `MenuMaker-CustomerUITests`, `MenuMaker-Customer` scheme/test plan configuration |

## Build and dependency boundary

The Xcode project is authoritative for app target membership. `ios/Package.swift` must not claim absent app-library targets. It may only describe a real `MenuMakerCore` shared-source package with explicit path/excludes, or it must be removed. This ADR chooses the valid `MenuMakerCore` manifest path so `swift package describe` remains useful without competing with Xcode app packaging.

Both app targets share Core/Data/Generated/Shared sources and compile exactly one `@main` entry point:

- `MenuMakerBusinessApp` boots seller navigation only.
- `MenuMakerCustomerApp` boots customer navigation only.
- `MenuMakerApp` remains the compatibility app for the legacy `MenuMaker` scheme and is not a new-store upload target.

## Migration and security implications

Moving from `com.creatrixe.MenuMaker` to `com.creatrixe.MenuMaker.business` and `com.creatrixe.MenuMaker.customer` changes the app container and default keychain access group. The release owner must approve one of these migration strategies before store upload:

1. ship an update to `com.creatrixe.MenuMaker` that exports refresh state through a server-mediated re-login flow, or
2. accept forced re-authentication for both new apps and revoke stale refresh sessions server-side.

The keychain access group must be reviewed explicitly. Sharing the old group across the two new apps is prohibited unless security signs off on cross-product token visibility. Payment credentials, refresh tokens, and push tokens must be product-scoped.

## Verification

Required commands:

```bash
rg -n "MenuMaker-Business|MenuMaker-Customer|com.creatrixe.MenuMaker.business|com.creatrixe.MenuMaker.customer|Keychain" docs/architecture/adr/0004-ios-business-customer-targets.md
cd ios && xcodebuild -list -project MenuMaker.xcodeproj
cd ios && swift package describe
```

The first command proves the packaging, bundle-ID, and Keychain decisions are documented. The Xcode and SwiftPM commands prove the implementation metadata is aligned with this ADR.
