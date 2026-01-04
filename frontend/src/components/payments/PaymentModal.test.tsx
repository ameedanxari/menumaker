// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { PaymentModal } from './PaymentModal';

const mockCreatePaymentIntent = vi.fn();
const mockConfirmPayment = vi.fn();

vi.mock('../../services/api', () => ({
  api: {
    createPaymentIntent: (...args: any[]) => mockCreatePaymentIntent(...args),
  },
}));

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div data-testid="elements">{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: mockConfirmPayment }),
  useElements: () => ({}),
}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue({}),
}));

const render = async (props: Partial<React.ComponentProps<typeof PaymentModal>> = {}) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PaymentModal
        orderId="order-1"
        amount={2000}
        currency="usd"
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
        {...props}
      />
    );
  });
  return { container, root };
};

describe('PaymentModal', () => {
  afterEach(() => {
    mockCreatePaymentIntent.mockReset();
    vi.useRealTimers();
  });

  it('loads payment intent and renders checkout form', async () => {
    vi.useFakeTimers();
    mockCreatePaymentIntent.mockResolvedValue({
      success: true,
      data: { clientSecret: 'cs_test' },
    });

    const { container, root } = await render();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(mockCreatePaymentIntent).toHaveBeenCalledWith('order-1');
    expect(container.querySelector('[data-testid="payment-element"]')).toBeTruthy();
    root.unmount();
  });

  it('shows error when payment intent fails', async () => {
    vi.useFakeTimers();
    mockCreatePaymentIntent.mockRejectedValue(new Error('fail'));

    const { container, root } = await render();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(container.textContent).toContain('Failed to initialize payment');
    root.unmount();
  });
});
