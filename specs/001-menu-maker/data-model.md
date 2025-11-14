# Data Model: MenuMaker MVP

**Input**: Feature spec + Implementation plan  
**Updated**: 2025-11-10

---

## Entity Relationship Diagram

### Phase 1 (MVP)
```
User (1) ──┬─ (M) Business
           │
           └─ (M) BusinessSettings

Business (1) ──┬─ (M) Dish
               ├─ (M) DishCategory
               ├─ (M) Menu
               ├─ (M) Order
               ├─ (M) Payout
               └─ (M) Notification

Menu (1) ──┬─ (M) MenuItem (join table: Menu → Dish)
           └─ (M) Order (many orders can reference one menu)

Dish (1) ──┬─ (M) MenuItem
           ├─ (M) OrderItem (join table: Order → Dish + qty)
           ├─ (M) Image
           ├─ (1) CommonDish (optional reference to template)
           └─ (1) DishCategory (optional user-defined category)

DishCategory (1) ─ (M) Dish

CommonDish (1) ─ (M) Dish (many dishes can be created from one template)

Order (1) ──┬─ (M) OrderItem (join table with Dish)
            ├─ (M) OrderNotification
            └─ (M) OrderStatusHistory (audit trail)

Payout (M) ─ (1) Business
```

### Phase 2 Extensions
```
User (1) ──┬─ (M) Referral (as referrer)
           ├─ (M) Referral (as referee)
           └─ (M) UserConsent

Business (1) ─ (M) Review

Order (1) ─ (1) Review (optional)
```

### Phase 3 Extensions
```
AdminUser (1) ──┬─ (M) AuditLog
                ├─ (M) SupportTicket (as assigned_to)
                └─ (M) ContentFlag (as moderator)

User (1) ─ (M) SupportTicket (as requester)

SupportTicket (1) ─ (M) TicketMessage

FeatureFlag (standalone - no relations)

ContentFlag (M) ─ (1) AdminUser (as moderator)
```

---

## Entity Schemas (TypeScript + TypeORM)

### User

**Purpose**: Authentication and seller profile identity

```typescript
@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500 })
  password_hash: string; // bcrypt

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @OneToOne(() => Business, (business) => business.owner, { cascade: true })
  business: Business;

  // Relations
  @OneToMany(() => Notification, (notif) => notif.user)
  notifications: Notification[];
}

// Zod validation schema (runtime)
const UserCreateSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
```

**Constraints**:
- email: unique, lowercase, validated
- password_hash: bcrypt hashed (min cost 10)

**Indexes**: (email), (created_at)

---

### Business

**Purpose**: Seller business profile and branding

```typescript
@Entity()
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.business, { onDelete: 'CASCADE' })
  owner: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string; // URL-friendly: lowercase, no spaces

  @Column({ type: 'varchar', length: 2048, nullable: true })
  logo_url: string; // S3 URL

  @Column({ type: 'varchar', length: 7, default: '#000000' })
  primary_color: string; // Hex color for branding

  @Column({ type: 'varchar', length: 3, default: 'en' })
  locale: string; // en, hi, etc.

  @Column({ type: 'varchar', length: 30, default: 'Asia/Kolkata' })
  timezone: string;

  @Column({ type: 'text', nullable: true })
  description: string; // Short bio (optional)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  // Relations
  @OneToMany(() => Dish, (dish) => dish.business, { cascade: true })
  dishes: Dish[];

  @OneToMany(() => DishCategory, (category) => category.business, { cascade: true })
  dish_categories: DishCategory[];

  @OneToMany(() => Menu, (menu) => menu.business, { cascade: true })
  menus: Menu[];

  @OneToMany(() => Order, (order) => order.business)
  orders: Order[];

  @OneToMany(() => Payout, (payout) => payout.business)
  payouts: Payout[];

  @OneToOne(() => BusinessSettings, (settings) => settings.business, { cascade: true })
  settings: BusinessSettings;
}

const BusinessCreateSchema = z.object({
  name: z.string().min(1, 'Business name required').max(255),
  description: z.string().max(1000).optional(),
  logo_url: z.string().url('Invalid logo URL').optional(),
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color'),
});
```

**Constraints**:
- slug: unique, auto-generated from name or user input (validation: alphanumeric + hyphens, 3–100 chars)
- primary_color: valid hex code

**Indexes**: (slug), (owner_id), (created_at)

---

### BusinessSettings

