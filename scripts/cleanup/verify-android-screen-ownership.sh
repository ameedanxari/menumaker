#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android/app/src"

canonical_cart="$ANDROID_DIR/main/kotlin/com/menumaker/ui/screens/customer/CartScreen.kt"
canonical_menu="$ANDROID_DIR/main/kotlin/com/menumaker/ui/screens/customer/MenuScreen.kt"
duplicate_cart="$ANDROID_DIR/main/kotlin/com/menumaker/ui/screens/cart/CartScreen.kt"
duplicate_menu="$ANDROID_DIR/main/kotlin/com/menumaker/ui/screens/menu/MenuScreen.kt"
nav_graph="$ANDROID_DIR/main/kotlin/com/menumaker/ui/navigation/NavGraph.kt"

fail() {
  echo "❌ android screen ownership: $*" >&2
  exit 1
}

[[ -f "$canonical_cart" ]] || fail "missing canonical customer CartScreen at $canonical_cart"
[[ -f "$canonical_menu" ]] || fail "missing canonical customer MenuScreen at $canonical_menu"
[[ -f "$nav_graph" ]] || fail "missing navigation graph at $nav_graph"

grep -q 'com.menumaker.ui.screens.customer.CartScreen' "$nav_graph" \
  || fail "navigation does not import canonical customer CartScreen"
grep -q 'com.menumaker.ui.screens.customer.MenuScreen' "$nav_graph" \
  || fail "navigation does not import canonical customer MenuScreen"

if grep -R --line-number --include='*.kt' \
  -e 'com\.menumaker\.ui\.screens\.cart' \
  -e 'com\.menumaker\.ui\.screens\.menu' \
  "$ANDROID_DIR/main" "$ANDROID_DIR/test" "$ANDROID_DIR/androidTest" \
  | grep -v -e "$duplicate_cart" -e "$duplicate_menu"; then
  fail "duplicate cart/menu packages are still referenced outside their deletion candidates"
fi

cart_nav_count="$(grep -c 'CartScreen(' "$nav_graph" || true)"
menu_nav_count="$(grep -c 'MenuScreen(' "$nav_graph" || true)"
[[ "$cart_nav_count" -eq 1 ]] || fail "expected exactly one navigable CartScreen call, found $cart_nav_count"
[[ "$menu_nav_count" -eq 1 ]] || fail "expected exactly one navigable MenuScreen call, found $menu_nav_count"

echo "✅ android screen ownership verified"
echo "Deletion manifest:"
for candidate in "$duplicate_cart" "$duplicate_menu"; do
  if [[ -f "$candidate" ]]; then
    echo "  - $candidate"
  fi
done
