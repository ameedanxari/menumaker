#!/usr/bin/env python3
import re
import sys
from pathlib import Path

matrix_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs/design-system/state-matrix.yaml")
source_roots = [Path(arg) for arg in sys.argv[2:]]
errors: list[str] = []

if not matrix_path.exists():
    errors.append(f"{matrix_path}: missing state matrix")
    text = ""
else:
    text = matrix_path.read_text()

for root in source_roots:
    if not root.exists():
        errors.append(f"{matrix_path}: referenced source root does not exist: {root}")

required_global = [
    "44px minimum",
    "48dp minimum",
    "44pt minimum",
    "keyboard_focus_order_matches_visual_order",
    "voiceover_talkback_labels_for_icon_controls",
    "reduced_motion_respected",
    "zoom_and_dynamic_type_preserve_layout",
    "rtl_layout_mirrors_order_without_losing_meaning",
    "status_never_uses_color_only",
    "axe critical/serious violations: 0",
    "Android Compose semantics violations: 0",
    "XCTest accessibility violations: 0",
]

for item in required_global:
    if item not in text:
      errors.append(f"{matrix_path}: missing global accessibility requirement/evidence: {item}")

required_states = ["default", "loading", "empty", "error", "disabled", "success", "offline", "pending"]
for state in required_states:
    if not re.search(rf"^\s{{2}}{state}:", text, re.MULTILINE):
        errors.append(f"{matrix_path}: missing state_contract.{state}")

required_flows = [
    "auth",
    "public_menu",
    "cart_checkout",
    "seller_dashboard",
    "seller_menu",
    "seller_orders",
    "payments",
    "settings",
    "admin",
]

flow_pattern = re.compile(r"^  ([a-z_]+):\n(?P<body>(?:    .+\n|      .+\n|        .+\n)+)", re.MULTILINE)
flows = {match.group(1): match.group("body") for match in flow_pattern.finditer(text)}

for flow in required_flows:
    body = flows.get(flow)
    if not body:
        errors.append(f"{matrix_path}: missing flow {flow}")
        continue
    state_match = re.search(r"states:\s*\[([^\]]+)\]", body)
    states = [item.strip() for item in state_match.group(1).split(",")] if state_match else []
    missing_states = [state for state in required_states if state not in states]
    if missing_states:
        errors.append(f"{matrix_path}: flow {flow} missing states: {', '.join(missing_states)}")
    for key in ["recovery_actions:", "copy:", "web_components:", "android_components:", "ios_components:", "accessibility:"]:
        if key not in body:
            errors.append(f"{matrix_path}: flow {flow} missing {key}")
    for a11y in ["voiceover_label", "talkback_label", "no_color_only"]:
        if a11y not in body:
            errors.append(f"{matrix_path}: flow {flow} missing accessibility mapping {a11y}")

if "KPI, filter, chart, table, tooltip, and legend" not in text:
    errors.append(f"{matrix_path}: dashboard KPI/filter/chart/table/tooltip/legend behavior is not documented")

if errors:
    for error in errors:
        print(f"❌ {error}", file=sys.stderr)
    sys.exit(1)

print(f"✅ state matrix valid: {matrix_path}")