**Purpose**: Delivery rules, payment info, and seller configuration

```typescript
@Entity()
export class BusinessSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Business, (business) => business.settings, { onDelete: 'CASCADE' })
  business: Business;

  // Delivery Configuration
  @Column({ type: 'varchar', default: 'flat' }) // 'flat', 'distance', 'free'
  delivery_type: string;

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents: number; // Flat fee in cents (INR = paisa)

  @Column({ type: 'integer', nullable: true })
  delivery_base_fee_cents: number; // For distance-based

  @Column({ type: 'integer', nullable: true })
  delivery_per_km_cents: number; // Per km rate

  @Column({ type: 'integer', nullable: true })
  min_order_free_delivery_cents: number; // Min order to waive delivery

  @Column({ type: 'varchar', default: 'round' }) // 'round', 'ceil', 'floor'
  distance_rounding: string;

  // Payment Configuration
  @Column({ type: 'varchar', default: 'cash' }) // 'cash', 'bank_transfer', 'upi', 'other'
  payment_method: string;

  @Column({ type: 'text', nullable: true })
  payment_instructions: string; // Bank details, UPI ID, etc. (encrypted)

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  // Order Defaults
  @Column({ type: 'boolean', default: false })
  auto_confirm_orders: boolean; // Phase 2

  @Column({ type: 'boolean', default: false })
  enable_customer_notes: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}

const BusinessSettingsSchema = z.object({
  delivery_type: z.enum(['flat', 'distance', 'free']),
  delivery_fee_cents: z.number().int().min(0),
  payment_method: z.enum(['cash', 'bank_transfer', 'upi', 'other']),
  payment_instructions: z.string().max(1000).optional(),
  currency: z.string().length(3),
});
```

**Constraints**:
- payment_instructions: encrypted at rest (AES-256)
- delivery_fee_cents: >= 0

**Indexes**: (business_id)

---

### Dish

**Purpose**: Menu item definition with allergen and image info

```typescript
@Entity()
export class Dish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.dishes, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text' })
  description: string; // 50–500 chars

  @Column({ type: 'integer' })
  price_cents: number; // In minor currency unit (paisa for INR)

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'simple-array', default: '[]' }) // ['dairy', 'nuts', 'gluten', 'vegan']
  allergen_tags: string[];

  @Column({ type: 'simple-array', default: '[]' })
  image_urls: string[]; // S3 URLs; first is primary

  @Column({ type: 'boolean', default: true })
  is_available: boolean; // Can be toggled off temporarily

  @Column({ type: 'integer', default: 0 })
  position: number; // For ordering in menu

  // New: Reference to common dish template (if imported)
  @ManyToOne(() => CommonDish, { nullable: true })
  common_dish: CommonDish;

  @Column({ type: 'uuid', nullable: true })
  common_dish_id: string; // Tracks which template was used (for analytics)

  // New: Reference to user-defined category
  @ManyToOne(() => DishCategory, (category) => category.dishes, { nullable: true })
  category: DishCategory;

  @Column({ type: 'uuid', nullable: true })
  category_id: string; // User-defined category (Appetizers, Mains, etc.)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  // Relations
  @OneToMany(() => MenuItem, (item) => item.dish, { cascade: true })
  menu_items: MenuItem[];

  @OneToMany(() => OrderItem, (item) => item.dish)
  order_items: OrderItem[];
}

const DishCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(50).max(500),
  price_cents: z.number().int().min(0),
  allergen_tags: z.array(z.string()).optional(),
  image_urls: z.array(z.string().url()).optional(),
});
```

**Constraints**:
- name: required, unique per business + created_at (allow same name at different times)
- price_cents: >= 0

**Indexes**: (business_id), (created_at), (category_id), (common_dish_id)

---

### CommonDish

**Purpose**: Pre-populated dish templates for quick import (Phase 1)

