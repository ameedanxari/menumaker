// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import OrdersPage from './OrdersPage';

const businessState: any = {
  currentBusiness: { id: 'b1', name: 'Biz' },
};

const orderState: any = {
  orders: [
    {
      id: 'order-1',
      business_id: 'b1',
      customer_name: 'Alice',
      customer_phone: '123',
      delivery_type: 'pickup',
      delivery_fee_cents: 0,
      total_cents: 1500,
      payment_method: 'cash',
      payment_status: 'pending',
      order_status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [{ id: 'i1', dish_id: 'd1', quantity: 1, price_at_purchase_cents: 1500, dish: { name: 'Dish' } }],
    },
  ],
  fetchOrders: vi.fn().mockResolvedValue(undefined),
  updateOrderStatus: vi.fn().mockResolvedValue(undefined),
  isLoading: false,
};

vi.mock('../stores/businessStore', () => ({
  useBusinessStore: () => businessState,
}));

vi.mock('../stores/orderStore', () => ({
  useOrderStore: () => orderState,
}));

const render = async () => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<OrdersPage />);
  });
  return { container, root };
};

describe('OrdersPage', () => {
  afterEach(() => {
    orderState.fetchOrders.mockClear();
    orderState.updateOrderStatus.mockClear();
    businessState.currentBusiness = { id: 'b1', name: 'Biz' };
    orderState.orders = [...orderState.orders];
    vi.useRealTimers();
  });

  it('prompts to create business when none exists', async () => {
    businessState.currentBusiness = null;
    const { container, root } = await render();
    expect(container.textContent).toContain('Please create a business profile');
    root.unmount();
  });

  it('loads orders and allows status update actions', async () => {
    vi.useFakeTimers();
    const { container, root } = await render();
    expect(orderState.fetchOrders).toHaveBeenCalledWith('b1', undefined);
    expect(container.textContent).toContain('Alice');

    const viewBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('View Details')
    );
    await act(async () => {
      viewBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Confirm')
    );
    await act(async () => {
      confirmBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      vi.runAllTimers();
    });

    expect(orderState.updateOrderStatus).toHaveBeenCalledWith('order-1', 'confirmed');
    root.unmount();
  });
});
