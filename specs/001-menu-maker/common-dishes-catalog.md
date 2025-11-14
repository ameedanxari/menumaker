# Common Dishes Catalog

## Overview

The Common Dishes Catalog is a pre-populated database of 200+ standardized dishes across multiple cuisine types, designed to accelerate seller onboarding and reduce data entry burden. Sellers can quickly import dishes from templates instead of manually creating each item, while maintaining the flexibility to customize imported dishes or create fully custom entries.

## Goals

1. **Reduce Time-to-First-Listing**: Enable sellers to publish menus in <30 minutes (vs 2+ hours manual entry)
2. **Improve Data Quality**: Standardized dishes include pre-filled allergens, descriptions, and suggested price ranges
3. **Enable Future Features**: Common dish IDs enable marketplace search, analytics, and OCR matching (Phase 2)
4. **Maintain Flexibility**: Sellers can fully customize imported dishes or create custom dishes
5. **Support Multiple Cuisines**: Cover diverse Indian cuisine types and common international foods

## User Experience

### Seller Flow: Quick Import from Templates

**Scenario**: Seller creating menu for North Indian home kitchen

```
1. Click "Add Dish" on menu page
2. See two options:
   - "Create Custom Dish" (manual entry)
   - "Import from Templates" (quick import) ⬅️ New feature
3. Click "Import from Templates"
4. See categorized list:
   - North Indian (48 dishes)
   - South Indian (42 dishes)
   - Chinese (28 dishes)
   - Beverages (35 dishes)
   - ...
5. Select category: "North Indian"
6. See grid of dishes:
   [Samosa]  [Paneer Tikka]  [Dal Makhani]  [Butter Naan]  ...
7. Click "Samosa"
8. Pre-filled form appears:
   Name: "Samosa" (editable)
   Description: "Crispy fried pastry with spiced potato filling" (editable)
   Price: ₹20 (suggested, editable)
   Allergens: [Gluten] pre-selected (editable)
   Category: "Appetizers" auto-assigned
9. Adjust price to ₹25, click "Add to Menu"
10. Dish appears in menu with seller's customizations
```

### Customization After Import

**All fields editable**:
- ✅ Change name: "Samosa" → "Punjabi Samosa"
- ✅ Modify description
- ✅ Set custom price
- ✅ Add/remove allergens
- ✅ Upload custom image
- ✅ Change category

**Link preserved**:
- Dish maintains `commonDishId` reference for analytics
- Tracks which dishes are popular imports (informs catalog expansion)

### User-Defined Categories

**New Feature**: Sellers can organize dishes into custom categories

**Default Categories** (suggested):
- Appetizers
- Main Course
- Desserts
- Beverages

**Custom Categories** (seller-defined):
- "Chef's Specials"
- "Lunch Combos"
- "Kids Menu"
- "Sugar-Free Options"

**Menu Display**:
```
Menu for "Spice Kitchen"
└── Appetizers (3 items)
    ├── Samosa - ₹25
    ├── Paneer Tikka - ₹120
    └── Onion Pakora - ₹40
└── Main Course (5 items)
    ├── Butter Chicken - ₹180
    ├── Dal Makhani - ₹100
    ...
└── Chef's Specials (2 items)
    ├── Royal Thali - ₹250
    └── Paneer Lababdar - ₹160
```

## Data Model

### CommonDish Entity

**Purpose**: Pre-populated template dishes for quick import

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('common_dishes')
export class CommonDish {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string; // "Samosa", "Masala Dosa", etc.

  @Column({ type: 'text', nullable: true })
  description: string; // "Crispy fried pastry with spiced potato filling"

  @Column({ type: 'varchar', length: 50 })
  category: string; // "north_indian", "south_indian", "chinese", etc.

  @Column({ type: 'varchar', length: 50, nullable: true })
  subcategory: string; // "appetizers", "mains", "desserts", "beverages"

  @Column({ type: 'int', nullable: true })
  minPriceCents: number; // Suggested min price (e.g., 2000 = ₹20)

  @Column({ type: 'int', nullable: true })
  maxPriceCents: number; // Suggested max price (e.g., 5000 = ₹50)

  @Column({ type: 'simple-array', nullable: true })
  defaultAllergens: string[]; // ["gluten", "dairy", etc.]

  @Column({ type: 'simple-array', nullable: true })
  aliases: string[]; // ["Samsa", "Sambosa"] for search matching

  @Column({ type: 'int', default: 0 })
  popularityScore: number; // 0-100, used for sorting

