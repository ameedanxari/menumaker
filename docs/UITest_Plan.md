# MenuMaker UI Test Plan

## Overview
Comprehensive UI test coverage for iOS and Android apps covering all user stories from Phase 1 and Phase 2 specifications.

## Test Strategy
- **Pattern**: Page Object Model for maintainability
- **Coverage Target**: 80%+ of critical user paths
- **Platforms**: iOS (XCUITest) + Android (Compose UI Testing)
- **CI Integration**: Run on every PR

## Test Categories

### Priority Levels
- 🔴 **P0 (Critical)**: Core flows - must always pass
- 🟡 **P1 (High)**: Important features - should pass
- 🟢 **P2 (Medium)**: Nice-to-have - can fail temporarily

---

## Phase 1: Core Features

### 1. Authentication & User Management

#### 1.1 Login Flow 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Login screen displays correctly | Launch app | Email field, password field, login button, signup link visible | ✅ Exists |
| Login with valid credentials | Enter valid email/password → Tap login | Navigate to home/marketplace | ❌ Broken |
| Login with invalid email | Enter invalid email → Tap login | Show error "Invalid email format" | ❌ Broken |
| Login with wrong password | Enter valid email, wrong password → Tap login | Show error "Invalid credentials" | ⚠️ Missing |
| Login with empty fields | Tap login without input | Show validation errors | ❌ Broken |
| Email field validation | Enter various email formats | Real-time validation feedback | ⚠️ Missing |
| Password visibility toggle | Tap show/hide password icon | Password becomes visible/hidden | ⚠️ Missing |
| Remember me functionality | Enable remember me → Login → Close app → Reopen | User stays logged in | ⚠️ Missing |

#### 1.2 Signup Flow 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Signup screen displays correctly | Tap signup link from login | Name, email, password, phone fields visible | ❌ Broken |
| Signup with valid data | Fill all fields → Tap signup | Account created, navigate to home | ❌ Broken |
| Signup with existing email | Use existing email → Tap signup | Show error "Email already exists" | ⚠️ Missing |
| Signup with weak password | Enter password without requirements → Tap signup | Show password strength validation | ❌ Broken |
| Signup with missing required fields | Leave name empty → Tap signup | Show "Name is required" | ❌ Broken |
| Phone number validation | Enter invalid phone formats | Show validation error | ⚠️ Missing |
| Terms & conditions acceptance | Tap signup without accepting terms | Prevent signup, show message | ⚠️ Missing |
| Email verification flow | Complete signup → Check email | Receive verification email | ⚠️ Missing |

#### 1.3 Password Reset 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Navigate to forgot password | Tap "Forgot Password" on login | Show password reset screen | ⚠️ Missing |
| Request password reset | Enter email → Tap submit | Show success message, send email | ⚠️ Missing |
| Invalid email for reset | Enter non-existent email → Tap submit | Show error message | ⚠️ Missing |
| Reset password with link | Click link from email → Enter new password | Password updated successfully | ⚠️ Missing |

#### 1.4 Social Authentication 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Login with Google | Tap "Continue with Google" | Show Google auth flow | ⚠️ Missing |
| Login with Apple | Tap "Continue with Apple" | Show Apple auth flow | ⚠️ Missing |
| Social auth - first time | Complete social auth (new user) | Create account, navigate to home | ⚠️ Missing |
| Social auth - returning user | Complete social auth (existing user) | Login, navigate to home | ⚠️ Missing |

#### 1.5 Profile Management 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View profile | Navigate to profile screen | Display user info (name, email, phone) | ⚠️ Missing |
| Edit profile | Update name → Save | Profile updated, show success | ⚠️ Missing |
| Change password | Enter old + new password → Save | Password changed successfully | ⚠️ Missing |
| Logout | Tap logout | Return to login screen | ❌ Broken |

### 2. Customer Flows

