import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore } from './cartStore.ts';

describe('Cart Store', () => {
    beforeEach(() => {
        // Reset store
        useCartStore.getState().clearCart();
        // Assuming clearCart resets items and businessId
        // But we might need to be explicit if clearCart logic changes
        useCartStore.setState({ items: [], businessId: null });
    });

    const mockItem = {
        dishId: 'dish-1',
        dishName: 'Pizza',
        price: 10,
        imageUrl: 'img.jpg'
    };

    it('should start empty', () => {
        expect(useCartStore.getState().items).toHaveLength(0);
        expect(useCartStore.getState().getItemCount()).toBe(0);
        expect(useCartStore.getState().getTotal()).toBe(0);
    });

    it('should add new item', () => {
        useCartStore.getState().addItem(mockItem);

        expect(useCartStore.getState().items).toHaveLength(1);
        expect(useCartStore.getState().items[0]).toEqual({ ...mockItem, quantity: 1 });
        expect(useCartStore.getState().getItemCount()).toBe(1);
        expect(useCartStore.getState().getTotal()).toBe(10);
    });

    it('should increment quantity if adding existing item', () => {
        useCartStore.getState().addItem(mockItem);
        useCartStore.getState().addItem(mockItem);

        expect(useCartStore.getState().items).toHaveLength(1);
        expect(useCartStore.getState().items[0].quantity).toBe(2);
        expect(useCartStore.getState().getItemCount()).toBe(2);
        expect(useCartStore.getState().getTotal()).toBe(20);
    });

    it('should remove item', () => {
        useCartStore.getState().addItem(mockItem);
        useCartStore.getState().removeItem('dish-1');

        expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should update quantity', () => {
        useCartStore.getState().addItem(mockItem);
        useCartStore.getState().updateQuantity('dish-1', 5);

        expect(useCartStore.getState().items[0].quantity).toBe(5);
        expect(useCartStore.getState().getTotal()).toBe(50);
    });

    it('should remove item if quantity updated to 0', () => {
        useCartStore.getState().addItem(mockItem);
        useCartStore.getState().updateQuantity('dish-1', 0);

        expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should clear cart', () => {
        useCartStore.getState().addItem(mockItem);
        useCartStore.getState().setBusinessId('biz-1');

        useCartStore.getState().clearCart();

        expect(useCartStore.getState().items).toHaveLength(0);
        expect(useCartStore.getState().businessId).toBeNull();
    });

    it('should handle businessId', () => {
        useCartStore.getState().setBusinessId('biz-1');
        expect(useCartStore.getState().businessId).toBe('biz-1');
    });

    it('should clear cart if businessId changes', () => {
        useCartStore.getState().setBusinessId('biz-1');
        useCartStore.getState().addItem(mockItem);

        useCartStore.getState().setBusinessId('biz-2');

        expect(useCartStore.getState().businessId).toBe('biz-2');
        expect(useCartStore.getState().items).toHaveLength(0);
    });

    it('should not clear cart if businessId is set to same value', () => {
        useCartStore.getState().setBusinessId('biz-1');
        useCartStore.getState().addItem(mockItem);

        useCartStore.getState().setBusinessId('biz-1');

        expect(useCartStore.getState().items).toHaveLength(1);
    });
});
