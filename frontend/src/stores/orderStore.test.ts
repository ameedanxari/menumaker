import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOrderStore } from './orderStore';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getOrders: vi.fn(),
    getOrderById: vi.fn(),
    updateOrderStatus: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  getOrders: ReturnType<typeof vi.fn>;
  getOrderById: ReturnType<typeof vi.fn>;
  updateOrderStatus: ReturnType<typeof vi.fn>;
};

const resetStore = () => {
  useOrderStore.setState({
    orders: [],
    isLoading: false,
    error: null,
  });
};

describe('orderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('loads orders', async () => {
    mockedApi.getOrders.mockResolvedValue({
      success: true,
      data: { orders: [{ id: 'o1', business_id: 'b1', customer_name: 'A', customer_phone: '1', delivery_type: 'pickup', delivery_fee_cents: 0, total_cents: 1000, payment_method: 'cash', payment_status: 'pending', order_status: 'pending', created_at: '', updated_at: '' }] },
    });

    await useOrderStore.getState().fetchOrders('b1');

    expect(useOrderStore.getState().orders).toHaveLength(1);
    expect(useOrderStore.getState().isLoading).toBe(false);
  });

  it('surfaces fetch errors', async () => {
    mockedApi.getOrders.mockRejectedValue({
      response: { data: { error: { message: 'fail' } } },
    });

    await useOrderStore.getState().fetchOrders('b1');

    expect(useOrderStore.getState().error).toBe('fail');
    expect(useOrderStore.getState().isLoading).toBe(false);
  });

  it('updates order status in cache', async () => {
    useOrderStore.setState({
      orders: [{
        id: 'o1', business_id: 'b1', customer_name: 'A', customer_phone: '1', delivery_type: 'pickup',
        delivery_fee_cents: 0, total_cents: 1000, payment_method: 'cash', payment_status: 'pending', order_status: 'pending',
        created_at: '', updated_at: '',
      }],
      isLoading: false,
      error: null,
    });

    mockedApi.updateOrderStatus.mockResolvedValue({
      success: true,
      data: { order: { ...useOrderStore.getState().orders[0], order_status: 'confirmed' } },
    });

    await useOrderStore.getState().updateOrderStatus('o1', 'confirmed');

    expect(useOrderStore.getState().orders[0]?.order_status).toBe('confirmed');
    expect(useOrderStore.getState().isLoading).toBe(false);
  });

  it('returns null on missing order by id', async () => {
    mockedApi.getOrderById.mockResolvedValue({ success: false });
    const result = await useOrderStore.getState().getOrderById('missing');
    expect(result).toBeNull();
  });
});
