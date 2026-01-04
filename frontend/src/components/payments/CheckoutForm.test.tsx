// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { CheckoutForm } from './CheckoutForm';

const mockConfirmPayment = vi.fn();
let stripeAvailable = true;

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => (stripeAvailable ? { confirmPayment: mockConfirmPayment } : null),
  useElements: () => (stripeAvailable ? {} : null),
}));

describe('CheckoutForm', () => {
  afterEach(() => {
    mockConfirmPayment.mockReset();
    stripeAvailable = true;
    vi.useRealTimers();
  });

  const render = async (props: Partial<React.ComponentProps<typeof CheckoutForm>> = {}) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <CheckoutForm
          clientSecret="cs"
          amount={1500}
          currency="usd"
          onSuccess={vi.fn()}
          onCancel={vi.fn()}
          {...props}
        />
      );
    });
    return { container, root };
  };

  it('shows error when Stripe is not ready', async () => {
    vi.useFakeTimers();
    stripeAvailable = false;
    const { container, root } = await render();

    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      vi.runAllTimers();
    });

    expect(container.textContent).toContain('Stripe not initialized');
    root.unmount();
  });

  it('submits payment and calls success on succeeded intent', async () => {
    vi.useFakeTimers();
    const onSuccess = vi.fn();
    mockConfirmPayment.mockResolvedValue({
      paymentIntent: { status: 'succeeded' },
    });
    const { container, root } = await render({ onSuccess });

    const form = container.querySelector('form');
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      vi.runAllTimers();
    });

    expect(mockConfirmPayment).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    root.unmount();
  });
});
