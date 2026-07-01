# ADR 0002: AWS Production Runtime and Delivery Topology

- **Status:** Accepted for implementation, pending user review before first production apply
- **Date:** 2026-06-20
- **Owners:** Platform/Release Engineering
- **Related sources:** SRC-011, SRC-012, SRC-013, SRC-014, SRC-015, SRC-016, SRC-017, SRC-018 in `prompts/outputs/current/source-ledger.md`

## Decision

MenuMaker will use one AWS launch topology:

- **API runtime:** ECS Fargate service for the Fastify API behind an internet-facing Application Load Balancer (ALB). The ALB is the only public API ingress. ECS tasks run in private subnets with `assign_public_ip=false`, matching AWS guidance that an ALB can receive public traffic and forward to applications over private IPs (SRC-011), while private Fargate tasks need controlled egress such as NAT (SRC-012).
- **Database:** Amazon RDS PostgreSQL Multi-AZ for Tier 0 transactional state. RDS Multi-AZ provides standby failover support (SRC-013), and instance failover is typically 60–120 seconds but may take longer during large transactions or recovery (SRC-014).
- **Static web and media:** S3 buckets with encryption and CloudFront distributions. Web artifacts are promoted by checksum, not rebuilt from branch state.
- **DNS/TLS:** Route 53 hosted-zone inputs and ACM certificate ARNs. TLS is mandatory for public API/web endpoints.
- **Secrets:** AWS Secrets Manager ARNs and KMS keys. Terraform accepts secret ARNs only, never secret values.
- **Images and artifacts:** ECR image repositories, GitHub Actions artifacts, immutable image digests, and manifest checksums.
- **Observability:** CloudWatch log groups, alarms, and deployment evidence artifacts.
- **State separation:** `dev`, `staging`, and `prod` use the same Terraform module but separate state keys, accounts, domains, capacity, retention, deletion protection, and approval policies.

## Service map

| Service | Owner | Data classification | Network zone | Scaling boundary | Failure/rollback behavior |
|---|---|---|---|---|---|
| ALB | Platform | Request metadata | Public subnets | Listener/target group health | Roll back listener target to prior healthy ECS service/task set |
| ECS Fargate API | Backend | Orders, payments, customer/seller operational data in transit | Private subnets | Desired count, CPU/memory, autoscaling alarms | Deploy by pinned image digest; restore prior task definition on smoke failure |
| RDS PostgreSQL | Data/Backend | Tier 0 canonical state | Private DB subnets | Instance class/storage; Multi-AZ failover | Forward-fix migrations by default; never auto-revert destructive migrations |
| ECR | Platform | Build artifact metadata | AWS service plane | Repository retention/lifecycle | Promote by digest; mutable tags are not release identity |
| S3 web bucket | Frontend | Public web assets | Private bucket, CloudFront origin access | Object count/bandwidth | Restore prior web checksum/object prefix on verification failure |
| S3 media bucket | Product/Platform | User-uploaded menu/media assets | Private bucket, signed access via API/CloudFront | Bucket/object lifecycle | Do not delete during app rollback; media restore follows backup runbook |
| CloudFront | Platform | Public cached web/media responses | Edge/public | Cache behaviors/origins | Invalidate changed web paths after checksum promotion |
| Route 53 / ACM | Platform | DNS/TLS metadata | Public DNS/control plane | Hosted zone / cert renewal | DNS is changed by reviewed Terraform plans only |
| Secrets Manager / KMS | Security/Platform | Secret references and encrypted secrets | AWS service plane | KMS key and secret version limits | Rotate secret versions; no secret value in Terraform state |
| CloudWatch | SRE | Logs, metrics, alarm evidence | AWS service plane | Retention and alarm thresholds | Verification fails closed on alarm state |

## Environment topology

Each environment has its own Terraform state key and inputs:

- `dev`: low capacity, no deletion protection, short retention, offline plan support for local validation.
- `staging`: production-like topology, lower capacity, deletion protection enabled for database, shorter but safe retention.
- `prod`: deletion protection enabled, Multi-AZ enabled, backup retention at least 7 days, pinned image digest, protected GitHub environment approval, and no auto-apply without review.

Remote state is bootstrapped outside this module with an encrypted S3 bucket and DynamoDB lock table. The root Terraform file documents backend bootstrap inputs; production state must use an environment-specific key such as `menumaker/prod/terraform.tfstate`.

## Rejected options

- **Lambda for the API:** rejected for launch because the current Fastify service has long-lived application process assumptions, migration orchestration, and containerized build gates. Lambda can be reconsidered for isolated event handlers.
- **EKS:** rejected for launch because it adds cluster/control-plane operations before the team has Kubernetes-specific runbooks and SRE coverage. ECS Fargate gives a smaller operational surface for the first production release.
- **Single public EC2 host:** rejected because it concentrates ingress, runtime, and operational patching into one mutable instance and does not align with immutable artifact promotion.

## Resilience, RPO/RTO, and rollback

- **API RTO:** restore the prior ECS task definition or image digest within 30 minutes of a failed smoke test.
- **Web RTO:** restore the prior S3/CloudFront web artifact within 15 minutes.
- **Database RTO:** RDS Multi-AZ failover is expected to be minutes rather than seconds for instance deployments, with AWS citing typical 60–120 second failovers but longer recovery under load (SRC-014).
- **Database RPO:** within the configured backup/PITR window for ordinary operator error or instance failure, subject to backup retention and restore-drill evidence (SRC-015).
- **Regional loss caveat:** catastrophic regional loss exceeds the initial RPO/RTO until a cross-region replication and restore decision is approved. No zero-data-loss claim is made for regional loss.
- **Migration rollback:** application/web artifacts can roll back automatically after verification failure; destructive database migrations must not be auto-reverted. The release path runs migrations once through the dedicated migration job from ADR 0001.

## Security and delivery posture

GitHub Actions will assume AWS roles through OIDC with repository/environment-limited trust conditions, following AWS guidance to limit GitHub OIDC role assumption by org/repo/branch (SRC-016). Third-party actions are pinned to full-length commit SHAs because GitHub documents this as the immutable action reference mechanism (SRC-017). Action SHA provenance is recorded in SRC-018 and must be re-reviewed when actions are upgraded.

## Cost assumptions

- Dev may use one NAT gateway and small RDS capacity to control cost.
- Staging and prod keep the same network/security topology but differ by capacity, retention, and alarms.
- Production must keep deletion protection, Multi-AZ, and backup retention even if cost pressure appears; relaxing them requires a new ADR.

## User-review checkpoint

Before first production apply, the product owner and operator must review:

1. environment/account/domain inputs,
2. deletion protection and backup retention,
3. GitHub environment approvals,
4. restore and rollback drill evidence,
5. unresolved cross-region recovery decision.