```typescript
@Entity()
export class CommonDish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // "Samosa", "Masala Dosa", "Butter Chicken", etc.

  @Column({ type: 'text', nullable: true })
  description: string; // Template description

  @Column({ type: 'varchar', length: 50 })
  category: string; // 'north_indian', 'south_indian', 'chinese', 'bakery', 'beverages', 'desserts'

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory: string; // 'appetizers', 'mains', 'desserts', 'beverages', 'breads'

  @Column({ type: 'integer', nullable: true })
  min_price_cents: number; // Suggested minimum price (e.g., 1000 = ₹10)

  @Column({ type: 'integer', nullable: true })
  max_price_cents: number; // Suggested maximum price (e.g., 5000 = ₹50)

  @Column({ type: 'simple-array', nullable: true })
  default_allergens: string[]; // ["gluten", "dairy", "nuts", etc.]

  @Column({ type: 'simple-array', nullable: true })
  aliases: string[]; // ["Samsa", "Sambosa"] for search matching

  @Column({ type: 'integer', default: 0 })
  popularity_score: number; // 0-100, used for sorting (higher = more popular)

  @Column({ type: 'text', nullable: true })
  image_url: string; // Optional stock image URL

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // ["vegetarian", "spicy", "fried", "gluten-free", etc.]

  @Column({ type: 'boolean', default: true })
  active: boolean; // Allow disabling outdated dishes

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}

const CommonDishSearchSchema = z.object({
  category: z.enum(['north_indian', 'south_indian', 'chinese', 'bakery', 'beverages', 'desserts']).optional(),
  subcategory: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});
```

**Constraints**:
- name: required, unique within category
- min_price_cents <= max_price_cents (when both present)
- popularity_score: 0-100 range
- active: false to hide from template browser

**Indexes**: (category), (active), (popularity_score DESC)

**Seed Data**: ~200 dishes pre-populated via migration (see common-dishes-catalog.md)

---

### DishCategory

