import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar(255) NOT NULL UNIQUE,
        "password_hash" varchar(500) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_created_at" ON "users" ("created_at")`);

    // Create businesses table
    await queryRunner.query(`
      CREATE TABLE "businesses" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "owner_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "logo_url" varchar(2048),
        "primary_color" varchar(7) NOT NULL DEFAULT '#000000',
        "locale" varchar(3) NOT NULL DEFAULT 'en',
        "timezone" varchar(30) NOT NULL DEFAULT 'Asia/Kolkata',
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_businesses_owner" FOREIGN KEY ("owner_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_businesses_slug" ON "businesses" ("slug")`);
    await queryRunner.query(`CREATE INDEX "IDX_businesses_owner_id" ON "businesses" ("owner_id")`);

    // Create business_settings table
    await queryRunner.query(`
      CREATE TABLE "business_settings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL UNIQUE,
        "delivery_type" varchar NOT NULL DEFAULT 'flat',
        "delivery_fee_cents" integer NOT NULL DEFAULT 0,
        "delivery_base_fee_cents" integer,
        "delivery_per_km_cents" integer,
        "min_order_free_delivery_cents" integer,
        "distance_rounding" varchar NOT NULL DEFAULT 'round',
        "payment_method" varchar NOT NULL DEFAULT 'cash',
        "payment_instructions" text,
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "auto_confirm_orders" boolean NOT NULL DEFAULT false,
        "enable_customer_notes" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_business_settings_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);

    // Create common_dishes table
    await queryRunner.query(`
      CREATE TABLE "common_dishes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(100) NOT NULL,
        "description" text,
        "category" varchar(50) NOT NULL,
        "subcategory" varchar(50),
        "min_price_cents" integer,
        "max_price_cents" integer,
        "default_allergens" text,
        "aliases" text,
        "popularity_score" integer NOT NULL DEFAULT 0,
        "image_url" text,
        "tags" text,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_common_dishes_category_active" ON "common_dishes" ("category", "active")`);
    await queryRunner.query(`CREATE INDEX "IDX_common_dishes_popularity" ON "common_dishes" ("popularity_score" DESC)`);

    // Create dish_categories table
    await queryRunner.query(`
      CREATE TABLE "dish_categories" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "name" varchar(50) NOT NULL,
        "description" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_dish_categories_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_dish_categories_business_name" ON "dish_categories" ("business_id", "name")`);
    await queryRunner.query(`CREATE INDEX "IDX_dish_categories_sort_order" ON "dish_categories" ("sort_order")`);

    // Create dishes table
    await queryRunner.query(`
      CREATE TABLE "dishes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "price_cents" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "allergen_tags" text NOT NULL DEFAULT '',
        "image_urls" text NOT NULL DEFAULT '',
        "is_available" boolean NOT NULL DEFAULT true,
        "position" integer NOT NULL DEFAULT 0,
        "common_dish_id" uuid,
        "category_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_dishes_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_dishes_common_dish" FOREIGN KEY ("common_dish_id")
          REFERENCES "common_dishes"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_dishes_category" FOREIGN KEY ("category_id")
          REFERENCES "dish_categories"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_dishes_business_id" ON "dishes" ("business_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_dishes_category_id" ON "dishes" ("category_id")`);

    // Create menus table
    await queryRunner.query(`
      CREATE TABLE "menus" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "status" varchar NOT NULL DEFAULT 'draft',
        "version" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_menus_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_menus_business_status" ON "menus" ("business_id", "status")`);

    // Create menu_items table
    await queryRunner.query(`
      CREATE TABLE "menu_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "menu_id" uuid NOT NULL,
        "dish_id" uuid NOT NULL,
        "price_override_cents" integer,
        "position" integer NOT NULL DEFAULT 0,
        "is_available" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_menu_items_menu" FOREIGN KEY ("menu_id")
          REFERENCES "menus"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_menu_items_dish" FOREIGN KEY ("dish_id")
          REFERENCES "dishes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_menu_items_menu_dish" ON "menu_items" ("menu_id", "dish_id")`);

    // Create orders table
    await queryRunner.query(`
      CREATE TABLE "orders" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "menu_id" uuid NOT NULL,
        "customer_name" varchar(255) NOT NULL,
        "customer_phone" varchar(20) NOT NULL,
        "customer_email" varchar(255),
        "delivery_type" varchar NOT NULL,
        "delivery_address" text,
        "total_cents" integer NOT NULL,
        "delivery_fee_cents" integer NOT NULL DEFAULT 0,
        "payment_method" varchar NOT NULL,
        "payment_status" varchar NOT NULL DEFAULT 'unpaid',
        "order_status" varchar NOT NULL DEFAULT 'pending',
        "notes" text,
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "fulfilled_at" TIMESTAMP,
        "anonymized_at" TIMESTAMP,
        CONSTRAINT "FK_orders_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_orders_menu" FOREIGN KEY ("menu_id")
          REFERENCES "menus"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_orders_business_status" ON "orders" ("business_id", "order_status")`);
    await queryRunner.query(`CREATE INDEX "IDX_orders_created_at" ON "orders" ("created_at")`);

    // Create order_items table
    await queryRunner.query(`
      CREATE TABLE "order_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "dish_id" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "price_at_purchase_cents" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_order_items_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_items_dish" FOREIGN KEY ("dish_id")
          REFERENCES "dishes"("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_items_order_id" ON "order_items" ("order_id")`);

    // Create order_notifications table
    await queryRunner.query(`
      CREATE TABLE "order_notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "order_id" uuid NOT NULL,
        "user_id" uuid,
        "notification_type" varchar NOT NULL,
        "recipient" varchar(255) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "retry_count" integer NOT NULL DEFAULT 0,
        "sent_at" TIMESTAMP,
        "error_message" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_order_notifications_order" FOREIGN KEY ("order_id")
          REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_order_notifications_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_order_notifications_order_status" ON "order_notifications" ("order_id", "status")`);

    // Create payouts table
    await queryRunner.query(`
      CREATE TABLE "payouts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "gross_amount_cents" integer NOT NULL,
        "platform_fee_cents" integer NOT NULL DEFAULT 0,
        "net_amount_cents" integer NOT NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "currency" varchar(3) NOT NULL DEFAULT 'INR',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP,
        "notes" text,
        CONSTRAINT "FK_payouts_business" FOREIGN KEY ("business_id")
          REFERENCES "businesses"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_payouts_business_created" ON "payouts" ("business_id", "created_at")`);

    // Enable uuid extension if not exists
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "payouts"`);
    await queryRunner.query(`DROP TABLE "order_notifications"`);
    await queryRunner.query(`DROP TABLE "order_items"`);
    await queryRunner.query(`DROP TABLE "orders"`);
    await queryRunner.query(`DROP TABLE "menu_items"`);
    await queryRunner.query(`DROP TABLE "menus"`);
    await queryRunner.query(`DROP TABLE "dishes"`);
    await queryRunner.query(`DROP TABLE "dish_categories"`);
    await queryRunner.query(`DROP TABLE "common_dishes"`);
    await queryRunner.query(`DROP TABLE "business_settings"`);
    await queryRunner.query(`DROP TABLE "businesses"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
