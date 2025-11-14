// Common types used across backend and frontend

export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  logo_url?: string;
  primary_color: string;
  locale: string;
  timezone: string;
  description?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface BusinessSettings {
  id: string;
  business_id: string;
  delivery_type: 'flat' | 'distance' | 'free';
  delivery_fee_cents: number;
  delivery_base_fee_cents?: number;
  delivery_per_km_cents?: number;
  min_order_free_delivery_cents?: number;
  distance_rounding: 'round' | 'ceil' | 'floor';
  payment_method: 'cash' | 'bank_transfer' | 'upi' | 'other';
  payment_instructions?: string;
  currency: string;
  auto_confirm_orders: boolean;
  enable_customer_notes: boolean;
  created_at: Date;
  updated_at?: Date;
}

export interface Dish {
  id: string;
  business_id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  allergen_tags: string[];
  image_urls: string[];
  is_available: boolean;
  position: number;
  common_dish_id?: string;
  category_id?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Menu {
  id: string;
  business_id: string;
  title: string;
  start_date: Date;
  end_date: Date;
  status: 'draft' | 'published' | 'archived';
  version: number;
  created_at: Date;
  updated_at?: Date;
  items?: MenuItem[];
}

export interface MenuItem {
  id: string;
  menu_id: string;
  dish_id: string;
  price_override_cents?: number;
  position: number;
  is_available: boolean;
  created_at: Date;
  dish?: Dish;
}

export interface Order {
  id: string;
  business_id: string;
  menu_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_type: 'pickup' | 'delivery';
  delivery_address?: string;
  total_cents: number;
  delivery_fee_cents: number;
  payment_method: string;
  payment_status: 'unpaid' | 'paid';
  order_status: 'pending' | 'confirmed' | 'ready' | 'fulfilled' | 'cancelled';
  notes?: string;
  currency: string;
  created_at: Date;
  updated_at?: Date;
  fulfilled_at?: Date;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  dish_id: string;
  quantity: number;
  price_at_purchase_cents: number;
  created_at: Date;
  dish?: Dish;
}

export interface Payout {
  id: string;
  business_id: string;
  period_start: Date;
  period_end: Date;
  gross_amount_cents: number;
  platform_fee_cents: number;
  net_amount_cents: number;
  status: 'pending' | 'completed' | 'failed';
  currency: string;
  created_at: Date;
  completed_at?: Date;
  notes?: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  businessId?: string;
  iat?: number;
  exp?: number;
}