  @Column({ type: 'text', nullable: true })
  imageUrl: string; // Optional stock image URL

  @Column({ type: 'simple-array', nullable: true })
  tags: string[]; // ["vegetarian", "spicy", "fried", etc.]

  @Column({ type: 'boolean', default: true })
  active: boolean; // Allow disabling outdated dishes

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### DishCategory Entity (User-Defined)

**Purpose**: Sellers create custom categories to organize their menus

```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Business } from './Business';
import { Dish } from './Dish';

@Entity('dish_categories')
export class DishCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  name: string; // "Appetizers", "Chef's Specials", etc.

  @Column({ type: 'text', nullable: true })
  description: string; // Optional description

  @Column({ type: 'int', default: 0 })
  sortOrder: number; // Display order (0 = first)

  @ManyToOne(() => Business, business => business.dishCategories, { onDelete: 'CASCADE' })
  business: Business;

  @Column({ type: 'uuid' })
  businessId: string;

  @OneToMany(() => Dish, dish => dish.category)
  dishes: Dish[];

  @Column({ type: 'boolean', default: false })
  isDefault: boolean; // True for system-suggested categories

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Updated Dish Entity

**Changes**: Add foreign keys to `CommonDish` and `DishCategory`

```typescript
// Add to existing Dish entity
@ManyToOne(() => CommonDish, { nullable: true })
commonDish: CommonDish;

@Column({ type: 'uuid', nullable: true })
commonDishId: string; // Reference to template (if imported)

@ManyToOne(() => DishCategory, category => category.dishes, { nullable: true })
category: DishCategory;

@Column({ type: 'uuid', nullable: true })
categoryId: string; // Reference to user-defined category
```

## Common Dishes Seed Data

### Categories & Cuisine Types

| Category ID | Name | Dish Count (Phase 1) |
|-------------|------|----------------------|
| `north_indian` | North Indian | 48 dishes |
| `south_indian` | South Indian | 42 dishes |
| `chinese` | Chinese | 28 dishes |
| `bakery` | Bakery & Snacks | 25 dishes |
| `beverages` | Beverages | 35 dishes |
| `desserts` | Desserts & Sweets | 22 dishes |
| **Total** | | **200 dishes** |

### Sample Seed Data (North Indian)

```json
[
  {
    "id": "common_dish_001",
    "name": "Samosa",
    "description": "Crispy fried pastry filled with spiced potatoes and peas",
    "category": "north_indian",
    "subcategory": "appetizers",
    "minPriceCents": 1000,
    "maxPriceCents": 3000,
    "defaultAllergens": ["gluten"],
    "aliases": ["Samsa", "Sambosa"],
    "popularityScore": 95,
    "tags": ["vegetarian", "fried", "spicy"],
    "active": true
  },
  {
    "id": "common_dish_002",
    "name": "Paneer Tikka",
    "description": "Marinated cottage cheese cubes grilled to perfection",
    "category": "north_indian",
    "subcategory": "appetizers",
    "minPriceCents": 10000,
    "maxPriceCents": 18000,
    "defaultAllergens": ["dairy"],
    "aliases": ["Paneer Tikka Masala"],
    "popularityScore": 90,
    "tags": ["vegetarian", "grilled", "spicy"],
    "active": true
  },
  {
    "id": "common_dish_003",
    "name": "Butter Chicken",
    "description": "Tender chicken in rich creamy tomato-based gravy",
    "category": "north_indian",
    "subcategory": "mains",
    "minPriceCents": 15000,
    "maxPriceCents": 25000,
    "defaultAllergens": ["dairy"],
    "aliases": ["Murgh Makhani"],
    "popularityScore": 98,
    "tags": ["non-vegetarian", "creamy", "mild"],
    "active": true
  },
  {
    "id": "common_dish_004",
    "name": "Dal Makhani",
    "description": "Black lentils cooked in butter and cream",
    "category": "north_indian",
    "subcategory": "mains",
    "minPriceCents": 8000,
    "maxPriceCents": 15000,
    "defaultAllergens": ["dairy"],
    "aliases": ["Dal Makhni", "Maa Ki Dal"],
    "popularityScore": 88,
    "tags": ["vegetarian", "creamy", "mild"],
    "active": true
  },
  {
    "id": "common_dish_005",
    "name": "Butter Naan",
    "description": "Soft leavened flatbread brushed with butter",
    "category": "north_indian",
    "subcategory": "breads",
    "minPriceCents": 2000,
    "maxPriceCents": 5000,
    "defaultAllergens": ["gluten", "dairy"],
    "aliases": ["Naan"],
    "popularityScore": 92,
    "tags": ["vegetarian", "baked"],
    "active": true
  }
]
```

### Sample Seed Data (South Indian)

```json
[
  {
    "id": "common_dish_101",
    "name": "Masala Dosa",
    "description": "Crispy rice crepe filled with spiced potato filling",
    "category": "south_indian",
    "subcategory": "mains",
    "minPriceCents": 5000,
    "maxPriceCents": 12000,
    "defaultAllergens": [],
    "aliases": ["Dosa", "Masala Dosai"],
    "popularityScore": 95,
    "tags": ["vegetarian", "gluten-free", "vegan"],
    "active": true
  },
  {
    "id": "common_dish_102",
    "name": "Idli",
    "description": "Soft steamed rice cakes served with sambar and chutney",
    "category": "south_indian",
    "subcategory": "breakfast",
    "minPriceCents": 3000,
    "maxPriceCents": 8000,
    "defaultAllergens": [],
    "aliases": ["Idly", "Idli Sambar"],
    "popularityScore": 90,
    "tags": ["vegetarian", "gluten-free", "vegan", "steamed"],
    "active": true
  },
  {
    "id": "common_dish_103",
    "name": "Uttapam",
    "description": "Thick rice pancake topped with vegetables",
    "category": "south_indian",
    "subcategory": "mains",
    "minPriceCents": 6000,
    "maxPriceCents": 12000,
    "defaultAllergens": [],
    "aliases": ["Uthappam", "Oothappam"],
    "popularityScore": 82,
    "tags": ["vegetarian", "gluten-free"],
    "active": true
  }
]
```

### Sample Seed Data (Beverages)

```json
[
  {
    "id": "common_dish_301",
    "name": "Masala Chai",
    "description": "Spiced Indian tea with milk",
    "category": "beverages",
    "subcategory": "hot_beverages",
    "minPriceCents": 1000,
    "maxPriceCents": 3000,
    "defaultAllergens": ["dairy"],
    "aliases": ["Chai", "Masala Tea"],
    "popularityScore": 88,
    "tags": ["vegetarian", "hot"],
    "active": true
  },
  {
    "id": "common_dish_302",
    "name": "Mango Lassi",
    "description": "Sweet yogurt-based drink with mango pulp",
    "category": "beverages",
    "subcategory": "cold_beverages",
    "minPriceCents": 4000,
    "maxPriceCents": 8000,
    "defaultAllergens": ["dairy"],
    "aliases": ["Lassi"],
    "popularityScore": 85,
    "tags": ["vegetarian", "cold", "sweet"],
    "active": true
  }
]
```

## API Endpoints

### 1. List Common Dishes (GET /api/v1/common-dishes)

**Purpose**: Retrieve template dishes for import

**Query Parameters**:
- `category` (optional): Filter by cuisine type (e.g., `north_indian`)
- `subcategory` (optional): Filter by subcategory (e.g., `appetizers`)
- `search` (optional): Search by name or alias
- `limit` (optional): Max results (default: 50)
- `offset` (optional): Pagination offset

**Example Request**:
```http
GET /api/v1/common-dishes?category=north_indian&subcategory=appetizers
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "common_dish_001",
      "name": "Samosa",
      "description": "Crispy fried pastry filled with spiced potatoes and peas",
      "category": "north_indian",
      "subcategory": "appetizers",
      "suggestedPriceRange": {
        "minCents": 1000,
        "maxCents": 3000,
        "minFormatted": "₹10",
        "maxFormatted": "₹30"
      },
      "defaultAllergens": ["gluten"],
      "tags": ["vegetarian", "fried", "spicy"],
      "imageUrl": "https://cdn.menumaker.com/dishes/samosa.jpg",
      "popularityScore": 95
    },
    {
      "id": "common_dish_002",
      "name": "Paneer Tikka",
      "description": "Marinated cottage cheese cubes grilled to perfection",
      "category": "north_indian",
      "subcategory": "appetizers",
      "suggestedPriceRange": {
        "minCents": 10000,
        "maxCents": 18000,
        "minFormatted": "₹100",
        "maxFormatted": "₹180"
      },
      "defaultAllergens": ["dairy"],
      "tags": ["vegetarian", "grilled", "spicy"],
      "imageUrl": "https://cdn.menumaker.com/dishes/paneer-tikka.jpg",
      "popularityScore": 90
    }
  ],
  "meta": {
    "total": 48,
    "limit": 50,
    "offset": 0
  }
}
```

### 2. Get Common Dish by ID (GET /api/v1/common-dishes/:id)

**Purpose**: Get details of specific template dish

**Example Request**:
```http
GET /api/v1/common-dishes/common_dish_001
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "id": "common_dish_001",
  "name": "Samosa",
  "description": "Crispy fried pastry filled with spiced potatoes and peas",
  "category": "north_indian",
  "subcategory": "appetizers",
  "suggestedPriceRange": {
    "minCents": 1000,
    "maxCents": 3000
  },
  "defaultAllergens": ["gluten"],
  "aliases": ["Samsa", "Sambosa"],
  "tags": ["vegetarian", "fried", "spicy"],
  "imageUrl": "https://cdn.menumaker.com/dishes/samosa.jpg",
  "popularityScore": 95
}
```

### 3. Create Dish from Template (POST /api/v1/dishes/from-template)

**Purpose**: Import common dish as seller's custom dish

**Request Body**:
```json
{
  "commonDishId": "common_dish_001",
  "businessId": "biz_123",
  "menuId": "menu_456",
  "overrides": {
    "name": "Punjabi Samosa",
    "priceCents": 2500,
    "description": "Our signature crispy samosas with special filling",
    "allergens": ["gluten"],
    "categoryId": "cat_789",
    "imageUrl": "https://my-custom-image.jpg"
  }
}
```

**Example Response**:
```json
{
  "id": "dish_abc123",
  "name": "Punjabi Samosa",
  "description": "Our signature crispy samosas with special filling",
  "priceCents": 2500,
  "imageUrl": "https://my-custom-image.jpg",
  "allergens": ["gluten"],
  "categoryId": "cat_789",
  "commonDishId": "common_dish_001",
  "businessId": "biz_123",
  "menuId": "menu_456",
  "available": true,
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-15T10:30:00Z"
}
```

### 4. List Dish Categories (GET /api/v1/businesses/:businessId/dish-categories)

**Purpose**: Get seller's custom categories

**Example Request**:
```http
GET /api/v1/businesses/biz_123/dish-categories
Authorization: Bearer <token>
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "cat_001",
      "name": "Appetizers",
      "description": "Starters and snacks",
      "sortOrder": 0,
      "isDefault": true,
      "dishCount": 5
    },
    {
      "id": "cat_002",
      "name": "Chef's Specials",
      "description": "Our signature dishes",
      "sortOrder": 1,
      "isDefault": false,
      "dishCount": 3
    }
  ]
}
```

### 5. Create Dish Category (POST /api/v1/businesses/:businessId/dish-categories)

**Purpose**: Create custom category for organizing menu

**Request Body**:
```json
{
  "name": "Chef's Specials",
  "description": "Our signature dishes",
  "sortOrder": 1
}
```

**Example Response**:
```json
{
  "id": "cat_002",
  "name": "Chef's Specials",
  "description": "Our signature dishes",
  "sortOrder": 1,
  "businessId": "biz_123",
  "isDefault": false,
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### 6. Update Dish Category (PATCH /api/v1/dish-categories/:id)

**Purpose**: Edit category name or sort order

### 7. Delete Dish Category (DELETE /api/v1/dish-categories/:id)

**Purpose**: Remove category (dishes remain, become uncategorized)

## UI/UX Wireframes

### Mobile: Import from Templates Flow

```
┌─────────────────────────────┐
│  Add Dish                   │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐ │
│  │ Create Custom Dish    │ │
│  └───────────────────────┘ │
│                             │
│  ┌───────────────────────┐ │
│  │ Import from Templates │ │ ⬅️ Click
│  └───────────────────────┘ │
│                             │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│  Common Dishes              │
├─────────────────────────────┤
│  [Search: "Samosa..."]      │
│                             │
│  Categories:                │
│  • North Indian (48)        │ ⬅️ Select
│  • South Indian (42)        │
│  • Chinese (28)             │
│  • Beverages (35)           │
│  • Desserts (22)            │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│  North Indian Dishes        │
├─────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │[IMG]│ │[IMG]│ │[IMG]│   │
│  │Samo │ │Tikka│ │Naan │   │
│  │₹20+ │ │₹100+│ │₹20+ │   │ ⬅️ Click Samosa
│  └─────┘ └─────┘ └─────┘   │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │[IMG]│ │[IMG]│ │[IMG]│   │
│  │B.Chi│ │Dal  │ │Roti │   │
│  │₹150+│ │₹80+ │ │₹15+ │   │
│  └─────┘ └─────┘ └─────┘   │
└─────────────────────────────┘
          ↓
┌─────────────────────────────┐
│  Edit Dish Details          │
├─────────────────────────────┤
│  Name: [Samosa_________]    │
│  Description:               │
│  [Crispy fried pastry...] │
│                             │
│  Price: [₹ 25________]      │ ⬅️ Edit
│  Suggested: ₹10 - ₹30       │
│                             │
│  Allergens:                 │
│  ☑ Gluten  ☐ Dairy          │
│                             │
│  Category:                  │
│  [Appetizers ▼]             │
│                             │
│  [Add to Menu]              │
└─────────────────────────────┘
```

### Web: Category Management

```
┌───────────────────────────────────────────────────┐
│  Menu Management                                  │
├───────────────────────────────────────────────────┤
│  Categories:  [+ Add Category]                    │
│                                                   │
│  ┌─ Appetizers (5 dishes) ──────────────────┐   │
│  │  • Samosa - ₹25           [Edit] [Delete] │   │
│  │  • Paneer Tikka - ₹120    [Edit] [Delete] │   │
│  │  • Onion Pakora - ₹40     [Edit] [Delete] │   │
│  │  [+ Add Dish]  [Import from Templates]    │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
│  ┌─ Main Course (8 dishes) ──────────────────┐   │
│  │  • Butter Chicken - ₹180  [Edit] [Delete] │   │
│  │  • Dal Makhani - ₹100     [Edit] [Delete] │   │
│  │  ...                                        │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
│  ┌─ Chef's Specials (2 dishes) ──────────────┐   │
│  │  • Royal Thali - ₹250     [Edit] [Delete] │   │
│  │  • Paneer Lababdar - ₹160 [Edit] [Delete] │   │
│  └──────────────────────────────────────────┘   │
└───────────────────────────────────────────────────┘
```

## Implementation Strategy

### Phase 1: MVP (Current Phase)

**Scope**: Basic common dishes catalog with categories

✅ **Week 1-2**: Database & Seed Data
- Create `common_dishes` table migration
- Create `dish_categories` table migration
- Update `dishes` table (add `commonDishId`, `categoryId`)
- Load 200+ dishes seed data

✅ **Week 3**: Backend APIs
- Implement 7 new API endpoints
- Add validation and tests
- Update OpenAPI spec

✅ **Week 4**: Web UI
- Add "Import from Templates" button
- Build common dishes browser (grid view)
- Implement category management UI

✅ **Week 5**: Mobile UI (React Native)
- Add template import flow
- Build category selector
- Test on iOS/Android

### Phase 2: OCR Integration (Future)

**Enhancement**: Match OCR-extracted dish names to common dishes

```typescript
// When OCR extracts "Samsa" from menu image
const match = await findCommonDishByAlias("Samsa");
// Returns: CommonDish { name: "Samosa", aliases: ["Samsa", "Sambosa"], ... }

// Pre-fill dish form with matched template
const suggestedDish = {
  name: match.name,
  description: match.description,
  priceCents: match.minPriceCents,
  allergens: match.defaultAllergens
};
```

### Phase 3: Marketplace Search (Future)

**Enhancement**: Search across sellers by standardized dish

```sql
-- Find all sellers offering "Butter Chicken"
SELECT b.name, b.location, d.priceCents
FROM dishes d
JOIN businesses b ON d.businessId = b.id
WHERE d.commonDishId = 'common_dish_003' -- Butter Chicken
  AND d.available = true
ORDER BY d.priceCents ASC;
```

## Analytics & Metrics

### Track Common Dish Usage

**Event**: `dish_imported_from_template`

**Properties**:
```json
{
  "common_dish_id": "common_dish_001",
  "common_dish_name": "Samosa",
  "category": "north_indian",
  "price_cents": 2500,
  "price_changed": true,
  "name_changed": false
}
```

**Metrics**:
- **Template Usage Rate**: % of dishes created from templates vs manual
- **Most Popular Templates**: Top 10 common dishes by import count
- **Time-to-First-Listing**: Avg time from signup to menu published (target: <30 min with templates)
- **Customization Rate**: % of imported dishes that are edited

**Target KPIs**:
| Metric | Baseline (Manual Entry) | Target (With Templates) |
|--------|-------------------------|-------------------------|
| Time-to-first-listing | 2+ hours | <30 minutes |
| Dishes per menu | 5-10 | 15-25 |
| Template usage rate | N/A | 60%+ |

## Maintenance & Expansion

### Adding New Common Dishes

**Process**:
1. Analyze seller-created dishes for patterns (most common manual entries)
2. Create new CommonDish entries via admin panel or SQL
3. Deploy seed migration
4. Monitor import rates

**Example Migration**:
```typescript
// migration/1234567890-add-chinese-dishes.ts
export class AddChineseDishes1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO common_dishes (id, name, description, category, subcategory, min_price_cents, max_price_cents, default_allergens, popularity_score, active)
      VALUES
        ('common_dish_201', 'Spring Roll', 'Crispy fried rolls with vegetable filling', 'chinese', 'appetizers', 3000, 6000, '{"gluten"}', 85, true),
        ('common_dish_202', 'Fried Rice', 'Stir-fried rice with vegetables and soy sauce', 'chinese', 'mains', 8000, 15000, '{"soy"}', 90, true)
    `);
  }
}
```

### Deprecating Outdated Dishes

**Process**:
1. Set `active = false` for outdated dishes
2. Hide from template browser UI
3. Existing seller dishes remain unaffected (foreign key allows null)

## Testing

### Unit Tests

```typescript
// tests/services/commonDishService.test.ts
describe('CommonDishService', () => {
  it('finds common dish by alias', async () => {
    const dish = await commonDishService.findByNameOrAlias('Samsa');
    expect(dish.name).toBe('Samosa');
  });

  it('creates dish from template with overrides', async () => {
    const newDish = await dishService.createFromTemplate({
      commonDishId: 'common_dish_001',
      businessId: 'biz_123',
      overrides: { priceCents: 2500 }
    });

    expect(newDish.commonDishId).toBe('common_dish_001');
    expect(newDish.priceCents).toBe(2500);
  });
});
```

### Integration Tests

```typescript
// tests/api/commonDishes.test.ts
describe('GET /api/v1/common-dishes', () => {
  it('filters by category', async () => {
    const response = await request(app)
      .get('/api/v1/common-dishes?category=north_indian')
      .expect(200);

    expect(response.body.data).toHaveLength(48);
    response.body.data.forEach(dish => {
      expect(dish.category).toBe('north_indian');
    });
  });
});
```

## Security Considerations

### Rate Limiting

**Prevent abuse of template import**:

```typescript
// Max 100 dishes imported per business per hour
const rateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  keyGenerator: (req) => req.body.businessId
});

