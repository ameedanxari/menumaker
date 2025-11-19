# Compilation Errors Breakdown & Fix Plan

**Generated:** 2025-11-19
**Status:** In Progress
**Total Errors:** 35 across 3 files

---

## File 1: NotificationsScreen.kt (13 errors)

### Error Group A: Missing ViewModel State Properties

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 39 | `Unresolved reference: notificationsState` | NotificationViewModel missing state property | Add `notificationsState: StateFlow<List<NotificationDto>>` |
| 313 | `Unresolved reference: setOrderNotificationsEnabled` | Missing setter method | Add method to NotificationViewModel |
| 319 | `Unresolved reference: setPromotionNotificationsEnabled` | Missing setter method | Add method to NotificationViewModel |
| 325 | `Unresolved reference: setReviewNotificationsEnabled` | Missing setter method | Add method to NotificationViewModel |
| 340 | `Unresolved reference: setPushNotificationsEnabled` | Missing setter method | Add method to NotificationViewModel |
| 346 | `Unresolved reference: setEmailNotificationsEnabled` | Missing setter method | Add method to NotificationViewModel |

**Fix Strategy:**
1. Read NotificationViewModel.kt to check existing structure
2. Add missing StateFlow property `notificationsState`
3. Add all 5 missing setter methods for notification preferences
4. Ensure methods update backend via repository

---

### Error Group B: Type Inference Issues

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 92 | `One type argument expected. Use 'Success<*>'` | Resource.Success missing type parameter | Change to `is Resource.Success<List<NotificationDto>>` |
| 131 | `Overload resolution ambiguity: items()` | LazyColumn items() needs explicit type | Use `items(notifications) { notification ->` with explicit lambda |
| 133 | `Unresolved reference: it` | Lambda parameter not inferred | Use explicit parameter name `notification` |
| 134 | `Cannot infer a type for this parameter` | Type inference failure in lambda | Explicitly type the lambda parameter |

**Fix Strategy:**
1. Read NotificationsScreen.kt lines 85-140
2. Fix Resource.Success type parameter
3. Refactor items() call with explicit lambda parameter
4. Ensure NotificationDto type is properly imported

---

### Error Group C: Composable Context Issues

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 135 | `@Composable invocations can only happen from context` | Composable call outside composable scope | Move into `items { }` lambda body |
| 139 | `@Composable invocations can only happen from context` | Composable call outside composable scope | Move into `items { }` lambda body |

**Fix Strategy:**
1. Ensure all Composable calls are within the LazyColumn items lambda
2. Check that itemContent lambda is properly structured

---

## File 2: ProfileScreen.kt (5 errors)

### Error Group D: Missing ViewModel Properties

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 46 | `Unresolved reference: currentUser` | ProfileViewModel or AuthViewModel missing property | Add `currentUser: StateFlow<UserDto?>` to appropriate ViewModel |

**Fix Strategy:**
1. Check which ViewModel ProfileScreen uses (ProfileViewModel or AuthViewModel)
2. Add currentUser StateFlow property
3. Ensure it's updated from repository/auth state

---

### Error Group E: Composable Context & Type Inference

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 145 | `Cannot infer a type for this parameter` | Lambda type inference failure | Add explicit type to lambda parameter |
| 146 | `@Composable invocations can only happen from context` | Composable call outside composable scope | Restructure code to call within composable lambda |
| 155 | `Cannot infer a type for this parameter` | Lambda type inference failure | Add explicit type to lambda parameter |
| 156 | `@Composable invocations can only happen from context` | Composable call outside composable scope | Restructure code to call within composable lambda |

**Fix Strategy:**
1. Read ProfileScreen.kt lines 140-160
2. Fix lambda parameter types
3. Ensure Composable calls are within proper scope (likely LazyColumn items)

---

## File 3: ReferralsScreen.kt (17 errors)

### Error Group F: Missing Model Classes

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 27 | `Unresolved reference: ReferralHistoryDto` | Model class doesn't exist | Create ReferralHistoryDto in models package |
| 29 | `Unresolved reference: ReferralStatus` | Enum doesn't exist | Create ReferralStatus enum |
| 463 | `Unresolved reference: ReferralHistoryDto` | Same as line 27 | Fixed with above |

