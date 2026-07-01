export class TaxService {
  static calculateExclusiveTax(amountCents: number, taxRatePercent: number): number {
    TaxService.assertValidTaxInput(amountCents, taxRatePercent);
    const scaledTax = TaxService.assertSafeTaxProduct(
      'exclusive tax scaled amount',
      amountCents,
      taxRatePercent
    );
    const taxAmount = Math.round(scaledTax / 100);
    TaxService.assertSafeTaxOutput('exclusive tax amount', taxAmount);
    return taxAmount;
  }

  static splitInclusiveTax(totalWithTaxCents: number, taxRatePercent: number): {
    taxable_amount_cents: number;
    tax_amount_cents: number;
    total_cents: number;
  } {
    TaxService.assertValidTaxInput(totalWithTaxCents, taxRatePercent);

    if (taxRatePercent === 0) {
      TaxService.assertSafeTaxOutput('inclusive taxable amount', totalWithTaxCents);
      return {
        taxable_amount_cents: totalWithTaxCents,
        tax_amount_cents: 0,
        total_cents: totalWithTaxCents,
      };
    }

    const scaledTaxableTotal = TaxService.assertSafeTaxProduct(
      'inclusive tax scaled total',
      totalWithTaxCents,
      100
    );
    const taxableAmount = Math.round(scaledTaxableTotal / (100 + taxRatePercent));
    TaxService.assertSafeTaxOutput('inclusive taxable amount', taxableAmount);
    const taxAmount = totalWithTaxCents - taxableAmount;
    TaxService.assertSafeTaxOutput('inclusive tax amount', taxAmount);
    return {
      taxable_amount_cents: taxableAmount,
      tax_amount_cents: taxAmount,
      total_cents: totalWithTaxCents,
    };
  }

  async calculateTax(amountCents: number, taxRatePercent: number): Promise<number> {
    return TaxService.calculateExclusiveTax(amountCents, taxRatePercent);
  }

  private static assertValidTaxInput(amountCents: number, taxRatePercent: number): void {
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      throw new Error('amountCents must be a non-negative finite number');
    }
    if (!Number.isInteger(amountCents)) {
      throw new Error('amountCents must be an integer number of cents');
    }
    if (!Number.isSafeInteger(amountCents)) {
      throw new Error('amountCents must be a safe integer number of cents');
    }
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100) {
      throw new Error('taxRatePercent must be between 0 and 100');
    }
  }

  private static assertSafeTaxProduct(label: string, amountCents: number, multiplier: number): number {
    const product = amountCents * multiplier;
    if (!Number.isFinite(product) || !Number.isSafeInteger(product)) {
      throw new Error(`${label} must be a safe integer number of cents before rounding`);
    }
    return product;
  }

  private static assertSafeTaxOutput(label: string, value: number): void {
    if (!Number.isFinite(value) || !Number.isInteger(value) || !Number.isSafeInteger(value)) {
      throw new Error(`${label} must be a safe integer number of cents`);
    }
  }
}