#### 2.1 Marketplace Browsing 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View marketplace | Navigate to marketplace | Display list of sellers | ⚠️ Missing |
| Search sellers | Enter search query | Filter results by name/cuisine | ⚠️ Missing |
| Filter by cuisine | Select cuisine filter | Show only sellers with that cuisine | ⚠️ Missing |
| Filter by distance | Adjust distance slider | Show sellers within range | ⚠️ Missing |
| Sort by rating | Select "Sort by Rating" | List ordered by highest rating | ⚠️ Missing |
| Sort by distance | Select "Sort by Distance" | List ordered by nearest first | ⚠️ Missing |
| Sort by reviews | Select "Sort by Reviews" | List ordered by most reviews | ⚠️ Missing |
| View seller profile | Tap on seller card | Show seller details, menu | ⚠️ Missing |
| Pull to refresh | Pull down on marketplace | Reload seller list | ⚠️ Missing |

#### 2.2 Menu Browsing 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View menu | Tap on seller → View menu | Display menu items with prices | ⚠️ Missing |
| Browse categories | Scroll through menu categories | Show items by category | ⚠️ Missing |
| View item details | Tap on menu item | Show description, price, image | ⚠️ Missing |
| Item availability indicator | View menu | Unavailable items marked/grayed | ⚠️ Missing |

#### 2.3 Cart & Ordering 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Add item to cart | Tap "Add" on menu item | Item added, cart badge updates | ✅ Exists |
| View cart | Tap cart icon | Show all cart items with totals | ⚠️ Missing |
| Update quantity in cart | Tap +/- on cart item | Quantity updates, total recalculates | ⚠️ Missing |
| Remove item from cart | Tap remove/delete on cart item | Item removed, total updates | ✅ Exists |
| Empty cart state | Remove all items | Show "Cart is empty" message | ⚠️ Missing |
| Cart persists | Add items → Close app → Reopen | Cart items still present | ⚠️ Missing |
| Minimum order validation | Try checkout below minimum | Show error "Minimum order ₹X" | ⚠️ Missing |
| Apply coupon code | Enter valid coupon → Apply | Discount applied, total updates | ⚠️ Missing |
| Invalid coupon code | Enter invalid coupon → Apply | Show error "Invalid coupon" | ⚠️ Missing |
| Remove coupon | Tap remove coupon | Discount removed, total restores | ⚠️ Missing |

#### 2.4 Checkout & Payment 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Navigate to checkout | Tap "Checkout" from cart | Show checkout screen | ⚠️ Missing |
| Delivery address validation | Proceed without address | Prompt to add delivery address | ⚠️ Missing |
| Add delivery address | Fill address form → Save | Address saved, return to checkout | ⚠️ Missing |
| Select payment method - Card | Choose card payment | Show card input form | ⚠️ Missing |
| Select payment method - Cash | Choose cash on delivery | Enable "Place Order" | ⚠️ Missing |
| Select payment method - UPI | Choose UPI | Show UPI ID input | ⚠️ Missing |
| Place order | Complete checkout → Place order | Order created, show confirmation | ⚠️ Missing |
| Order confirmation screen | After placing order | Show order ID, estimated time, items | ⚠️ Missing |
| Payment failure handling | Simulate payment failure | Show error, keep order in pending | ⚠️ Missing |

#### 2.5 Order Tracking 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View active orders | Navigate to orders → Active tab | Show in-progress orders | ⚠️ Missing |
| View order details | Tap on active order | Show items, status, timeline | ⚠️ Missing |
| Real-time status updates | Wait for seller to update status | Order status updates automatically | ⚠️ Missing |
| Cancel order | Tap "Cancel Order" (if allowed) | Order canceled, refund initiated | ⚠️ Missing |
| View order history | Navigate to orders → Past tab | Show completed orders | ⚠️ Missing |
| Reorder from history | Tap "Reorder" on past order | Items added to cart | ⚠️ Missing |

#### 2.6 Reviews & Ratings 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Rate completed order | Order delivered → Rate prompt | Show rating dialog (1-5 stars) | ⚠️ Missing |
| Submit review | Enter review text → Submit | Review submitted successfully | ⚠️ Missing |
| Review validation | Try to submit empty review | Show error "Review cannot be empty" | ⚠️ Missing |
| View seller reviews | On seller profile → Reviews tab | Show all customer reviews | ⚠️ Missing |
| Sort reviews | Select "Most recent/Highest rated" | Reviews reordered | ⚠️ Missing |
| Report inappropriate review | Long press review → Report | Show report dialog | ⚠️ Missing |

