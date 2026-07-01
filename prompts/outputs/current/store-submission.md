# Mobile Distribution and Store Readiness

MenuMaker's store work is part of release evidence, not a substitute for functional completion.

## Product records

- iOS: proposed `MenuMaker-Business` / `com.creatrixe.MenuMaker.business` and `MenuMaker-Customer` / `com.creatrixe.MenuMaker.customer`, subject to ADR 0004 and existing-bundle migration review.
- Android: `com.menumaker.seller` and `com.menumaker.customer` release flavors.
- Apple Developer/App Store Connect and Google Play Console records, signing identities, team/service accounts, and internal-test tracks must be created outside the repository and referenced by non-secret IDs.

## Required evidence before submission

- Both products archive/sign from the immutable CI artifact manifest and install through TestFlight/Play internal testing.
- Listing name/subtitle/description/keywords/support/privacy URLs reflect the capability registry and contain no unimplemented claims.
- `docs/release/mobile-data-practices.yaml` drives iOS privacy nutrition and Play Data Safety answers, including camera/photos/location/notifications, analytics/crash reporting, account/contact/address/payment metadata, sharing, retention, and deletion.
- Permission-denial, account deletion/export, session/logout, payment failure, offline behavior, and support/legal destinations pass on release builds.
- Store screenshots are captured from deterministic release candidates after design-system review, for approved locales/devices/scenarios; no screenshot task is authorized until packaging and primary flows are stable.
- App icons, version/build numbers, age/content ratings, export compliance, encryption declarations, account deletion URL, review credentials, and reviewer notes are complete.
- Android Vitals and Xcode Organizer/crash symbolication are connected; rollback/hotfix ownership and support escalation are documented.

## Distribution gate

Internal distribution may begin after Milestone 2. Public submission requires Milestones 3–5 plus explicit user authorization. Store approval does not prove backend production readiness; the release candidate must still pass migration, contract, payment, privacy, SLO, and rollback gates.