**Purpose**: User-defined categories to organize menu (e.g., Appetizers, Mains, Chef's Specials)

```typescript
@Entity()
export class DishCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string; // "Appetizers", "Main Course", "Chef's Specials", etc.

  @Column({ type: 'text', nullable: true })
  description: string; // Optional category description

  @Column({ type: 'integer', default: 0 })
  sort_order: number; // Display order (0 = first, higher = later)

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'uuid' })
  business_id: string;

  @Column({ type: 'boolean', default: false })
  is_default: boolean; // True for system-suggested categories (Appetizers, Mains, Desserts, Beverages)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  // Relations
  @OneToMany(() => Dish, (dish) => dish.category)
  dishes: Dish[];
}

const DishCategoryCreateSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).default(0),
});
```

**Constraints**:
- Unique: (business_id, name) - prevent duplicate category names per business
- sort_order: used for display ordering in menu

**Indexes**: (business_id), (sort_order)

**Default Categories**: On business creation, optionally seed with:
- Appetizers (sort_order: 0, is_default: true)
- Main Course (sort_order: 1, is_default: true)
- Desserts (sort_order: 2, is_default: true)
- Beverages (sort_order: 3, is_default: true)

---

### Menu

**Purpose**: Weekly menu grouping dishes

```typescript
@Entity()
export class Menu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.menus, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'date' })
  start_date: Date;

  @Column({ type: 'date' })
  end_date: Date;

  @Column({ type: 'varchar', default: 'draft' }) // 'draft', 'published', 'archived'
  status: string;

  @Column({ type: 'integer', default: 0 })
  version: number; // Track changes

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  // Relations
  @OneToMany(() => MenuItem, (item) => item.menu, { cascade: true })
  menu_items: MenuItem[];

  @OneToMany(() => Order, (order) => order.menu)
  orders: Order[];
}

const MenuCreateSchema = z.object({
  title: z.string().min(1).max(255),
  start_date: z.date(),
  end_date: z.date(),
}).refine(data => data.end_date > data.start_date, 'End date must be after start date');
```

**Constraints**:
- Only ONE active (published) menu per business at a time (checked in service layer)
- start_date < end_date

**Indexes**: (business_id), (status), (created_at)

---

### MenuItem

**Purpose**: Join table linking dishes to menus (with qty/availability override)

```typescript
@Entity()
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Menu, (menu) => menu.menu_items, { onDelete: 'CASCADE' })
  menu: Menu;

  @ManyToOne(() => Dish, (dish) => dish.menu_items)
  dish: Dish;

  @Column({ type: 'integer', nullable: true })
  price_override_cents: number; // If different from dish base price

  @Column({ type: 'integer', default: 0 })
  position: number; // Order within menu

  @Column({ type: 'boolean', default: true })
  is_available: boolean; // Can override dish availability

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Note: No PK, compound unique (menu_id, dish_id) enforced at application level
  @Index(['menu_id', 'dish_id'], { unique: true })
  menuDishIndex: string;
}
```

**Constraints**:
- Unique: (menu_id, dish_id)
- price_override_cents: >= 0 or null (null = use dish price)

---

### Order

**Purpose**: Customer order with items and status

```typescript
@Entity()
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.orders, { onDelete: 'CASCADE' })
  business: Business;

  @ManyToOne(() => Menu)
  menu: Menu;

  @Column({ type: 'varchar', length: 255 })
  customer_name: string;

  @Column({ type: 'varchar', length: 20 })
  customer_phone: string; // E.164 or local format

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_email: string;

  @Column({ type: 'varchar' }) // 'pickup', 'delivery'
  delivery_type: string;

  @Column({ type: 'text', nullable: true })
  delivery_address: string;

  @Column({ type: 'integer' })
  total_cents: number; // Calculated: sum(items) + delivery_fee

  @Column({ type: 'integer', default: 0 })
  delivery_fee_cents: number;

  @Column({ type: 'varchar' }) // 'cash', 'bank_transfer', 'upi', 'other'
  payment_method: string;

  @Column({ type: 'varchar', default: 'unpaid' }) // 'unpaid', 'paid'
  payment_status: string;

  @Column({ type: 'varchar', default: 'pending' }) // 'pending', 'confirmed', 'ready', 'fulfilled', 'cancelled'
  order_status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  fulfilled_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  anonymized_at: Date; // GDPR: Set when user deletes account (PII anonymized)

  // Relations
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => OrderNotification, (notif) => notif.order)
  notifications: OrderNotification[];
}

const OrderCreateSchema = z.object({
  customer_name: z.string().min(1).max(255),
  customer_phone: z.string().regex(/^[+]?[0-9]{1,15}$/),
  customer_email: z.string().email().optional(),
  delivery_type: z.enum(['pickup', 'delivery']),
  delivery_address: z.string().max(1000).optional(),
  notes: z.string().max(500).optional(),
  // items: [{ dish_id, quantity, price_at_purchase }] — validated separately
});
```

**Constraints**:
- total_cents: >= delivery_fee_cents
- payment_status: 'unpaid' | 'paid'
- order_status transitions: pending → confirmed → ready → fulfilled (or cancelled at any stage)
- delivery_address: required if delivery_type = 'delivery'

**Indexes**: (business_id), (menu_id), (created_at), (order_status)

---

### OrderItem

**Purpose**: Join table with quantity and price snapshot

```typescript
@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @ManyToOne(() => Dish)
  dish: Dish;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'integer' })
  price_at_purchase_cents: number; // Snapshot of dish price at order time

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}

const OrderItemSchema = z.object({
  dish_id: z.string().uuid(),
  quantity: z.number().int().min(1),
});
```

**Constraints**:
- quantity: > 0
- price_at_purchase_cents: snapshot (immutable)

---

### OrderNotification

**Purpose**: Track email/SMS notifications for orders (audit trail, retry logic)

```typescript
@Entity()
export class OrderNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.notifications, { onDelete: 'CASCADE' })
  order: Order;

  @Column({ type: 'varchar' }) // 'email', 'sms', 'whatsapp' (Phase 2+)
  notification_type: string;

  @Column({ type: 'varchar', length: 255 })
  recipient: string; // Email or phone

  @Column({ type: 'varchar', default: 'pending' }) // 'pending', 'sent', 'failed'
  status: string;

  @Column({ type: 'integer', default: 0 })
  retry_count: number;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  // Relations
  @ManyToOne(() => User)
  user: User; // Seller who should be notified (Phase 1: customer, Phase 2: seller)
}
```

**Constraints**:
- retry_count: auto-incremented on each retry (max 3)
- status: 'pending' → 'sent' (or 'failed' after max retries)

---

### Payout

**Purpose**: Track seller earnings and manual payout periods

```typescript
@Entity()
export class Payout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.payouts, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'date' })
  period_start: Date;

  @Column({ type: 'date' })
  period_end: Date;

  @Column({ type: 'integer' })
  gross_amount_cents: number; // Sum of all order totals in period

  @Column({ type: 'integer', default: 0 })
  platform_fee_cents: number; // Always 0 for MVP; Phase 2

  @Column({ type: 'integer' })
  net_amount_cents: number; // gross - platform_fee

  @Column({ type: 'varchar', default: 'pending' }) // 'pending', 'completed', 'failed'
  status: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
```

**Constraints**:
- net_amount_cents = gross - platform_fee
- period_start < period_end

---

## Validation Rules (Zod Schemas)

All endpoints use Zod schemas for runtime validation with clear error messages for users.

```typescript
// Example: Order Creation Validation
const CreateOrderSchema = z.object({
  menu_id: z.string().uuid('Invalid menu ID'),
  customer_name: z.string().min(1, 'Name required').max(255),
  customer_phone: z.string()
    .regex(/^[+]?[0-9]{1,15}$/, 'Phone must be E.164 format or local (up to 15 digits)'),
  customer_email: z.string().email('Invalid email').optional(),
  delivery_type: z.enum(['pickup', 'delivery'], { errorMap: () => ({ message: 'Choose pickup or delivery' }) }),
  delivery_address: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      dish_id: z.string().uuid('Invalid dish ID'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
    })
  ).min(1, 'Order must have at least one item'),
  notes: z.string().max(500).optional(),
}).refine(
  data => data.delivery_type === 'pickup' || data.delivery_address,
  { message: 'Delivery address required for delivery orders', path: ['delivery_address'] }
);
```

---

## Database Migrations (TypeORM)

Each entity migration creates table + indexes. Migrations versioned and run on deploy.

**Initial Migration**: Create all tables and relationships (001-create-initial-schema.ts)

```typescript
// pseudo-code
export class CreateInitialSchema implements MigrationInterface {
  up: async (queryRunner) => {
    await queryRunner.createTable(User table with indexes);
    await queryRunner.createTable(Business table);
    await queryRunner.createTable(BusinessSettings table);
    // ... etc
  };
  down: async (queryRunner) => {
    // Drop all tables in reverse order
  };
}
```

---

## Constraints & Business Rules (Service Layer)

- **One Active Menu per Business**: Service checks before publishing; archive previous.
- **Order Total Calculation**: `sum(items * price_at_order_time) + delivery_fee`
- **Delivery Fee Calculation**: Based on settings (flat, distance, or free); rounded per rule
- **Payment Status Lifecycle**: unpaid → paid (seller marks manually MVP)
- **Order Status Lifecycle**: pending → confirmed → ready → fulfilled (or cancelled)
- **Payout Calculation**: Monthly/weekly periods; sum fulfilled orders in period

---

## Indexes & Performance

**Phase 1 Indexes**:
- User: (email), (created_at), (referral_code), (account_status)
- Business: (slug), (owner_id), (created_at)
- Dish: (business_id), (created_at), (category_id), (common_dish_id)
- CommonDish: (category), (active), (popularity_score DESC)
- DishCategory: (business_id), (sort_order)
- Menu: (business_id), (status), (created_at)
- Order: (business_id), (menu_id), (created_at), (order_status)
- OrderItem: (order_id), (dish_id)
- OrderNotification: (order_id), (status), (created_at)
- Payout: (business_id), (created_at)

**Phase 2 Indexes**:
- Referral: (referral_code UNIQUE), (referrer_id, status), (referee_id), (created_at)
- UserConsent: (user_id, consent_type), (granted_at)
- Review: (business_id, is_visible), (order_id), (created_at), (moderation_status)

**Phase 3 Indexes**:
- AdminUser: (email UNIQUE), (role, is_active), (last_login_at)
- AuditLog: (admin_user_id, created_at), (action), (target_type, target_id), (created_at)
- SupportTicket: (status, assigned_to_id), (requester_id), (created_at), (priority, status)
- TicketMessage: (ticket_id, created_at), (sender_admin_id), (sender_user_id)
- FeatureFlag: (flag_key UNIQUE), (is_active)
- ContentFlag: (flag_type, target_id), (status), (created_at), (moderated_by_id)

**Query patterns to optimize**:
- GET /businesses/{id}/orders (filter by date, status) → Index (business_id, order_status, created_at)
- GET /menus/{id} (public menu with items) → (menu_id, position)
- GET /users/me/referrals (dashboard) → Index (referrer_id, status)
- GET /admin/users?status=active → Index (account_status, created_at)
- GET /admin/flags?status=pending → Index (status, created_at)
- GET /admin/audit-logs?admin_user_id=X → Index (admin_user_id, created_at)

---

## Data Retention & Privacy

- **User/Business Data**: Retain indefinitely (tombstone if deleted, not permanent removal)
- **Order Data**: Retain 3 years (for accounting/audit)
- **Notifications**: Purge after 30 days (sent status) or 3 days (failed status)
- **Payout Records**: Retain indefinitely

**PII Masking in Logs**:
- Email: first 3 chars + "***@…"
- Phone: last 4 digits only
- Payment details: never logged (reference only)

---

## Phase 2 Entities

### Referral

**Purpose**: Track referral program funnel and reward distribution (Phase 2)

```typescript
@Entity('referrals')
export class Referral {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 12, unique: true })
  referral_code: string; // e.g., "PRIYA2024"

  @ManyToOne(() => User) // Referrer (person who shared code)
  referrer: User;

  @Column({ type: 'uuid' })
  referrer_id: string;

  @ManyToOne(() => User, { nullable: true }) // Referee (person who signed up)
  referee: User;

  @Column({ type: 'uuid', nullable: true })
  referee_id: string; // Null until signup completed

  @Column({ type: 'varchar', default: 'link_clicked' })
  // 'link_clicked' → 'signup_started' → 'signup_completed' → 'first_menu_published'
  status: string;

  @Column({ type: 'varchar', nullable: true })
  referee_email: string; // Captured at signup

  @Column({ type: 'varchar', nullable: true })
  referee_phone: string;

  @Column({ type: 'varchar', default: 'free_pro_month' }) // 'free_pro_month' | 'account_credit'
  reward_type: string;

  @Column({ type: 'integer', default: 0 })
  reward_value_cents: number; // Rs. 299 for Pro, Rs. 500 for credit

  @Column({ type: 'boolean', default: false })
  reward_claimed: boolean; // True when reward applied

  @Column({ type: 'timestamp', nullable: true })
  reward_claimed_at: Date;

  @Column({ type: 'varchar', nullable: true })
  source: string; // 'whatsapp', 'sms', 'email', 'direct_link'

  @Column({ type: 'varchar', nullable: true })
  utm_source: string; // Track campaign source

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date; // When link first clicked

  @Column({ type: 'timestamp', nullable: true })
  signup_completed_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  first_menu_published_at: Date;
}
```

**Constraints**:
- referral_code: unique, 6-12 alphanumeric characters
- reward_claimed: only true after referee publishes first menu

**Indexes**: (referral_code), (referrer_id, status), (referee_id), (created_at)

---

### UserConsent

**Purpose**: GDPR consent tracking for data processing (Phase 2)

```typescript
@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 50 })
  consent_type: string; // 'marketing_emails', 'analytics', 'data_processing', 'terms_of_service'

  @Column({ type: 'boolean', default: false })
  granted: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  version: string; // Version of terms/policy (e.g., "v1.2")

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string; // IP when consent was given

  @Column({ type: 'text', nullable: true })
  user_agent: string; // Browser/device info

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  granted_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date;
}
```

**Constraints**:
- Immutable records (never update, only insert new records)
- granted: tracks current consent state

**Indexes**: (user_id, consent_type), (granted_at)

---

### Review

**Purpose**: Customer reviews for sellers (Phase 2-3)

```typescript
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'uuid' })
  business_id: string;

  @ManyToOne(() => Order, { nullable: true })
  order: Order;

  @Column({ type: 'uuid', nullable: true })
  order_id: string; // Optional: link to specific order

  @Column({ type: 'varchar', length: 255 })
  reviewer_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reviewer_email: string;

  @Column({ type: 'integer' })
  rating: number; // 1-5 stars

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'boolean', default: true })
  is_visible: boolean; // False if flagged/hidden

  @Column({ type: 'integer', default: 0 })
  flag_count: number; // Number of times flagged by users

  @Column({ type: 'varchar', default: 'approved' })
  moderation_status: string; // 'pending', 'approved', 'rejected'

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  moderated_at: Date;
}
```

**Constraints**:
- rating: 1-5 integer
- is_visible: auto-set to false if flag_count >= 3

**Indexes**: (business_id, is_visible), (order_id), (created_at), (moderation_status)

---

## Phase 3 Entities

### AdminUser

**Purpose**: Admin portal authentication and role-based access control (Phase 3)

```typescript
@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 500 })
  password_hash: string;

  @Column({ type: 'varchar', length: 255 })
  full_name: string;

  @Column({ type: 'varchar', default: 'support_agent' })
  // 'super_admin' | 'moderator' | 'support_agent'
  role: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  two_factor_secret: string; // For 2FA (TOTP)

  @Column({ type: 'boolean', default: false })
  two_factor_enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date;

  @Column({ type: 'varchar', length: 45, nullable: true })
  last_login_ip: string;

  @Column({ type: 'timestamp', nullable: true })
  password_changed_at: Date; // Track password rotation (required every 90 days)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by_admin_id: string; // Which admin created this account

  @OneToMany(() => AuditLog, log => log.admin_user)
  audit_logs: AuditLog[];
}
```

**Constraints**:
- email: unique
- two_factor_enabled: mandatory for all admin users
- password_changed_at: must be within 90 days

**Indexes**: (email), (role, is_active), (last_login_at)

---

### AuditLog

**Purpose**: Immutable audit trail of all admin actions (Phase 3)

```typescript
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AdminUser)
  admin_user: AdminUser;

  @Column({ type: 'uuid' })
  admin_user_id: string;

  @Column({ type: 'varchar', length: 50 })
  action: string; // 'ban_user', 'approve_flag', 'close_ticket', 'update_feature_flag', etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  target_type: string; // 'user', 'flag', 'ticket', 'feature_flag', etc.

  @Column({ type: 'uuid', nullable: true })
  target_id: string; // ID of affected resource

  @Column({ type: 'jsonb', nullable: true })
  details: object; // Additional context (reason, notes, before/after values, etc.)

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Constraints**:
- Immutable (no updates/deletes allowed)
- created_at: indexed for time-based queries

**Indexes**: (admin_user_id, created_at), (action), (target_type, target_id), (created_at)

---

### SupportTicket

**Purpose**: Customer support ticket management (Phase 3)

```typescript
@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  description: string; // Initial message

  @Column({ type: 'varchar', default: 'open' })
  // 'open' | 'in_progress' | 'waiting_on_customer' | 'closed'
  status: string;

  @Column({ type: 'varchar', default: 'medium' })
  // 'low' | 'medium' | 'high' | 'urgent'
  priority: string;

  @ManyToOne(() => User) // User who created ticket
  requester: User;

  @Column({ type: 'uuid' })
  requester_id: string;

  @Column({ type: 'varchar', length: 255 })
  requester_email: string;

  @ManyToOne(() => AdminUser, { nullable: true }) // Assigned admin
  assigned_to: AdminUser;

  @Column({ type: 'uuid', nullable: true })
  assigned_to_id: string;

  @Column({ type: 'timestamp', nullable: true })
  first_response_at: Date; // SLA tracking

  @Column({ type: 'timestamp', nullable: true })
  closed_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;

  @OneToMany(() => TicketMessage, msg => msg.ticket)
  messages: TicketMessage[];
}
```

**Constraints**:
- status transitions: open → in_progress → [waiting_on_customer] → closed
- first_response_at: set when first admin reply is sent

**Indexes**: (status, assigned_to_id), (requester_id), (created_at), (priority, status)

---

### TicketMessage

**Purpose**: Conversation messages within support tickets (Phase 3)

```typescript
@Entity('ticket_messages')
export class TicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SupportTicket, ticket => ticket.messages, { onDelete: 'CASCADE' })
  ticket: SupportTicket;

  @Column({ type: 'uuid' })
  ticket_id: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  is_internal_note: boolean; // True if admin-only note

  @Column({ type: 'varchar', length: 50 })
  sender_type: string; // 'admin' | 'user'

  @Column({ type: 'uuid', nullable: true })
  sender_admin_id: string; // If sent by admin

  @Column({ type: 'uuid', nullable: true })
  sender_user_id: string; // If sent by user

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Constraints**:
- sender_admin_id or sender_user_id must be set (not both)
- is_internal_note: true messages only visible to admins

