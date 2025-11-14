import { useState, useEffect } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { CheckoutForm } from './CheckoutForm';

// Load Stripe
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface PaymentModalProps {
  orderId: string;
  amount: number;
  currency: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/**
 * Payment Modal
 * Handles the payment flow using Stripe Elements
 */
export function PaymentModal({
  orderId,
  amount,
  currency,
  onSuccess,
  onCancel,
}: PaymentModalProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    async function createPaymentIntent() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await api.createPaymentIntent(orderId);

        if (response.success) {
          setClientSecret(response.data.clientSecret);
        } else {
          setError(response.error?.message || 'Failed to initialize payment');
        }
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to initialize payment');
      } finally {
        setIsLoading(false);
      }
    }

    createPaymentIntent();
  }, [orderId]);

  const handlePaymentSuccess = () => {
    setPaymentSuccess(true);
    setTimeout(() => {
      onSuccess();
    }, 2000); // Show success message for 2 seconds
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto p-4">
      <div className="max-w-2xl mx-auto bg-white rounded-lg my-8">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Complete Payment</h2>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-gray-100 rounded-lg"
              disabled={isLoading || paymentSuccess}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-4" />
              <p className="text-gray-600">Initializing payment...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="text-center py-12">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800">{error}</p>
              </div>
              <button onClick={onCancel} className="btn-secondary mt-6">
                Close
              </button>
            </div>
          )}

          {/* Success State */}
          {paymentSuccess && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful!</h3>
              <p className="text-gray-600">Your order has been confirmed.</p>
            </div>
          )}

          {/* Payment Form */}
          {!isLoading && !error && !paymentSuccess && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    spacingUnit: '4px',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <CheckoutForm
                clientSecret={clientSecret}
                amount={amount}
                currency={currency}
                onSuccess={handlePaymentSuccess}
                onCancel={onCancel}
              />
            </Elements>
          )}
        </div>
      </div>
    </div>
  );
}
