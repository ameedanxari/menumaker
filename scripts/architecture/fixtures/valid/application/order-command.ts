import { canCapturePayment } from '../domain/order-policy';

export function authorizeOrderPayment(status: string): boolean {
  return canCapturePayment(status);
}