**Indexes**: (ticket_id, created_at), (sender_admin_id), (sender_user_id)

---

### FeatureFlag

**Purpose**: Feature flag system for tier-based feature access and gradual rollouts (Phase 3)

```typescript
@Entity('feature_flags')
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  flag_key: string; // e.g., 'whatsapp_notifications', 'ocr_menu_import'

  @Column({ type: 'varchar', length: 255 })
  name: string; // Human-readable name: "WhatsApp Notifications"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false })
  enabled_for_free: boolean;

  @Column({ type: 'boolean', default: false })
  enabled_for_pro: boolean;

  @Column({ type: 'boolean', default: false })
  enabled_for_business: boolean;

  @Column({ type: 'integer', default: 100 })
  rollout_percentage: number; // 0-100 (for gradual rollouts)

  @Column({ type: 'simple-array', nullable: true })
  enabled_for_user_ids: string[]; // Specific user whitelist (for testing)

  @Column({ type: 'boolean', default: true })
  is_active: boolean; // Master kill switch

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}
```

**Constraints**:
- flag_key: unique, lowercase with underscores
- rollout_percentage: 0-100 range

**Indexes**: (flag_key), (is_active)

**Usage Example**:
```typescript
async function isFeatureEnabled(userId: string, flagKey: string): Promise<boolean> {
  const flag = await FeatureFlag.findOne({ flag_key: flagKey, is_active: true });
  if (!flag) return false;

  const user = await User.findOne({ id: userId });

  // Check tier-based access
  if (user.subscription_tier === 'free' && !flag.enabled_for_free) return false;
  if (user.subscription_tier === 'pro' && !flag.enabled_for_pro) return false;
  if (user.subscription_tier === 'business' && !flag.enabled_for_business) return false;

  // Check whitelist
  if (flag.enabled_for_user_ids?.includes(userId)) return true;

  // Check rollout percentage
  const hash = hashUserId(userId); // Consistent hash
  return (hash % 100) < flag.rollout_percentage;
}
```