**Fix Strategy:**
1. Check iOS ReferralModels.swift for structure
2. Create ReferralHistoryDto data class
3. Create ReferralStatus enum (likely: PENDING, COMPLETED, EXPIRED)
4. Create in data/remote/models/ReferralModels.kt

---

### Error Group G: Missing ViewModel State Properties

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 48 | `Unresolved reference: stats` | ReferralViewModel missing property | Add `stats: StateFlow<ReferralStats?>` |
| 49 | `Unresolved reference: referralHistory` | ReferralViewModel missing property | Add `referralHistory: StateFlow<List<ReferralHistoryDto>>` |
| 50 | `Unresolved reference: leaderboard` | ReferralViewModel missing property | Add `leaderboard: StateFlow<List<LeaderboardEntry>>` |
| 51 | `Unresolved reference: isLoading` | ReferralViewModel missing property | Add `isLoading: StateFlow<Boolean>` |
| 52 | `Unresolved reference: referralCodeMessage` | ReferralViewModel missing property | Add `referralCodeMessage: StateFlow<String?>` |
| 53 | `Unresolved reference: referralCodeSuccess` | ReferralViewModel missing property | Add `referralCodeSuccess: StateFlow<Boolean>` |
| 275 | `Unresolved reference: availableCreditsCents` | Missing property on stats object | Add to ReferralStats model |
| 301 | `Unresolved reference: pendingRewardsCents` | Missing property on stats object | Add to ReferralStats model |
| 355 | `Unresolved reference: monthlyReferrals` | Missing property on stats object | Add to ReferralStats model |

**Fix Strategy:**
1. Read ReferralViewModel.kt to check existing structure
2. Check iOS ReferralViewModel.swift for reference
3. Add all missing StateFlow properties
4. Ensure ReferralStats model has all required fields
5. Wire up to repository for data loading

---

### Error Group H: Missing ViewModel Methods

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 61 | `Unresolved reference: refreshData` | ReferralViewModel missing method | Add `fun refreshData()` method |
| 106 | `Unresolved reference: getReferralCode` | ReferralViewModel missing method | Add `fun getReferralCode()` method |
| 132 | `Unresolved reference: applyReferralCode` | ReferralViewModel missing method | Add `fun applyReferralCode(code: String)` method |

**Fix Strategy:**
1. Add refreshData() to reload all referral data
2. Add getReferralCode() to fetch user's referral code
3. Add applyReferralCode() to submit referral code
4. Connect to ReferralRepository for API calls

---

### Error Group I: Type Inference

| Line | Error | Root Cause | Fix Required |
|------|-------|------------|--------------|
| 496 | `Cannot infer a type for this parameter` | Lambda type inference failure | Add explicit type to lambda parameter |

**Fix Strategy:**
1. Read ReferralsScreen.kt line 496
2. Add explicit type annotation to lambda parameter

---

## Fix Priority Order

### Phase 1: Model Classes (Foundation)
1. ✅ **DONE:** UserDto (already fixed)
2. 🔲 **TODO:** Create ReferralHistoryDto
3. 🔲 **TODO:** Create ReferralStatus enum
4. 🔲 **TODO:** Verify/update ReferralStats model

### Phase 2: ViewModel Properties & Methods
5. 🔲 **TODO:** Fix NotificationViewModel (add state + 5 setter methods)
6. 🔲 **TODO:** Fix ProfileViewModel/AuthViewModel (add currentUser)
7. 🔲 **TODO:** Fix ReferralViewModel (add 6 state properties + 3 methods)

### Phase 3: Screen UI Fixes
8. 🔲 **TODO:** Fix NotificationsScreen.kt type inference & composable context
9. 🔲 **TODO:** Fix ProfileScreen.kt type inference & composable context
10. 🔲 **TODO:** Fix ReferralsScreen.kt type inference

### Phase 4: Validation
11. 🔲 **TODO:** Compile and verify no errors
12. 🔲 **TODO:** Run unit tests
13. 🔲 **TODO:** Commit and push

---

## Testing Strategy

After each fix:
- Verify compilation with `./gradlew assembleDebug`
- Check for new errors introduced
- Ensure no functionality regression
- Mock network calls appropriately

## Notes

- All network calls must be mocked in tests
- Follow existing patterns in codebase
- Match iOS implementation where applicable
- Maintain clean architecture (ViewModel → Repository → API)
