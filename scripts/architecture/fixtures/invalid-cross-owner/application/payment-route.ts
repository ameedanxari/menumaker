import { OrderEntity } from '../../ordering/models/order-entity';

export function mutateForeignOrder(order: OrderEntity): OrderEntity {
  return { ...order, status: 'paid' };
}