### 3. Seller Flows

#### 3.1 Business Onboarding 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Navigate to seller signup | Select "I'm a Seller" on signup | Show business registration form | ⚠️ Missing |
| Create business profile | Fill business details → Submit | Business profile created | ⚠️ Missing |
| Upload business logo | Tap upload → Select image | Logo uploaded, preview shown | ⚠️ Missing |
| Set business hours | Configure operating hours | Hours saved | ⚠️ Missing |
| Complete onboarding wizard | Step through all onboarding screens | Business account activated | ⚠️ Missing |

#### 3.2 Menu Management 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View menu editor | Navigate to Menu tab | Show menu items list | ⚠️ Missing |
| Add new menu item | Tap "Add Item" → Fill details → Save | Item added to menu | ⚠️ Missing |
| Upload item photo | Tap upload → Select image | Photo uploaded, shown in preview | ⚠️ Missing |
| Edit menu item | Tap item → Edit → Save | Changes saved | ⚠️ Missing |
| Delete menu item | Swipe item → Delete → Confirm | Item removed from menu | ⚠️ Missing |
| Toggle item availability | Switch availability toggle | Item marked available/unavailable | ⚠️ Missing |
| Create category | Tap "Add Category" → Enter name | Category created | ⚠️ Missing |
| Organize items by category | Drag items to categories | Items reorganized | ⚠️ Missing |
| OCR menu import | Upload menu photo → OCR process | Items extracted and added | ⚠️ Missing |

#### 3.3 Order Management 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View incoming orders | Navigate to Orders tab | Show new orders with notification | ⚠️ Missing |
| Accept order | Tap "Accept" on new order | Order accepted, notify customer | ⚠️ Missing |
| Reject order | Tap "Reject" → Provide reason | Order rejected, refund customer | ⚠️ Missing |
| Mark order preparing | Tap "Preparing" | Status updated to preparing | ⚠️ Missing |
| Mark order ready | Tap "Ready for Pickup" | Status updated, notify delivery | ⚠️ Missing |
| Order notification sound | New order arrives | Play notification sound | ⚠️ Missing |
| View order details | Tap on order | Show items, customer info, special instructions | ⚠️ Missing |

#### 3.4 Analytics Dashboard 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View dashboard | Navigate to Dashboard tab | Show today's stats (orders, revenue) | ⚠️ Missing |
| View sales chart | Scroll to charts section | Display sales graph (daily/weekly/monthly) | ⚠️ Missing |
| View popular items | Check popular items section | Show top 5 items by orders | ⚠️ Missing |
| Filter by date range | Select date range | Update stats for selected period | ⚠️ Missing |

#### 3.5 Payouts & Earnings 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View earnings | Navigate to Payouts tab | Show pending, completed earnings | ⚠️ Missing |
| Request payout | Tap "Request Payout" → Confirm | Payout requested, show pending | ⚠️ Missing |
| View payout history | Scroll to history | Show past payouts with dates | ⚠️ Missing |
| Setup payment processor | Navigate to settings → Payments | Configure Stripe/Razorpay | ⚠️ Missing |

---

## Phase 2: Advanced Features

### 4. Referral System

#### 4.1 Generate & Share Referrals 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View referral code | Navigate to Referrals | Show personal referral code | ⚠️ Missing |
| Share referral code | Tap "Share" → Select app | Share dialog opens with code | ⚠️ Missing |
| Copy referral code | Tap "Copy Code" | Code copied to clipboard | ⚠️ Missing |
| Track referral stats | View referrals screen | Show total referrals, pending rewards | ⚠️ Missing |

#### 4.2 Apply Referral Code 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Enter referral code on signup | Signup → Enter referral code → Submit | Code validated, bonus applied | ⚠️ Missing |
| Invalid referral code | Enter invalid code → Submit | Show error "Invalid code" | ⚠️ Missing |
| Expired referral code | Enter expired code → Submit | Show error "Code expired" | ⚠️ Missing |

