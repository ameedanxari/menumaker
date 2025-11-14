import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { PaymentModal } from '../components/payments/PaymentModal';
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Phone,
  Mail,
  MapPin,
  Loader2,
  ShoppingBag,
  ImageIcon,
} from 'lucide-react';

interface Business {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  banner_url?: string;
  settings?: {
    delivery_enabled: boolean;
    pickup_enabled: boolean;
    delivery_fee_type: 'flat' | 'distance' | 'free';
    delivery_fee_flat_cents: number;
    minimum_order_cents: number;
    currency: string;
  };
}

interface Dish {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  image_url?: string;
  category?: { name: string };
  is_available: boolean;
}

interface MenuItem {
  dish_id: string;
  price_override_cents?: number;
  dish?: Dish;
}

interface Menu {
  id: string;
  name: string;
  description?: string;
  items?: MenuItem[];
}

export default function PublicMenuPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    setBusinessId,
    getTotal,
    getItemCount,
  } = useCartStore();

  const [checkoutForm, setCheckoutForm] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    deliveryType: 'pickup' as 'pickup' | 'delivery',
    deliveryAddress: '',
    notes: '',
    paymentMethod: 'cash' as 'cash' | 'card' | 'online',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      if (!businessSlug) return;

      try {
        setIsLoading(true);
        setError('');

        // Fetch business
        const businessResponse = await api.getBusinessBySlug(businessSlug);
        if (!businessResponse.success) {
          setError('Business not found');
          return;
        }

        const businessData = businessResponse.data.business;
        setBusiness(businessData);
        setBusinessId(businessData.id);

        // Fetch active menu
        try {
          const menuResponse = await api.getActiveMenu(businessData.id);
          if (menuResponse.success) {
            setMenu(menuResponse.data.menu);
          }
        } catch (err) {
          setError('No active menu available');
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load menu');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [businessSlug, setBusinessId]);

  const groupedItems = menu?.items?.reduce((acc, item) => {
    if (!item.dish?.is_available) return acc;

    const categoryName = item.dish.category?.name || 'Other';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const handleAddToCart = (item: MenuItem) => {
    if (!item.dish) return;

    addItem({
      dishId: item.dish.id,
      dishName: item.dish.name,
      price: (item.price_override_cents || item.dish.price_cents) / 100,
      imageUrl: item.dish.image_url,
    });
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) return;
    if (!business) return;

    setIsSubmitting(true);
    setError('');

    try {
      const orderItems = items.map((item) => ({
        dish_id: item.dishId,
        quantity: item.quantity,
      }));

      const response = await api.createOrder({
        business_id: business.id,
        customer_name: checkoutForm.customerName,
        customer_phone: checkoutForm.customerPhone,
        customer_email: checkoutForm.customerEmail || undefined,
        delivery_type: checkoutForm.deliveryType,
        delivery_address:
          checkoutForm.deliveryType === 'delivery'
            ? checkoutForm.deliveryAddress
            : undefined,
        items: orderItems,
        notes: checkoutForm.notes || undefined,
        payment_method: checkoutForm.paymentMethod,
      });

      // If payment method is online, show payment modal
      if (checkoutForm.paymentMethod === 'online' && response.success) {
        setPendingOrderId(response.data.order.id);
        setShowCheckout(false);
        setShowPaymentModal(true);
      } else {
        // For cash/card (COD), order is complete
        setOrderSuccess(true);
        clearCart();
        setShowCheckout(false);
        setShowCart(false);
        setTimeout(() => setOrderSuccess(false), 5000);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPendingOrderId(null);
    setOrderSuccess(true);
    clearCart();
    setShowCart(false);
    setTimeout(() => setOrderSuccess(false), 5000);
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setPendingOrderId(null);
    setShowCheckout(true);
  };

  const deliveryFee =
    checkoutForm.deliveryType === 'delivery' && business?.settings
      ? business.settings.delivery_fee_type === 'flat'
        ? business.settings.delivery_fee_flat_cents / 100
        : 0
      : 0;

  const subtotal = getTotal();
  const total = subtotal + deliveryFee;
  const minimumOrder = business?.settings?.minimum_order_cents
    ? business.settings.minimum_order_cents / 100
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card max-w-md text-center">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
          <p className="text-gray-600">
            The business you're looking for doesn't exist or is not available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Banner */}
      {business?.banner_url && (
        <div className="w-full h-64 bg-gray-200">
          <img
            src={business.banner_url}
            alt={business.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Business Info */}
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="card mb-6">
          <div className="flex items-start gap-4">
            {business?.logo_url && (
              <img
                src={business.logo_url}
                alt={business.name}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">{business?.name}</h1>
              {business?.description && (
                <p className="text-gray-600 mt-2">{business.description}</p>
              )}

              <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                {business?.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    {business.phone}
                  </div>
                )}
                {business?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {business.email}
                  </div>
                )}
                {business?.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    {business.address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {orderSuccess && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              Order placed successfully! We'll contact you shortly.
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && business && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Menu */}
        {menu && groupedItems && Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{category}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item) => (
                    <div key={item.dish_id} className="card hover:shadow-md transition-shadow">
                      <div className="flex gap-4">
                        <div className="w-24 h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          {item.dish?.image_url ? (
                            <img
                              src={item.dish.image_url}
                              alt={item.dish.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-8 h-8 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900">{item.dish?.name}</h3>
                          {item.dish?.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {item.dish.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-semibold text-primary-600">
                              ${((item.price_override_cents || item.dish?.price_cents || 0) / 100).toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleAddToCart(item)}
                              className="btn-primary text-sm inline-flex items-center gap-1 px-3 py-1"
                            >
                              <Plus className="w-4 h-4" />
                              Add
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center py-12">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No menu items available at this time.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {getItemCount() > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 right-6 btn-primary rounded-full w-16 h-16 shadow-lg flex items-center justify-center"
        >
          <div className="relative">
            <ShoppingCart className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {getItemCount()}
            </span>
          </div>
        </button>
      )}

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setShowCart(false)}>
          <div
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Your Cart</h2>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Your cart is empty</p>
                </div>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {items.map((item) => (
                      <div key={item.dishId} className="flex gap-4 items-center p-4 bg-gray-50 rounded-lg">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={item.dishName}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900">{item.dishName}</h3>
                          <p className="text-sm text-gray-600">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.dishId, item.quantity - 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.dishId, item.quantity + 1)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => removeItem(item.dishId)}
                            className="p-1 hover:bg-red-50 rounded ml-2"
                          >
                            <X className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 pt-4 mb-6">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Subtotal:</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    {minimumOrder > 0 && subtotal < minimumOrder && (
                      <p className="text-sm text-red-600 mt-2">
                        Minimum order: ${minimumOrder.toFixed(2)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={clearCart} className="btn-secondary flex-1">
                      Clear Cart
                    </button>
                    <button
                      onClick={() => {
                        setShowCart(false);
                        setShowCheckout(true);
                      }}
                      className="btn-primary flex-1"
                      disabled={subtotal < minimumOrder}
                    >
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto p-4">
          <div className="max-w-2xl mx-auto bg-white rounded-lg my-8">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Checkout</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCheckout} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="customerName" className="label">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="customerName"
                    type="text"
                    value={checkoutForm.customerName}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, customerName: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="customerPhone" className="label">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="customerPhone"
                    type="tel"
                    value={checkoutForm.customerPhone}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, customerPhone: e.target.value })
                    }
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="customerEmail" className="label">
                  Email (optional)
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  value={checkoutForm.customerEmail}
                  onChange={(e) =>
                    setCheckoutForm({ ...checkoutForm, customerEmail: e.target.value })
                  }
                  className="input"
                />
              </div>

              {/* Delivery Type */}
              {business?.settings && (
                <div>
                  <label className="label">Delivery Type</label>
                  <div className="flex gap-4">
                    {business.settings.pickup_enabled && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="pickup"
                          checked={checkoutForm.deliveryType === 'pickup'}
                          onChange={(e) =>
                            setCheckoutForm({
                              ...checkoutForm,
                              deliveryType: e.target.value as 'pickup',
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span>Pickup</span>
                      </label>
                    )}
                    {business.settings.delivery_enabled && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deliveryType"
                          value="delivery"
                          checked={checkoutForm.deliveryType === 'delivery'}
                          onChange={(e) =>
                            setCheckoutForm({
                              ...checkoutForm,
                              deliveryType: e.target.value as 'delivery',
                            })
                          }
                          className="w-4 h-4"
                        />
                        <span>Delivery</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              {checkoutForm.deliveryType === 'delivery' && (
                <div>
                  <label htmlFor="deliveryAddress" className="label">
                    Delivery Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="deliveryAddress"
                    value={checkoutForm.deliveryAddress}
                    onChange={(e) =>
                      setCheckoutForm({ ...checkoutForm, deliveryAddress: e.target.value })
                    }
                    className="input min-h-[80px]"
                    required={checkoutForm.deliveryType === 'delivery'}
                  />
                </div>
              )}

              <div>
                <label htmlFor="notes" className="label">
                  Notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={checkoutForm.notes}
                  onChange={(e) =>
                    setCheckoutForm({ ...checkoutForm, notes: e.target.value })
                  }
                  className="input min-h-[80px]"
                  placeholder="Any special instructions..."
                />
              </div>

              <div>
                <label className="label">Payment Method</label>
                <select
                  value={checkoutForm.paymentMethod}
                  onChange={(e) =>
                    setCheckoutForm({
                      ...checkoutForm,
                      paymentMethod: e.target.value as 'cash' | 'card' | 'online',
                    })
                  }
                  className="input"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>

              {/* Order Summary */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {checkoutForm.deliveryType === 'delivery' && deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span>${deliveryFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-primary flex-1" disabled={isSubmitting}>
                  {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCheckout(false)}
                  className="btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && pendingOrderId && (
        <PaymentModal
          orderId={pendingOrderId}
          amount={Math.round(total * 100)} // Convert to cents
          currency={business?.settings?.currency || 'INR'}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}
    </div>
  );
}