app.post('/api/v1/dishes/from-template', rateLimiter, ...);
```

### Validation

**Ensure imported dishes meet requirements**:

```typescript
// Validate overrides don't introduce malicious content
const createDishSchema = z.object({
  commonDishId: z.string().uuid(),
  businessId: z.string().uuid(),
  overrides: z.object({
    name: z.string().max(100).optional(),
    priceCents: z.number().min(100).max(1000000).optional(), // ₹1 to ₹10,000
    description: z.string().max(500).optional(),
    imageUrl: z.string().url().optional()
  })
});
```

## Future Enhancements

### AI-Powered Suggestions (Phase 2+)

**Smart recommendations based on business type**:

```typescript
// If business type is "homeKitchen" + location is "Punjab"
// → Suggest: Punjabi dishes (Sarson Ka Saag, Makki Ki Roti, etc.)

// If business name contains "South" or "Dosa"
// → Suggest: South Indian dishes first
```

### Dynamic Pricing Suggestions (Phase 3+)

**ML model to suggest competitive pricing**:

```typescript
// Analyze pricing for "Samosa" in seller's city
// Suggest: ₹22 (median price in Bangalore for home kitchens)
```

### Image Library (Phase 2+)

**Stock images for common dishes**:

- Upload 200+ high-quality food photos
- Serve from CDN (CloudFront or Cloudinary)
- Sellers can use stock images or upload custom

## Summary

### Key Benefits

✅ **Faster Onboarding**: Reduce time-to-first-listing from 2+ hours to <30 minutes
✅ **Better Data Quality**: Pre-filled allergens, descriptions, and price ranges
✅ **Future-Proof**: Enables OCR matching and marketplace search
✅ **Flexible**: Sellers can fully customize or create from scratch

### Quick Stats

- **200+ common dishes** across 6 cuisine types
- **7 new API endpoints** for templates and categories
- **2 new database entities** (CommonDish, DishCategory)
- **60%+ target** for template usage rate

---

**Status**: ✅ Ready for Implementation (Phase 1)
**Owner**: Full-Stack Team
**Dependencies**: Database migrations, seed data, UI components
