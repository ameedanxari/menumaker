import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mocksRoot = path.resolve(__dirname, '../mocks');

const PORT = Number(process.env.FAKE_BACKEND_PORT || 4000);
const BASE_PATH = '/api/v1';

const state = {
  dishes: [],
  orders: [],
  reviews: [],
  favorites: [],
  coupons: [],
  notifications: [],
  marketplace: [],
  businesses: [],
  menus: [],
  payments: { processors: [], payouts: [] },
  referrals: { stats: null, history: [] },
  integrations: []
};

function loadJson(...parts) {
  const filePath = path.join(mocksRoot, ...parts);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function fixtureFor(resourceParts, status = 200) {
  const candidate = loadJson(...resourceParts, `${status}.json`);
  if (candidate) return candidate;
  const generic = loadJson('errors', `${status}.json`);
  if (generic) return generic;
  return { success: false, status, message: 'Mock fixture not found' };
}

function initState() {
  state.dishes = loadJson('dishes', '200.json')?.data?.dishes ?? [];
  state.orders = loadJson('orders', 'list', '200.json')?.data?.orders ?? [];
  state.reviews = loadJson('reviews', 'list', '200.json')?.data?.reviews ?? [];
  state.favorites = loadJson('favorites', 'list', '200.json')?.data?.favorites ?? [];
  state.coupons = loadJson('coupons', 'list', '200.json')?.data?.coupons ?? [];
  state.notifications = loadJson('notifications', 'list', '200.json')?.data?.notifications ?? [];
  state.marketplace = loadJson('marketplace', 'list', '200.json')?.data?.sellers ?? [];
  state.businesses = loadJson('businesses', 'list', '200.json')?.data?.businesses ?? [];
  state.menus = loadJson('menus', 'list', '200.json')?.data?.menus ?? [];
  state.payments.processors = loadJson('payments', 'processors', '200.json')?.data?.processors ?? [];
  state.payments.payouts = loadJson('payments', 'payouts', '200.json')?.data?.payouts ?? [];
  state.referrals.stats = loadJson('referrals', 'stats', '200.json')?.data ?? null;
  state.referrals.history = loadJson('referrals', 'history', '200.json')?.data?.referrals ?? [];
  state.integrations = loadJson('integrations', 'list', '200.json')?.data?.integrations ?? [];
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Mock-Status'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

function statusOverride(req, urlObj) {
  return urlObj.searchParams.get('status') || req.headers['x-mock-status'];
}

function matchId(pathname, base) {
  const pattern = new RegExp(`^${BASE_PATH}${base}/([^/]+)$`);
  const match = pathname.match(pattern);
  return match ? match[1] : null;
}

function createOrderFromBody(body) {
  const id = `order-${Date.now()}`;
  const now = new Date().toISOString();
  const items = Array.isArray(body.items)
    ? body.items.map((item, idx) => ({
        id: item.id || `item-${idx + 1}-${Date.now()}`,
        dish_id: item.dish_id,
        dish_name: item.dish_name || 'Dish',
        quantity: item.quantity || 1,
        price_cents: item.price_cents || 0,
        total_cents: item.total_cents || (item.price_cents || 0) * (item.quantity || 1)
      }))
    : [];

  return {
    id,
    business_id: body.business_id || 'business-1',
    customer_name: body.customer_name || 'Test Customer',
    customer_phone: body.customer_phone || '+1234567890',
    customer_email: body.customer_email || 'test@example.com',
    total_cents: body.total_cents || items.reduce((sum, i) => sum + (i.total_cents || 0), 0),
    status: body.status || 'pending',
    items,
    created_at: now,
    updated_at: now,
    delivery_address: body.delivery_address,
    estimated_delivery_time: body.estimated_delivery_time,
    delivery_person_name: body.delivery_person_name,
    delivery_person_phone: body.delivery_person_phone,
    delivery_fee_cents: body.delivery_fee_cents
  };
}

function createReviewFromBody(body) {
  return {
    id: `review-${Date.now()}`,
    business_id: body.business_id || 'business-1',
    customer_name: body.customer_name || 'Anonymous',
    rating: body.rating || 5,
    comment: body.comment || null,
    image_urls: body.image_urls || null,
    created_at: new Date().toISOString()
  };
}

async function handleRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = urlObj;
  const method = req.method || 'GET';

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const override = statusOverride(req, urlObj);

  // Auth
  if (pathname === `${BASE_PATH}/auth/login` && method === 'POST') {
    const status = override ? Number(override) : 200;
    const payload = fixtureFor(['auth', 'login'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/auth/me` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload = fixtureFor(['auth', 'me'], status);
    sendJson(res, status, payload);
    return;
  }

  // Businesses
  if (pathname === `${BASE_PATH}/businesses` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { businesses: state.businesses } }
        : fixtureFor(['businesses', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  const businessId = matchId(pathname, '/businesses');
  if (businessId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const business = state.businesses.find((b) => b.id === businessId);
    const payload =
      status === 200 && business
        ? { success: true, data: { business } }
        : fixtureFor(['businesses', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  // Menus
  if (pathname === `${BASE_PATH}/menus` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { menus: state.menus } }
        : fixtureFor(['menus', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  const menuId = matchId(pathname, '/menus');
  if (menuId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const menu = state.menus.find((m) => m.id === menuId);
    const payload =
      status === 200 && menu
        ? { success: true, data: { menu } }
        : fixtureFor(['menus', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  // Dishes
  if (pathname === `${BASE_PATH}/dishes` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const businessIdFilter = urlObj.searchParams.get('business_id');
    const dishes =
      businessIdFilter != null
        ? state.dishes.filter((d) => d.business_id === businessIdFilter || d.businessId === businessIdFilter)
        : state.dishes;
    const payload =
      status === 200
        ? { success: true, data: { dishes } }
        : fixtureFor(['dishes'], status);
    sendJson(res, status, payload);
    return;
  }

  const dishId = matchId(pathname, '/dishes');
  if (dishId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const dish = state.dishes.find((d) => d.id === dishId);
    const payload =
      status === 200 && dish
        ? { success: true, data: { dish } }
        : fixtureFor(['dishes', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  // Orders
  if (pathname === `${BASE_PATH}/orders` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { orders: state.orders, total: state.orders.length } }
        : fixtureFor(['orders', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/orders` && method === 'POST') {
    const body = await parseBody(req);
    const order = createOrderFromBody(body);
    state.orders.unshift(order);
    sendJson(res, 201, { success: true, data: { order } });
    return;
  }

  const orderId = matchId(pathname, '/orders');
  if (orderId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const order = state.orders.find((o) => o.id === orderId);
    const payload =
      status === 200 && order
        ? { success: true, data: { order } }
        : fixtureFor(['orders', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  // Coupons
  if (pathname === `${BASE_PATH}/coupons` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { coupons: state.coupons } }
        : fixtureFor(['coupons', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/coupons/validate` && method === 'POST') {
    const status = override ? Number(override) : 200;
    if (status !== 200) {
      sendJson(res, status, fixtureFor(['coupons', 'validate'], status));
      return;
    }
    const body = await parseBody(req);
    const code = (body.code || body.couponCode || '').toUpperCase();
    const orderSubtotalCents = Number(body.order_subtotal_cents || body.orderSubtotalCents || 0);
    const coupon = state.coupons.find((c) => c.code.toUpperCase() === code);
    const invalidResponse = fixtureFor(['coupons', 'validate'], 400);

    if (!coupon) {
      sendJson(res, 400, invalidResponse);
      return;
    }

    const now = Date.now();
    const expiry = coupon.valid_until ? Date.parse(coupon.valid_until) : null;

    if (coupon.is_active === false || (expiry && expiry < now)) {
      sendJson(res, 400, { ...invalidResponse, message: 'Coupon expired or inactive' });
      return;
    }

    if (orderSubtotalCents < Number(coupon.min_order_value_cents || 0)) {
      sendJson(res, 400, {
        ...invalidResponse,
        message: `Minimum order of ${(coupon.min_order_value_cents || 0) / 100} required`
      });
      return;
    }

    let discountCents =
      coupon.discount_type === 'percentage'
        ? Math.floor(orderSubtotalCents * (Number(coupon.discount_value) / 100))
        : Number(coupon.discount_value || 0);

    if (coupon.max_discount_cents) {
      discountCents = Math.min(discountCents, Number(coupon.max_discount_cents));
    }

    sendJson(res, 200, {
      success: true,
      data: {
        valid: true,
        discount_amount_cents: discountCents,
        discount_amount: discountCents / 100,
        coupon
      }
    });
    return;
  }

  // Reviews
  if (pathname === `${BASE_PATH}/reviews` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const reviews = state.reviews;
    const payload =
      status === 200
        ? {
            success: true,
            data: {
              reviews,
              average_rating:
                reviews.length > 0 ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length : 0,
              total_reviews: reviews.length
            }
          }
        : fixtureFor(['reviews', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/reviews` && method === 'POST') {
    const body = await parseBody(req);
    const review = createReviewFromBody(body);
    state.reviews.unshift(review);
    sendJson(res, 201, { success: true, data: { review } });
    return;
  }

  // Notifications
  if (pathname === `${BASE_PATH}/notifications` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? {
            success: true,
            data: {
              notifications: state.notifications,
              total: state.notifications.length,
              limit: 20,
              offset: 0
            }
          }
        : fixtureFor(['notifications', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  // Favorites
  if (pathname === `${BASE_PATH}/favorites` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200 ? { success: true, data: { favorites: state.favorites } } : fixtureFor(['favorites', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  // Marketplace
  if (pathname === `${BASE_PATH}/marketplace` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { sellers: state.marketplace, total: state.marketplace.length } }
        : fixtureFor(['marketplace', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  // Payments
  if (pathname === `${BASE_PATH}/payments/processors` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { processors: state.payments.processors } }
        : fixtureFor(['payments', 'processors'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/payments/payouts` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? { success: true, data: { payouts: state.payments.payouts, total: state.payments.payouts.length, limit: 20, offset: 0 } }
        : fixtureFor(['payments', 'payouts'], status);
    sendJson(res, status, payload);
    return;
  }

  // Referrals
  if (pathname === `${BASE_PATH}/referrals/stats` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200 ? { success: true, data: state.referrals.stats } : fixtureFor(['referrals', 'stats'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/referrals/history` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200 ? { success: true, data: { referrals: state.referrals.history } } : fixtureFor(['referrals', 'history'], status);
    sendJson(res, status, payload);
    return;
  }

  // Integrations
  if (pathname === `${BASE_PATH}/integrations` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200 ? { success: true, data: { integrations: state.integrations } } : fixtureFor(['integrations', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  // Fallback
  const status = override ? Number(override) : 404;
  const payload = fixtureFor(['errors'], status);
  sendJson(res, status, payload);
}

function start() {
  initState();
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error('[fake-backend] Unhandled error', err);
      sendJson(res, 500, fixtureFor(['errors'], 500));
    });
  });

  server.listen(PORT, () => {
    console.log(`[fake-backend] running on port ${PORT} (base path ${BASE_PATH})`);
    console.log(`[fake-backend] status override: ?status=400 or header x-mock-status: 400`);
  });
}

start();