---

### ContentFlag

**Purpose**: Content moderation queue for flagged reviews, menus, dishes (Phase 3)

```typescript
@Entity('content_flags')
export class ContentFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  flag_type: string; // 'review', 'menu', 'dish', 'image'

  @Column({ type: 'uuid' })
  target_id: string; // ID of flagged content

  @Column({ type: 'uuid' })
  flagged_by_user_id: string; // User who flagged content

  @Column({ type: 'varchar', length: 50 })
  reason: string; // 'spam', 'offensive', 'inappropriate', 'copyright', 'other'

  @Column({ type: 'text', nullable: true })
  notes: string; // Optional details from flagger

  @Column({ type: 'varchar', default: 'pending' })
  status: string; // 'pending', 'approved', 'rejected'

  @Column({ type: 'boolean', default: false })
  auto_hidden: boolean; // True if auto-hidden due to multiple flags

  @ManyToOne(() => AdminUser, { nullable: true })
  moderated_by: AdminUser;

  @Column({ type: 'uuid', nullable: true })
  moderated_by_id: string;

  @Column({ type: 'timestamp', nullable: true })
  moderated_at: Date;

  @Column({ type: 'text', nullable: true })
  moderation_notes: string; // Admin notes (internal)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
```

**Constraints**:
- Auto-hide content if 3+ flags for same target_id
- status: 'pending' → 'approved' (restore) or 'rejected' (delete)

