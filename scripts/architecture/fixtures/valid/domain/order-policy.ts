export type OrderId = string;

export function canCapturePayment(status: string): boolean {
  return status === 'pending_payment';
}
