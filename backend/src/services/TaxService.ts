export class TaxService {
  async calculateTax(orderTotal: number): Promise<number> {
    return orderTotal * 0.18; // 18% dummy tax rate
  }
}