**Indexes**: (flag_type, target_id), (status), (created_at), (moderated_by_id)

---

## User Entity Updates (Phase 2)

Add to existing User entity:

```typescript
// Referral system fields (Phase 2)
@Column({ type: 'varchar', length: 12, unique: true, nullable: true })
referral_code: string; // Generated on first access to referral dashboard

@Column({ type: 'integer', default: 0 })
account_credit_cents: number; // Rs. balance for account credit rewards

@Column({ type: 'timestamp', nullable: true })
pro_tier_expires_at: Date; // If gifted Pro via referral

@Column({ type: 'varchar', nullable: true })
referred_by_code: string; // Track who referred this user

// Account status (Phase 3)
@Column({ type: 'varchar', default: 'active' })
account_status: string; // 'active', 'suspended', 'banned', 'pending_deletion'

@Column({ type: 'timestamp', nullable: true })
suspended_until: Date; // Temporary suspension expiry

@Column({ type: 'varchar', nullable: true })
suspension_reason: string; // Admin notes

// GDPR deletion tracking (Phase 2)
@Column({ type: 'timestamp', nullable: true })
deleted_at: Date; // Soft delete timestamp (30-day grace period starts)

@Column({ type: 'timestamp', nullable: true })
deletion_scheduled_for: Date; // Hard deletion date (deleted_at + 30 days)
```

---

## Phase 3+ Future Extensions

(Not in Phase 2-3; documented for future)

- **Multi-Location Businesses**: Add Location entity, link dishes/menus to locations
- **Integrated Payments**: Add Transaction entity, webhook handlers for Stripe/PayPal
- **Customer Accounts**: Add Customer entity, Order.customer_id foreign key
- **Advanced Inventory**: Add Inventory entity, track stock per menu
- **Tax Compliance**: Add TaxRecord, VatRate, InvoiceTemplate entities