#### 4.3 Redeem Referral Rewards 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View earned rewards | Navigate to rewards | Show available credits | ⚠️ Missing |
| Apply reward to order | At checkout → Select reward | Discount applied | ⚠️ Missing |
| Reward expiry notification | Reward about to expire | Show notification | ⚠️ Missing |

### 5. Coupons & Promotions

#### 5.1 Customer - Apply Coupons 🔴 P0
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View available coupons | At checkout → Tap "View Coupons" | Show applicable coupons | ⚠️ Missing |
| Apply coupon | Select coupon → Apply | Discount applied to order | ⚠️ Missing |
| Coupon with min order requirement | Apply coupon below minimum | Show error "Min order ₹X required" | ⚠️ Missing |
| Expired coupon | Try to apply expired coupon | Show error "Coupon expired" | ⚠️ Missing |
| First-time user coupon | First order → Apply new user coupon | Extra discount applied | ⚠️ Missing |

#### 5.2 Seller - Create Coupons 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Create new coupon | Navigate to Coupons → Add → Fill details | Coupon created | ⚠️ Missing |
| Set coupon constraints | Configure min order, expiry, usage limit | Constraints saved | ⚠️ Missing |
| Edit coupon | Tap coupon → Edit → Save | Changes saved | ⚠️ Missing |
| Deactivate coupon | Toggle coupon active/inactive | Status updated | ⚠️ Missing |
| View coupon usage stats | Tap on coupon → View stats | Show usage count, revenue impact | ⚠️ Missing |

### 6. Delivery Integration

#### 6.1 Delivery Tracking 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| View delivery status | Order in delivery → Track | Show delivery partner info, ETA | ⚠️ Missing |
| Live location tracking | View map | Show delivery partner's live location | ⚠️ Missing |
| ETA updates | Wait during delivery | ETA updates as partner moves | ⚠️ Missing |
| Delivery completed | Order delivered → Confirm | Status updated to delivered | ⚠️ Missing |
| Contact delivery partner | Tap "Call" on tracking screen | Initiate call to delivery partner | ⚠️ Missing |

### 7. WhatsApp Notifications

#### 7.1 Order Notifications 🟡 P1
| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| Order confirmation via WhatsApp | Place order | Receive WhatsApp confirmation | ⚠️ Missing |
| Status update notifications | Order status changes | Receive WhatsApp updates | ⚠️ Missing |
| Delivery notification | Order out for delivery | Receive WhatsApp notification | ⚠️ Missing |
| Opt-out of notifications | Disable WhatsApp notifications | No longer receive messages | ⚠️ Missing |

---

## Test Execution Plan

### Week 1: Foundation & Core Auth
- ✅ Day 1-2: Setup page objects, fix existing auth tests
- ⚠️ Day 3-4: Complete authentication flows (login, signup, password reset)
- ⚠️ Day 5: Social auth, profile management

### Week 2: Customer Flows
- ⚠️ Day 1-2: Marketplace browsing, search, filters
- ⚠️ Day 3: Cart & ordering
- ⚠️ Day 4: Checkout & payment
- ⚠️ Day 5: Order tracking, reviews

### Week 3: Seller Flows
- ⚠️ Day 1: Business onboarding
- ⚠️ Day 2-3: Menu management
- ⚠️ Day 4: Order management
- ⚠️ Day 5: Analytics, payouts

### Week 4: Phase 2 Features
- ⚠️ Day 1: Referral system
- ⚠️ Day 2: Coupons & promotions
- ⚠️ Day 3: Delivery tracking
- ⚠️ Day 4: WhatsApp integration
- ⚠️ Day 5: Android parity, CI integration

---

## Success Criteria

- ✅ All P0 tests passing
- ✅ 80%+ P1 tests passing
- ✅ Tests run in CI on every PR
- ✅ Page objects implemented for maintainability
- ✅ Both iOS and Android have equivalent coverage
- ✅ Test execution time < 15 minutes

---

## Notes

**Legend**:
- ✅ Implemented and passing
- ⚠️ Missing/needs implementation
- ❌ Exists but broken

**Last Updated**: 2025-11-17
