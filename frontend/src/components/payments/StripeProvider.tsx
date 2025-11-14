import { ReactNode } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Load Stripe outside component to avoid recreating on every render
let stripePromise: Promise<Stripe | null> | null = null;

const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('VITE_STRIPE_PUBLISHABLE_KEY is not set');
      return null;
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

interface StripeProviderProps {
  children: ReactNode;
}

/**
 * Stripe Elements Provider
 * Wraps the app to provide Stripe context for payment components
 */
export function StripeProvider({ children }: StripeProviderProps) {
  const stripe = getStripe();

  if (!stripe) {
    console.warn('Stripe not initialized - payments will not work');
    return <>{children}</>;
  }

  return (
    <Elements stripe={stripe}>
      {children}
    </Elements>
  );
}
