# External Services and Accounts

## Amazon Web Services
- **What it does in this project:** Proposed production hosting for ECS Fargate, RDS PostgreSQL, S3/CloudFront, Route 53/ACM, ECR, Secrets Manager/KMS, CloudWatch/X-Ray, backups, and Terraform state.
- **Sign up at:** https://aws.amazon.com/
- **Env vars needed:** `AWS_REGION`, CI workload-identity role ARNs; runtime secrets are referenced through Secrets Manager, not copied into repository variables.
- **Used by tasks:** G3.R1–G3.R7, G10.R2–G10.R6, G11.R4
- **How to get credentials:** Create separate dev/staging/prod accounts or roles, configure GitHub OIDC trust and least-privilege deployment/runtime roles, then record only role/account IDs in protected environments.
- **Cost tier:** paid-only
- **Production note:** Account/region/residency, budgets, support, backup retention, deletion protection, alert destinations, and environment approvals require owner review before apply.

## Stripe
- **What it does in this project:** Already integrated for payment intents and subscriptions; remediation finalizes signed/idempotent webhooks, tokenized methods, and event ownership.
- **Sign up at:** https://dashboard.stripe.com/register
- **Env vars needed:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_SUBSCRIPTIONS`, `STRIPE_PRICE_ID_STARTER`, `STRIPE_PRICE_ID_PRO`
- **Used by tasks:** G2.R4–G2.R6, G5.R5, G6.R6, G7.R4, G8.R3
- **How to get credentials:** Create separate test/live restricted keys and webhook destinations in Stripe Dashboard; store them only in the appropriate AWS/GitHub protected environment.
- **Cost tier:** paid-only
- **Production note:** Live mode remains disabled until raw-body signatures, idempotency, amount/currency ownership, refunds, replay, and incident alerts pass.

## Apple Developer Program and App Store Connect
- **What it does in this project:** Signs, distributes, tests, and publishes MenuMaker Business and Customer iOS applications and supplies crash/release evidence.
- **Sign up at:** https://developer.apple.com/programs/
- **Env vars needed:** signing is handled by protected certificates/profiles or App Store Connect API keys; no key belongs in `.env`.
- **Used by tasks:** G6.R1–G6.R7, G8.R6, G10.R5, G11.R5, `store-submission.md`
- **How to get credentials:** Enrol the organization, create bundle IDs/app records, restricted App Store Connect API key, signing/provisioning assets, and TestFlight groups.
- **Cost tier:** paid-only
- **Production note:** Existing bundle-ID/keychain migration, privacy nutrition, review credentials, export compliance, and support/privacy URLs require approval.

## Google Play Console and Firebase
- **What it does in this project:** Signs/distributes Android seller/customer apps; Firebase supplies push/analytics/crash services already referenced by Android.
- **Sign up at:** https://play.google.com/console/ and https://console.firebase.google.com/
- **Env vars needed:** CI-injected `google-services.json` per flavor/environment, service-account identity, signing keystore credentials; no production config is committed.
- **Used by tasks:** G5.R1–G5.R6, G8.R6, G10.R5, G11.R5, G14.R3, `store-submission.md`
- **How to get credentials:** Create separate Firebase projects and Play app records, restricted CI upload service account, internal testing tracks, and protected signing material.
- **Cost tier:** freemium
- **Production note:** Replace the tracked test Firebase config; complete Data Safety, permission/SDK inventory, Vitals, deletion, and signing-key recovery.

## Twilio WhatsApp
- **What it does in this project:** Already integrated for WhatsApp notifications; remediation moves delivery intent through the transactional outbox.
- **Sign up at:** https://www.twilio.com/try-twilio
- **Env vars needed:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`, `WHATSAPP_ENABLED`
- **Used by tasks:** G7.R6, G10.R2, G11.R1
- **How to get credentials:** Create a production subaccount/sender, approve templates, restrict credentials, and store them in Secrets Manager.
- **Cost tier:** paid-only
- **Production note:** Consent/opt-out, template approval, rate limits, delivery receipts, retention, and DLQ/replay must be verified.

## Anthropic API
- **What it does in this project:** Already referenced for OCR/menu extraction; it remains optional until capability, privacy, failure, and cost controls are approved.
- **Sign up at:** https://console.anthropic.com/
- **Env vars needed:** `ANTHROPIC_API_KEY`, `OCR_ENABLED`
- **Used by tasks:** G7.R1–G7.R2, G10.R2, G11.R1–G11.R2
- **How to get credentials:** Create a restricted workspace key, store it in Secrets Manager, and set spending/usage monitoring.
- **Cost tier:** paid-only
- **Production note:** Uploaded-menu data classification, retention/provider terms, user disclosure, timeout/fallback, and prompt/output logging policy must be approved.

## Launch payment/POS/delivery providers
- **What it does in this project:** Razorpay, Paytm, PhonePe, Square/POS, and delivery adapters exist or are referenced, but only explicitly approved launch providers will be enabled and completed.
- **Sign up at:** Provider business dashboards selected by the product owner.
- **Env vars needed:** Provider-specific IDs/secrets documented in the capability registry and stored through Secrets Manager/KMS.
- **Used by tasks:** G7.R1–G7.R3, G11.R4
- **How to get credentials:** Complete merchant/vendor onboarding, obtain sandbox and production credentials, configure callback/webhook URLs, and restrict access by environment.
- **Cost tier:** paid-only
- **Production note:** Unapproved providers return `FEATURE_UNAVAILABLE`; no placeholder connect/refresh/sync success may ship.
