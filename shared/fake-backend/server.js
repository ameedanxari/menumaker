import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mocksRoot = path.resolve(__dirname, '../mocks');

const PORT = Number(process.env.FAKE_BACKEND_PORT || 4000);
const BASE_PATH = '/api/v1';
const manifest = loadJson('manifest.json') ?? { fixtures: [] };
const canonicalFixtures = new Map(
  (manifest.fixtures ?? []).map((fixture) => [
    `${fixture.operation_id}:${fixture.status}`,
    fixture
  ])
);

const state = {
  dishes: [],
  dishCategories: [],
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
  integrations: [],
  usersByEmail: new Map(),
  usersById: new Map(),
  currentUser: null
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

function canonicalFixture(operationId, status = 200) {
  const fixture = canonicalFixtures.get(`${operationId}:${status}`);
  if (!fixture) return null;
  return loadJson(...fixture.path.replace(/^shared\/mocks\//, '').split('/'));
}

function isLocalhost(req) {
  const address = req.socket.remoteAddress;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function initState() {
  state.dishes = [];
  state.dishCategories = [];
  state.orders = [];
  state.reviews = loadJson('reviews', 'list', '200.json')?.data?.reviews ?? [];
  state.favorites = loadJson('favorites', 'list', '200.json')?.data?.favorites ?? [];
  state.coupons = loadJson('coupons', 'list', '200.json')?.data?.coupons ?? [];
  state.notifications = loadJson('notifications', 'list', '200.json')?.data?.notifications ?? [];
  state.marketplace = loadJson('marketplace', 'list', '200.json')?.data?.sellers ?? [];
  state.businesses = [];
  state.menus = [];
  state.payments.processors = loadJson('payments', 'processors', '200.json')?.data?.processors ?? [];
  state.payments.payouts = loadJson('payments', 'payouts', '200.json')?.data?.payouts ?? [];
  state.referrals.stats = loadJson('referrals', 'stats', '200.json')?.data ?? null;
  state.referrals.history = loadJson('referrals', 'history', '200.json')?.data?.referrals ?? [];
  state.integrations = loadJson('integrations', 'list', '200.json')?.data?.integrations ?? [];
  state.usersByEmail = new Map();
  state.usersById = new Map();
  state.currentUser = null;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Mock-Status'
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
  const raw = urlObj.searchParams.get('status') || req.headers['x-mock-status'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return /^\d{3}$/.test(String(value || '')) ? value : null;
}

function requestId(req) {
  return req.headers['x-request-id'] || `fake-${Date.now()}`;
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
        ...orderItemFromBody(item)
      }))
    : [];

  return {
    id,
    business_id: body.business_id || 'business-1',
    customer_name: body.customer_name || 'Test Customer',
    customer_phone: body.customer_phone || '+1234567890',
    customer_email: body.customer_email || 'test@example.com',
    delivery_type: body.delivery_type || 'pickup',
    total_cents: body.total_cents || items.reduce((sum, i) => sum + (i.total_cents || 0), 0),
    status: body.status || body.order_status || 'pending',
    order_status: body.order_status || body.status || 'pending',
    payment_method: body.payment_method || 'cash',
    payment_status: body.payment_status || 'pending',
    items,
    created_at: now,
    updated_at: now,
    delivery_address: body.delivery_address,
    delivery_distance_km: body.delivery_distance_km,
    estimated_delivery_time: body.estimated_delivery_time,
    delivery_person_name: body.delivery_person_name,
    delivery_person_phone: body.delivery_person_phone,
    delivery_fee_cents: body.delivery_fee_cents || 0
  };
}

function orderItemFromBody(item) {
  const dish = state.dishes.find((candidate) => candidate.id === item.dish_id);
  const quantity = Number(item.quantity || 1);
  const priceCents = Number(item.price_cents ?? dish?.price_cents ?? 0);

  return {
    dish_id: item.dish_id,
    dish_name: item.dish_name || dish?.name || 'Dish',
    quantity,
    price_cents: priceCents,
    price_at_purchase_cents: priceCents,
    dish: dish ? { name: dish.name, image_url: dish.image_url } : undefined,
    total_cents: Number(item.total_cents ?? priceCents * quantity)
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

function slugify(value) {
  return String(value || 'business')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'business';
}

function defaultBusinessSettings(businessId) {
  const now = new Date().toISOString();

  return {
    id: `settings-${businessId}`,
    business_id: businessId,
    delivery_enabled: true,
    pickup_enabled: true,
    delivery_fee_type: 'flat',
    delivery_fee_flat_cents: 0,
    delivery_fee_per_km_cents: 0,
    delivery_radius_km: 10,
    minimum_order_cents: 0,
    currency: 'USD',
    timezone: 'America/New_York',
    business_hours: {},
    created_at: now,
    updated_at: now
  };
}

function userFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const prefix = 'Bearer test-access-token-';

  if (!authHeader.startsWith(prefix)) return null;

  return state.usersById.get(authHeader.slice(prefix.length)) || null;
}

function authTokenFromRequest(req) {
  return req.headers.authorization || '';
}

function businessFromBody(body, existing = {}, owner = null, authToken = '') {
  const now = new Date().toISOString();
  const id = existing.id || `business-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const name = body.name ?? existing.name ?? 'Test Restaurant';

  return {
    id,
    owner_id: existing.owner_id || owner?.id || 'user-customer-1',
    owner_token: existing.owner_token || authToken,
    name,
    slug: body.slug ?? existing.slug ?? slugify(name),
    description: body.description ?? existing.description ?? '',
    address: body.address ?? existing.address ?? '',
    phone: body.phone ?? existing.phone ?? '',
    email: body.email ?? existing.email ?? '',
    logo_url: body.logo_url ?? existing.logo_url,
    banner_url: body.banner_url ?? existing.banner_url,
    is_active: true,
    settings: existing.settings || defaultBusinessSettings(id),
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function categoryFromBody(body) {
  const now = new Date().toISOString();
  const name = body.name || 'Category';
  const id = body.id || name;

  return {
    id,
    business_id: body.business_id || body.businessId || 'business-1',
    name,
    display_order: Number(body.display_order ?? body.displayOrder ?? state.dishCategories.length),
    created_at: now,
    updated_at: now
  };
}

function dishFromBody(body, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || body.id || `dish-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const categoryId = body.category_id ?? body.categoryId ?? existing.category_id;
  const category = categoryId
    ? state.dishCategories.find((candidate) => candidate.id === categoryId)
    : undefined;

  return {
    id,
    business_id: body.business_id ?? body.businessId ?? existing.business_id ?? 'business-1',
    name: body.name ?? existing.name ?? 'Test Dish',
    description: body.description ?? existing.description ?? '',
    price_cents: Number(body.price_cents ?? body.priceCents ?? existing.price_cents ?? 0),
    image_url: body.image_url ?? body.imageUrl ?? existing.image_url,
    category_id: categoryId,
    category,
    is_available: body.is_available ?? body.isAvailable ?? existing.is_available ?? true,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function menuWithHydratedItems(menu) {
  return {
    ...menu,
    items: (menu.items || []).map((item) => ({
      ...item,
      dish: state.dishes.find((dish) => dish.id === item.dish_id) || item.dish
    }))
  };
}

function menuFromBody(body, existing = {}) {
  const now = new Date().toISOString();
  const id = existing.id || body.id || `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    business_id: body.business_id ?? body.businessId ?? existing.business_id ?? 'business-1',
    name: body.name ?? existing.name ?? 'Main Menu',
    description: body.description ?? existing.description ?? '',
    status: body.status ?? existing.status ?? 'draft',
    items: existing.items || body.items || [],
    published_at: existing.published_at || body.published_at,
    created_at: existing.created_at || now,
    updated_at: now
  };
}

function userFromEmail(email) {
  const normalizedEmail = String(email || 'customer@example.com').toLowerCase();
  const now = new Date().toISOString();
  const role = normalizedEmail.startsWith('support.operator')
    ? 'support_agent'
    : normalizedEmail.startsWith('moderator.')
      ? 'moderator'
      : normalizedEmail.startsWith('super.admin')
        ? 'super_admin'
        : 'customer';

  return {
    id: `user-${normalizedEmail.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'customer'}`,
    email: normalizedEmail,
    name: normalizedEmail.split('@')[0] || 'Customer',
    role,
    created_at: now,
    updated_at: now
  };
}

function authPayload(operationId, status, user) {
  const fixture = canonicalFixture(operationId, status);
  const fixtureData = fixture?.data ?? {};

  return {
    success: true,
    data: {
      ...fixtureData,
      user,
      tokens: {
        ...(fixtureData.tokens ?? {}),
        accessToken: `test-access-token-${user.id}`,
        refreshToken: `test-refresh-token-${user.id}`
      }
    }
  };
}

async function handleRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = urlObj;
  const method = req.method || 'GET';

  if (pathname === '/__health' && method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      server: 'menumaker-fake-backend',
      fixture_count: canonicalFixtures.size,
      base_path: BASE_PATH
    });
    return;
  }

  if (pathname === '/__reset' && method === 'POST') {
    if (!isLocalhost(req)) {
      sendJson(res, 403, { success: false, error: { code: 'LOCALHOST_ONLY', message: 'reset is localhost only' } });
      return;
    }
    initState();
    sendJson(res, 200, { success: true, data: { reset: true } });
    return;
  }

  if (pathname === '/__seed' && method === 'POST') {
    if (!isLocalhost(req)) {
      sendJson(res, 403, { success: false, error: { code: 'LOCALHOST_ONLY', message: 'seed is localhost only' } });
      return;
    }
    const body = await parseBody(req);
    Object.assign(state, body);
    sendJson(res, 200, { success: true, data: { seeded: true } });
    return;
  }

  if (method === 'OPTIONS') {
    sendJson(res, 204, {});
    return;
  }

  const override = statusOverride(req, urlObj);

  // Auth
  if (pathname === `${BASE_PATH}/auth/signup` && method === 'POST') {
    const status = override ? Number(override) : 201;
    const body = await parseBody(req);
    const email = String(body.email || '').toLowerCase();

    if (status === 201 && state.usersByEmail.has(email)) {
      sendJson(res, 409, {
        success: false,
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'Email already registered',
          request_id: requestId(req)
        }
      });
      return;
    }

    if (status !== 201) {
      sendJson(res, status, fixtureFor(['auth', 'signup'], status));
      return;
    }

    const user = userFromEmail(email);
    state.usersByEmail.set(user.email, user);
    state.usersById.set(user.id, user);
    state.currentUser = user;
    sendJson(res, 201, authPayload('auth_signup', 201, user));
    return;
  }

  if (pathname === `${BASE_PATH}/auth/login` && method === 'POST') {
    const status = override ? Number(override) : 200;
    const body = await parseBody(req);
    const email = String(body.email || '').toLowerCase();
    const user = state.usersByEmail.get(email);

    if (status !== 200) {
      sendJson(res, status, fixtureFor(['auth', 'login'], status));
      return;
    }

    if (!user) {
      sendJson(res, 400, {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials',
          request_id: requestId(req)
        }
      });
      return;
    }

    state.currentUser = user;
    state.usersById.set(user.id, user);
    sendJson(res, 200, authPayload('auth_login', 200, user));
    return;
  }

  if (pathname === `${BASE_PATH}/auth/me` && method === 'GET') {
    const status = override ? Number(override) : 200;
    if (status !== 200) {
      sendJson(res, status, fixtureFor(['auth', 'me'], status));
      return;
    }

    const user = userFromRequest(req);
    if (!user) {
      sendJson(res, 200, {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required',
          request_id: requestId(req)
        }
      });
      return;
    }

    sendJson(res, 200, {
      success: true,
      data: {
        ...(canonicalFixture('auth_get_me', 200)?.data ?? {}),
        user
      }
    });
    return;
  }

  if (pathname === `${BASE_PATH}/auth/logout` && method === 'POST') {
    state.currentUser = null;
    sendJson(res, 200, { success: true, data: { logged_out: true } });
    return;
  }

  // Businesses
  if (pathname === `${BASE_PATH}/businesses` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const authToken = authTokenFromRequest(req);
    const owner = userFromRequest(req) || state.currentUser;
    const businesses = authToken
      ? state.businesses.filter((business) => business.owner_token === authToken)
      : owner
        ? state.businesses.filter((business) => business.owner_id === owner.id)
        : state.businesses;
    const payload =
      status === 200
        ? { success: true, data: { businesses } }
        : fixtureFor(['businesses', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/businesses` && method === 'POST') {
    const body = await parseBody(req);
    const business = businessFromBody(body, {}, userFromRequest(req) || state.currentUser, authTokenFromRequest(req));
    state.businesses.unshift(business);
    sendJson(res, 201, { success: true, data: { business } });
    return;
  }

  const businessId = matchId(pathname, '/businesses');
  if (businessId && method === 'PUT') {
    const body = await parseBody(req);
    const owner = userFromRequest(req);
    const authToken = authTokenFromRequest(req);
    const effectiveOwner = owner || state.currentUser;
    const index = state.businesses.findIndex(
      (b) =>
        b.id === businessId &&
        (authToken ? b.owner_token === authToken : !effectiveOwner || b.owner_id === effectiveOwner.id)
    );
    const existing = index >= 0 ? state.businesses[index] : { id: businessId };
    const business = businessFromBody(body, existing, effectiveOwner, authToken);

    if (index >= 0) {
      state.businesses[index] = business;
    } else {
      state.businesses.unshift(business);
    }

    sendJson(res, 200, { success: true, data: { business } });
    return;
  }

  if (businessId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const authToken = authTokenFromRequest(req);
    const owner = userFromRequest(req) || state.currentUser;
    const business = state.businesses.find(
      (b) => b.id === businessId && (authToken ? b.owner_token === authToken : !owner || b.owner_id === owner.id)
    );
    const payload =
      status === 200 && business
        ? { success: true, data: { business } }
        : fixtureFor(['businesses', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  const businessSettingsMatch = pathname.match(new RegExp(`^${BASE_PATH}/businesses/([^/]+)/settings$`));
  if (businessSettingsMatch && method === 'PUT') {
    const body = await parseBody(req);
    const businessIdForSettings = businessSettingsMatch[1];
    const authToken = authTokenFromRequest(req);
    const owner = userFromRequest(req) || state.currentUser;
    const business = state.businesses.find(
      (candidate) =>
        candidate.id === businessIdForSettings &&
        (authToken ? candidate.owner_token === authToken : !owner || candidate.owner_id === owner.id)
    );
    const currentSettings = business?.settings || defaultBusinessSettings(businessIdForSettings);
    const settings = {
      ...currentSettings,
      ...body,
      delivery_enabled:
        body.delivery_enabled || Number(body.delivery_fee_flat_cents || 0) > 0 || currentSettings.delivery_enabled,
      updated_at: new Date().toISOString()
    };

    if (business) {
      business.settings = settings;
    }

    sendJson(res, 200, { success: true, data: { settings } });
    return;
  }

  const businessSlugMatch = pathname.match(new RegExp(`^${BASE_PATH}/businesses/slug/([^/]+)$`));
  if (businessSlugMatch && method === 'GET') {
    const status = override ? Number(override) : 200;
    const slug = businessSlugMatch[1];
    const business = state.businesses.find((candidate) => candidate.slug === slug);
    const payload =
      status === 200 && business
        ? { success: true, data: { business } }
        : {
            success: false,
            error: {
              code: 'BUSINESS_NOT_FOUND',
              message: 'Business not found',
              request_id: requestId(req)
            }
          };
    sendJson(res, business ? status : 404, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/media/upload` && method === 'POST') {
    sendJson(res, 201, {
      success: true,
      data: {
        url: 'https://cdn.example.test/uploads/test-image.png'
      }
    });
    return;
  }

  // Menus
  if (pathname === `${BASE_PATH}/menus` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const businessIdFilter = urlObj.searchParams.get('businessId') || urlObj.searchParams.get('business_id');
    const menus = businessIdFilter
      ? state.menus.filter((menu) => menu.business_id === businessIdFilter).map(menuWithHydratedItems)
      : state.menus.map(menuWithHydratedItems);
    const payload =
      status === 200
        ? { success: true, data: { menus } }
        : fixtureFor(['menus', 'list'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/menus` && method === 'POST') {
    const body = await parseBody(req);
    const menu = menuFromBody(body);
    state.menus.unshift(menu);
    sendJson(res, 201, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  if (pathname === `${BASE_PATH}/menus/active` && method === 'GET') {
    const businessIdFilter = urlObj.searchParams.get('businessId') || urlObj.searchParams.get('business_id');
    const menu = state.menus.find(
      (candidate) => candidate.business_id === businessIdFilter && candidate.status === 'published'
    );

    if (!menu) {
      sendJson(res, 404, {
        success: false,
        error: {
          code: 'ACTIVE_MENU_NOT_FOUND',
          message: 'No active menu available',
          request_id: requestId(req)
        }
      });
      return;
    }

    sendJson(res, 200, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  const menuItemMatch = pathname.match(new RegExp(`^${BASE_PATH}/menus/([^/]+)/items$`));
  if (menuItemMatch && method === 'POST') {
    const body = await parseBody(req);
    const menu = state.menus.find((candidate) => candidate.id === menuItemMatch[1]);

    if (!menu) {
      sendJson(res, 404, fixtureFor(['menus', 'detail'], 404));
      return;
    }

    const dishId = body.dish_id || body.dishId;
    if (!menu.items.some((item) => item.dish_id === dishId)) {
      menu.items.push({
        dish_id: dishId,
        price_override_cents: body.price_override_cents
      });
    }
    menu.updated_at = new Date().toISOString();

    sendJson(res, 200, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  const menuItemDeleteMatch = pathname.match(new RegExp(`^${BASE_PATH}/menus/([^/]+)/items/([^/]+)$`));
  if (menuItemDeleteMatch && method === 'DELETE') {
    const menu = state.menus.find((candidate) => candidate.id === menuItemDeleteMatch[1]);

    if (!menu) {
      sendJson(res, 404, fixtureFor(['menus', 'detail'], 404));
      return;
    }

    menu.items = menu.items.filter((item) => item.dish_id !== menuItemDeleteMatch[2]);
    menu.updated_at = new Date().toISOString();
    sendJson(res, 200, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  const menuPublishMatch = pathname.match(new RegExp(`^${BASE_PATH}/menus/([^/]+)/publish$`));
  if (menuPublishMatch && method === 'POST') {
    const menu = state.menus.find((candidate) => candidate.id === menuPublishMatch[1]);

    if (!menu) {
      sendJson(res, 404, fixtureFor(['menus', 'detail'], 404));
      return;
    }

    for (const candidate of state.menus) {
      if (candidate.business_id === menu.business_id && candidate.id !== menu.id && candidate.status === 'published') {
        candidate.status = 'archived';
        candidate.updated_at = new Date().toISOString();
      }
    }

    if (!Array.isArray(menu.items) || menu.items.length === 0) {
      menu.items = state.dishes
        .filter((dish) => dish.business_id === menu.business_id)
        .map((dish) => ({ dish_id: dish.id }));
    }

    menu.status = 'published';
    menu.published_at = new Date().toISOString();
    menu.updated_at = menu.published_at;
    sendJson(res, 200, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  const menuArchiveMatch = pathname.match(new RegExp(`^${BASE_PATH}/menus/([^/]+)/archive$`));
  if (menuArchiveMatch && method === 'POST') {
    const menu = state.menus.find((candidate) => candidate.id === menuArchiveMatch[1]);

    if (!menu) {
      sendJson(res, 404, fixtureFor(['menus', 'detail'], 404));
      return;
    }

    menu.status = 'archived';
    menu.updated_at = new Date().toISOString();
    sendJson(res, 200, { success: true, data: { menu: menuWithHydratedItems(menu) } });
    return;
  }

  const menuId = matchId(pathname, '/menus');
  if (menuId && method === 'GET') {
    const status = override ? Number(override) : 200;
    const menu = state.menus.find((m) => m.id === menuId);
    const payload =
      status === 200 && menu
        ? { success: true, data: { menu: menuWithHydratedItems(menu) } }
        : fixtureFor(['menus', 'detail'], status === 200 ? 404 : status);
    sendJson(res, payload.status || status, payload);
    return;
  }

  // Dishes
  if (pathname === `${BASE_PATH}/dishes` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const businessIdFilter = urlObj.searchParams.get('businessId') || urlObj.searchParams.get('business_id');
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

  if (pathname === `${BASE_PATH}/dishes` && method === 'POST') {
    const body = await parseBody(req);
    const dish = dishFromBody(body);
    state.dishes.unshift(dish);
    sendJson(res, 201, { success: true, data: { dish } });
    return;
  }

  if (pathname === `${BASE_PATH}/dishes/categories` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const businessIdFilter = urlObj.searchParams.get('businessId') || urlObj.searchParams.get('business_id');
    const categories = businessIdFilter
      ? state.dishCategories.filter((category) => category.business_id === businessIdFilter)
      : state.dishCategories;
    sendJson(
      res,
      status,
      status === 200 ? { success: true, data: { categories } } : fixtureFor(['dishes', 'categories'], status)
    );
    return;
  }

  if (pathname === `${BASE_PATH}/dishes/categories` && method === 'POST') {
    const body = await parseBody(req);
    const category = categoryFromBody(body);
    state.dishCategories.push(category);
    sendJson(res, 201, { success: true, data: { category } });
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

  if (dishId && method === 'PUT') {
    const body = await parseBody(req);
    const index = state.dishes.findIndex((dish) => dish.id === dishId);

    if (index < 0) {
      sendJson(res, 404, fixtureFor(['dishes', 'detail'], 404));
      return;
    }

    const dish = dishFromBody(body, state.dishes[index]);
    state.dishes[index] = dish;
    sendJson(res, 200, { success: true, data: { dish } });
    return;
  }

  if (dishId && method === 'DELETE') {
    state.dishes = state.dishes.filter((dish) => dish.id !== dishId);
    for (const menu of state.menus) {
      menu.items = menu.items.filter((item) => item.dish_id !== dishId);
    }
    sendJson(res, 200, { success: true, data: { deleted: true } });
    return;
  }

  // Orders
  if (pathname === `${BASE_PATH}/orders` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const businessIdFilter = urlObj.searchParams.get('businessId') || urlObj.searchParams.get('business_id');
    const statusFilter = urlObj.searchParams.get('status');
    const orders = state.orders.filter((order) => {
      const matchesBusiness = !businessIdFilter || order.business_id === businessIdFilter;
      const matchesStatus = !statusFilter || order.order_status === statusFilter || order.status === statusFilter;
      return matchesBusiness && matchesStatus;
    });
    const payload =
      status === 200
        ? { success: true, data: { orders, total: orders.length } }
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

  const orderStatusMatch = pathname.match(new RegExp(`^${BASE_PATH}/orders/([^/]+)/status$`));
  if (orderStatusMatch && method === 'PUT') {
    const body = await parseBody(req);
    const order = state.orders.find((candidate) => candidate.id === orderStatusMatch[1]);

    if (!order) {
      sendJson(res, 404, fixtureFor(['orders', 'detail'], 404));
      return;
    }

    order.status = body.status || body.order_status || order.status;
    order.order_status = body.order_status || body.status || order.order_status;
    order.updated_at = new Date().toISOString();
    if (order.order_status === 'fulfilled') {
      order.fulfilled_at = order.updated_at;
    }

    sendJson(res, 200, { success: true, data: { order } });
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
        ? canonicalFixture('coupon_list', 200) ?? { success: true, data: { coupons: state.coupons } }
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
        ? canonicalFixture('notification_list', 200) ?? {
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

  if (pathname === `${BASE_PATH}/payments/create-intent` && method === 'POST') {
    const status = override ? Number(override) : 201;
    const payload = canonicalFixture('payment_create_intent', status) ?? fixtureFor(['payments', 'create-intent'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/reports/dashboard` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? {
            success: true,
            data: {
              stats: {
                totalOrders: state.orders.length,
                totalRevenue: state.orders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0),
                averageOrderValue:
                  state.orders.length > 0
                    ? Math.round(state.orders.reduce((sum, order) => sum + Number(order.total_cents || 0), 0) / state.orders.length)
                    : 0,
                pendingOrders: state.orders.filter((order) => (order.order_status || order.status) === 'pending').length,
                completedOrders: state.orders.filter((order) =>
                  ['fulfilled', 'completed'].includes(order.order_status || order.status)
                ).length,
                revenueByDay: []
              }
            }
          }
        : fixtureFor(['reports', 'dashboard'], status);
    sendJson(res, status, payload);
    return;
  }

  // Admin portal smoke data
  if (pathname === `${BASE_PATH}/admin/analytics/dashboard` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const payload =
      status === 200
        ? {
            success: true,
            data: {
              active_users: state.usersById.size,
              total_businesses: state.businesses.length,
              open_tickets: 1,
              pending_moderation: 1,
              disabled_capabilities: [
                'ocr_menu_import',
                'paid_subscriptions',
                'enhanced_referrals_affiliates',
                'tax_reporting',
                'pos_sync',
                'delivery_partner_integrations'
              ]
            }
          }
        : fixtureFor(['admin', 'analytics'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/admin/users` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const users = [
      {
        id: 'admin-support-1',
        email: 'support.operator@example.test',
        role: 'support_agent',
        created_at: new Date(0).toISOString()
      },
      ...Array.from(state.usersById.values())
    ];
    const payload =
      status === 200
        ? { success: true, data: { users, total: users.length, limit: 5, offset: 0 } }
        : fixtureFor(['admin', 'users'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/admin/moderation/queue` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const flags = [
      {
        id: 'flag-menu-image-1',
        flag_type: 'menu_image_review',
        target_type: 'dish',
        target_id: 'dish-review-1',
        status: 'pending'
      }
    ];
    const payload =
      status === 200
        ? { success: true, data: { flags, total: flags.length, pending: flags.length } }
        : fixtureFor(['admin', 'moderation'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/admin/tickets` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const tickets = [
      {
        id: 'ticket-launch-1',
        subject: 'Launch readiness review',
        status: 'open',
        priority: 'normal'
      }
    ];
    const payload =
      status === 200
        ? { success: true, data: { tickets, total: tickets.length, open: tickets.length } }
        : fixtureFor(['admin', 'tickets'], status);
    sendJson(res, status, payload);
    return;
  }

  if (pathname === `${BASE_PATH}/admin/feature-flags` && method === 'GET') {
    const status = override ? Number(override) : 200;
    const flags = [
      { key: 'admin_portal', enabled: true, state: 'implemented' },
      { key: 'ocr_menu_import', enabled: false, state: 'disabled' },
      { key: 'paid_subscriptions', enabled: false, state: 'disabled' },
      { key: 'enhanced_referrals_affiliates', enabled: false, state: 'disabled' }
    ];
    const payload =
      status === 200
        ? { success: true, data: { featureFlags: flags, total: flags.length } }
        : fixtureFor(['admin', 'feature-flags'], status);
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
  const status = override ? Number(override) : pathname.startsWith(BASE_PATH) ? 500 : 404;
  const payload = pathname.startsWith(BASE_PATH)
    ? {
        success: false,
        error: {
          code: 'UNHANDLED_OPERATION',
          message: `${method} ${pathname} is not handled by the canonical fake backend`,
          request_id: requestId(req)
        }
      }
    : fixtureFor(['errors'], status);
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

  server.listen(PORT, '127.0.0.1', () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`[fake-backend] running on port ${actualPort} (base path ${BASE_PATH})`);
    console.log(`[fake-backend] health: http://127.0.0.1:${actualPort}/__health`);
    console.log(`[fake-backend] status override: ?status=400 or header x-mock-status: 400`);
  });
}

start();
