import { describe, expect, it, jest } from '@jest/globals';
import { TaxReportService } from '../src/services/TaxReportService';
import { TaxService } from '../src/services/TaxService';

describe('Tax calculation helpers', () => {
  it('requires explicit tax rates instead of a dummy default', async () => {
    await expect(new TaxService().calculateTax(10_000, 18)).resolves.toBe(1_800);
    expect(TaxService.calculateExclusiveTax(12_345, 5)).toBe(617);
    expect(() => TaxService.calculateExclusiveTax(10_000, -1)).toThrow(/taxRatePercent/);
    expect(() => TaxService.calculateExclusiveTax(-1, 18)).toThrow(/amountCents/);
    expect(() => TaxService.calculateExclusiveTax(1.5, 18)).toThrow(/integer number of cents/);
    expect(() =>
      TaxService.calculateExclusiveTax(Number.MAX_SAFE_INTEGER + 1, 18)
    ).toThrow(/safe integer number of cents/);
    expect(() =>
      TaxService.calculateExclusiveTax(Number.MAX_SAFE_INTEGER, 18)
    ).toThrow(/exclusive tax scaled amount must be a safe integer number of cents before rounding/);
  });

  it('splits inclusive tax totals without losing cents', () => {
    expect(TaxService.splitInclusiveTax(10_500, 5)).toEqual({
      taxable_amount_cents: 10_000,
      tax_amount_cents: 500,
      total_cents: 10_500,
    });

    expect(TaxService.splitInclusiveTax(118, 18)).toEqual({
      taxable_amount_cents: 100,
      tax_amount_cents: 18,
      total_cents: 118,
    });

    expect(() =>
      TaxService.splitInclusiveTax(Number.MAX_SAFE_INTEGER, 18)
    ).toThrow(/inclusive tax scaled total must be a safe integer number of cents before rounding/);
  });

  it('calculates GST line items, rate buckets, and delivery charges from recorded order values', () => {
    const order: any = {
      delivery_fee_cents: 1050,
      items: [
        {
          dish_name: 'Thali',
          price_cents: 10_500,
          quantity: 2,
          dish: { metadata: { gst_rate: 5 } },
        },
        {
          dish_name: 'Catering Tray',
          price_cents: 11_800,
          quantity: 1,
          dish: { metadata: { gst_rate: 18 } },
        },
      ],
    };

    const breakdown = TaxReportService.calculateGstBreakdown(order);

    expect(breakdown.lineItems).toEqual([
      expect.objectContaining({
        description: 'Thali',
        quantity: 2,
        unit_price_cents: 10_000,
        gst_rate: 5,
        gst_amount_cents: 1_000,
        total_cents: 21_000,
      }),
      expect.objectContaining({
        description: 'Catering Tray',
        quantity: 1,
        unit_price_cents: 10_000,
        gst_rate: 18,
        gst_amount_cents: 1_800,
        total_cents: 11_800,
      }),
      expect.objectContaining({
        description: 'Delivery Charges',
        unit_price_cents: 1_000,
        gst_rate: 5,
        gst_amount_cents: 50,
        total_cents: 1_050,
      }),
    ]);
    expect(breakdown.gstBreakdown).toEqual([
      {
        rate: 5,
        taxable_amount_cents: 21_000,
        gst_amount_cents: 1_050,
        hsn_sac_code: '9963',
      },
      {
        rate: 18,
        taxable_amount_cents: 10_000,
        gst_amount_cents: 1_800,
        hsn_sac_code: '9963',
      },
    ]);
    expect(breakdown.subtotal).toBe(31_000);
    expect(breakdown.totalGst).toBe(2_850);
    expect(breakdown.grandTotal).toBe(33_850);
  });

  it('rejects invalid order values before producing GST compliance totals', () => {
    expect(() =>
      TaxReportService.calculateGstBreakdown(null as any)
    ).toThrow('tax invoice order must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown([] as any)
    ).toThrow('tax invoice order must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: { dish_name: 'Thali', price_cents: 500, quantity: 1 },
      } as any)
    ).toThrow('tax invoice order items must be an array');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [null],
      } as any)
    ).toThrow('order item 1 must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [[]],
      } as any)
    ).toThrow('order item 1 must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: -1,
        items: [],
      } as any)
    ).toThrow(/delivery_fee_cents/);

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Fractional Soup',
            price_cents: 500,
            quantity: 1.5,
          },
        ],
      } as any)
    ).toThrow(/quantity for Fractional Soup/);

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Half Cent Naan',
            price_cents: 99.5,
            quantity: 1,
          },
        ],
      } as any)
    ).toThrow(/Half Cent Naan/);

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Unsafe Precision Thali',
            price_cents: Number.MAX_SAFE_INTEGER + 1,
            quantity: 1,
          },
        ],
      } as any)
    ).toThrow(/Unsafe Precision Thali must be a safe integer number of cents/);

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Overflow Catering Tray',
            price_cents: Number.MAX_SAFE_INTEGER,
            quantity: 2,
            dish: { metadata: { gst_rate: 0 } },
          },
        ],
      } as any)
    ).toThrow(/Overflow Catering Tray taxable total must be a safe integer number of cents/);
  });

  it('preserves explicit zero-rated GST items and rejects invalid item GST rates', () => {
    const zeroRated = TaxReportService.calculateGstBreakdown({
      delivery_fee_cents: 0,
      items: [
        {
          dish_name: 'Exempt Water',
          price_cents: 1_000,
          quantity: 2,
          dish: { metadata: { gst_rate: 0 } },
        },
      ],
    } as any);

    expect(zeroRated.lineItems).toEqual([
      expect.objectContaining({
        description: 'Exempt Water',
        unit_price_cents: 1_000,
        gst_rate: 0,
        gst_amount_cents: 0,
        total_cents: 2_000,
      }),
    ]);
    expect(zeroRated.gstBreakdown).toEqual([
      {
        rate: 0,
        taxable_amount_cents: 2_000,
        gst_amount_cents: 0,
        hsn_sac_code: '9963',
      },
    ]);

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Bad Rate',
            price_cents: 1_000,
            quantity: 1,
            dish: { metadata: { gst_rate: 101 } },
          },
        ],
      } as any)
    ).toThrow('Bad Rate GST rate must be between 0 and 100');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'String Rate',
            price_cents: 1_000,
            quantity: 1,
            dish: { metadata: { gst_rate: '5' } },
          },
        ],
      } as any)
    ).toThrow('String Rate GST rate must be between 0 and 100');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'String Metadata',
            price_cents: 1_000,
            quantity: 1,
            dish: { metadata: 'gst:5' },
          },
        ],
      } as any)
    ).toThrow('String Metadata dish metadata must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Array Metadata',
            price_cents: 1_000,
            quantity: 1,
            dish: { metadata: [] },
          },
        ],
      } as any)
    ).toThrow('Array Metadata dish metadata must be an object');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Provider Metadata',
            price_cents: 1_000,
            quantity: 1,
            dish: {
              metadata: {
                gst_rate: 5,
                provider_trace_id: 'trace-123',
              },
            },
          },
        ],
      } as any)
    ).toThrow('Provider Metadata dish metadata include unsupported field(s): provider_trace_id');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Provider Metadata',
            price_cents: 1_000,
            quantity: 1,
            dish: {
              metadata: {
                gst_rate: 5,
                'provider_trace_id\uFEFF': 'trace-123',
              },
            },
          },
        ],
      } as any)
    ).toThrow('Provider Metadata dish metadata field names must not include unsafe control characters');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Corrupt Dish Relation',
            price_cents: 1_000,
            quantity: 1,
            dish: 'not-a-dish',
          },
        ],
      } as any)
    ).toThrow('Corrupt Dish Relation dish relation must be an object');
  });

  it('normalizes invoice line item descriptions from recorded order item metadata', () => {
    const breakdown = TaxReportService.calculateGstBreakdown({
      delivery_fee_cents: 0,
      items: [
        {
          dish_name: '  Masala Dosa  ',
          price_cents: 1_050,
          quantity: 1,
          dish: { name: 'Provider Dish Name', metadata: { gst_rate: 5 } },
        },
        {
          dish_name: '   ',
          price_cents: 2_100,
          quantity: 1,
          dish: { name: '  Paneer Tikka  ', metadata: { gst_rate: 5 } },
        },
      ],
    } as any);

    expect(breakdown.lineItems.map((item) => item.description)).toEqual([
      'Masala Dosa',
      'Paneer Tikka',
    ]);
  });

  it('rejects malformed invoice line item descriptions before returning invoice JSON', () => {
    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: { text: 'Thali' },
            price_cents: 1_050,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      } as any)
    ).toThrow('order item 1 dish_name must be a string');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: 'Thali\u0007Special',
            price_cents: 1_050,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      } as any)
    ).toThrow('order item 1 dish_name must not include unsafe control characters');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            dish_name: '   ',
            price_cents: 1_050,
            quantity: 1,
            dish: { name: ['Thali'], metadata: { gst_rate: 5 } },
          },
        ],
      } as any)
    ).toThrow('order item 1 dish.name must be a string');

    expect(() =>
      TaxReportService.calculateGstBreakdown({
        delivery_fee_cents: 0,
        items: [
          {
            price_cents: 1_050,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      } as any)
    ).toThrow('order item 1 must include a non-empty dish_name or dish.name before tax invoice generation');
  });
});

describe('TaxReportService disabled capability boundary', () => {
  function createRepository(rows: any[] = []) {
    return {
      create: jest.fn((input) => input),
      find: jest.fn(async () => rows),
      findOne: jest.fn(async () => null),
      save: jest.fn(async (entity) => entity),
    };
  }

  function validInvoiceRow(overrides: Record<string, unknown> = {}) {
    const base = {
      id: 'invoice-1',
      order_id: 'order-1',
      business_id: 'business-1',
      invoice_number: 'INV-2026-0001',
      invoice_date: new Date('2026-06-10T12:00:00.000Z'),
      financial_year: '2026-2027',
      customer_name: 'Customer One',
      customer_phone: '+15551234567',
      customer_address: '123 Main St',
      seller_gstin: '22AAAAA0000A1Z5',
      seller_business_name: 'Cafe Blue LLC',
      seller_address: '456 Market St',
      subtotal_cents: 10_000,
      gst_breakdown: [
        { rate: 5, taxable_amount_cents: 10_000, gst_amount_cents: 500, hsn_sac_code: '9963' },
      ],
      total_gst_cents: 500,
      total_cents: 10_500,
      currency: 'INR',
      line_items: [
        {
          description: 'Thali',
          hsn_sac_code: '9963',
          quantity: 1,
          unit_price_cents: 10_000,
          gst_rate: 5,
          gst_amount_cents: 500,
          total_cents: 10_500,
        },
      ],
      payment_method: 'cash',
      payment_reference: 'cash-receipt-1',
      pdf_url: undefined,
      pdf_status: 'pending',
      pdf_error: undefined,
      metadata: {},
      created_at: new Date('2026-06-10T12:00:00.000Z'),
    };

    const row = {
      ...base,
      gst_breakdown: base.gst_breakdown.map((entry) => ({ ...entry })),
      line_items: base.line_items.map((entry) => ({ ...entry })),
      ...overrides,
    };

    if (
      Object.prototype.hasOwnProperty.call(overrides, 'invoice_date') &&
      !Object.prototype.hasOwnProperty.call(overrides, 'created_at')
    ) {
      row.created_at = row.invoice_date;
    }

    return row;
  }

  function validPayoutRow(overrides: Record<string, unknown> = {}) {
    const row: Record<string, unknown> = {
      id: 'payout-1',
      business_id: 'business-1',
      status: 'completed',
      gross_amount_cents: 10_000,
      processor_fee_cents: 100,
      subscription_fee_cents: 500,
      platform_fee_cents: 200,
      volume_discount_cents: 100,
      net_amount_cents: 9_100,
      payment_count: 1,
      metadata: { payment_ids: ['payment-1'] },
      period_start: new Date('2026-06-01T00:00:00.000Z'),
      period_end: new Date('2026-06-25T12:00:00.000Z'),
      created_at: new Date('2026-06-25T12:00:00.000Z'),
      completed_at: new Date('2026-06-25T12:05:00.000Z'),
      ...overrides,
    };

    if (!Object.prototype.hasOwnProperty.call(overrides, 'net_amount_cents')) {
      row.net_amount_cents =
        (row.gross_amount_cents as number) -
        (row.processor_fee_cents as number) -
        (row.subscription_fee_cents as number) -
        (row.platform_fee_cents as number) +
        (row.volume_discount_cents as number);
    }

    return row;
  }

  it('fails report and invoice operations before repository side effects while tax reporting is disabled', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = createRepository();
    const paymentRepository = createRepository();
    const payoutRepository = createRepository();
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: settingsRepository as any,
    });
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');

    await expect(service.generateTaxInvoice('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'tax_reporting',
    });
    await expect(service.generateGstReport('business-1', start, end)).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'tax_reporting',
    });
    await expect(service.generateProfitAnalysis('business-1', start, end)).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'tax_reporting',
    });
    await expect(service.getInvoice('invoice-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'tax_reporting',
    });
    await expect(service.getInvoiceByOrderId('order-1')).rejects.toMatchObject({
      code: 'FEATURE_UNAVAILABLE',
      capability: 'tax_reporting',
    });

    expect(invoiceRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.find).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(paymentRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
  });

  it('rejects blank tax report identifiers before repository reads or writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = createRepository();
    const paymentRepository = createRepository();
    const payoutRepository = createRepository();
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');

    await expect(service.generateTaxInvoice('   '))
      .rejects.toThrow('orderId must be a non-empty string');
    await expect(service.generateTaxInvoice('order-\u00001'))
      .rejects.toThrow('orderId must not include unsafe control characters');
    await expect(service.generateTaxInvoice('\uFEFForder-1'))
      .rejects.toThrow('orderId must not include unsafe control characters');
    await expect(service.generateGstReport('   ', start, end))
      .rejects.toThrow('businessId must be a non-empty string');
    await expect(service.generateGstReport('business-\u007F1', start, end))
      .rejects.toThrow('businessId must not include unsafe control characters');
    await expect(service.generateGstReport('business-1\uFEFF', start, end))
      .rejects.toThrow('businessId must not include unsafe control characters');
    await expect(service.generateProfitAnalysis('   ', start, end))
      .rejects.toThrow('businessId must be a non-empty string');
    await expect(service.getInvoice('   '))
      .rejects.toThrow('invoiceId must be a non-empty string');
    await expect(service.getInvoice('invoice-\u00071'))
      .rejects.toThrow('invoiceId must not include unsafe control characters');
    await expect(service.getInvoice('\uFEFFinvoice-1'))
      .rejects.toThrow('invoiceId must not include unsafe control characters');
    await expect(service.getInvoiceByOrderId('   '))
      .rejects.toThrow('orderId must be a non-empty string');

    expect(invoiceRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.find).not.toHaveBeenCalled();
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(paymentRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes tax invoice identifiers before lookup and invoice persistence', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '  123 Main St  ',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice(' order-1 ');
    await service.getInvoice(' invoice-1 ');
    await service.getInvoiceByOrderId(' order-1 ');

    expect(invoiceRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { order_id: 'order-1' },
      relations: ['order', 'business'],
    });
    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      relations: ['business', 'items', 'items.dish'],
    });
    expect(invoiceRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      order_id: 'order-1',
      business_id: 'business-1',
      customer_address: '123 Main St',
    }));
    expect(invoiceRepository.create.mock.calls[0][0]).not.toHaveProperty('metadata');
    expect(invoiceRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { id: 'invoice-1' },
      relations: ['business', 'order'],
    });
    expect(invoiceRepository.findOne).toHaveBeenNthCalledWith(3, {
      where: { order_id: 'order-1' },
      relations: ['business', 'order'],
    });
  });

  it('omits blank tax invoice customer addresses before invoice persistence', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '   ',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice('order-1');

    expect(invoiceRepository.create).toHaveBeenCalledWith(expect.not.objectContaining({
      customer_address: expect.anything(),
    }));
    expect(invoiceRepository.create.mock.calls[0][0]).not.toHaveProperty('customer_address');
  });

  it('omits absent optional tax invoice seller fields before invoice persistence', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      is_gst_registered: false,
      gstin: '   ',
      business_address: '   ',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice('order-1');

    expect(invoiceRepository.create.mock.calls[0][0]).not.toHaveProperty('seller_gstin');
    expect(invoiceRepository.create.mock.calls[0][0]).not.toHaveProperty('seller_address');
    expect(invoiceRepository.save.mock.calls[0][0]).not.toHaveProperty('seller_gstin');
    expect(invoiceRepository.save.mock.calls[0][0]).not.toHaveProperty('seller_address');
  });

  it('omits absent optional tax invoice metadata before invoice persistence', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice('order-1');

    expect(invoiceRepository.create.mock.calls[0][0]).not.toHaveProperty('metadata');
    expect(invoiceRepository.save.mock.calls[0][0]).not.toHaveProperty('metadata');
  });

  it('preserves present optional tax invoice metadata before invoice persistence', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      invoice_terms: '  Payment due on receipt.  ',
      bank_details: {
        account_name: 'Cafe Blue LLC',
        account_number: '1234567890',
      },
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice('order-1');

    expect(invoiceRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        terms_and_conditions: 'Payment due on receipt.',
        bank_details: {
          account_name: 'Cafe Blue LLC',
          account_number: '1234567890',
        },
      },
    }));
    expect(invoiceRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      metadata: {
        terms_and_conditions: 'Payment due on receipt.',
        bank_details: {
          account_name: 'Cafe Blue LLC',
          account_number: '1234567890',
        },
      },
    }));
  });

  it('rejects unsafe tax invoice metadata controls before invoice persistence', async () => {
    const scenarios = [
      {
        settingsOverrides: { invoice_terms: 'Payment due\u0007on receipt.' },
        expectedError: 'tax invoice settings invoice_terms must not include unsafe control characters',
      },
      {
        settingsOverrides: { invoice_terms: 'Payment due\u202Eon receipt.' },
        expectedError: 'tax invoice settings invoice_terms must not include unsafe control characters',
      },
      {
        settingsOverrides: { invoice_terms: '\uFEFFPayment due on receipt.' },
        expectedError: 'tax invoice settings invoice_terms must not include unsafe control characters',
      },
      {
        settingsOverrides: {
          bank_details: {
            account_name: 'Cafe Blue\u0000LLC',
            account_number: '1234567890',
          },
        },
        expectedError:
          'tax invoice settings bank_details.account_name must not include unsafe control characters',
      },
      {
        settingsOverrides: {
          bank_details: {
            account_name: 'Cafe Blue\u200BLLC',
            account_number: '1234567890',
          },
        },
        expectedError:
          'tax invoice settings bank_details.account_name must not include unsafe control characters',
      },
      {
        settingsOverrides: {
          bank_details: {
            account_name: 'Cafe Blue LLC\uFEFF',
            account_number: '1234567890',
          },
        },
        expectedError:
          'tax invoice settings bank_details.account_name must not include unsafe control characters',
      },
    ];

    for (const { settingsOverrides, expectedError } of scenarios) {
      const invoiceRepository = createRepository();
      const orderRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => ({
          id: 'order-1',
          business_id: 'business-1',
          customer_name: 'Customer One',
          customer_phone: '+15551234567',
          delivery_address: '123 Main St',
          payment_method: 'cash',
          delivery_fee_cents: 0,
          business: { id: 'business-1', name: 'Cafe Blue' },
          items: [
            {
              dish_name: 'Thali',
              price_cents: 10_500,
              quantity: 1,
              dish: { metadata: { gst_rate: 5 } },
            },
          ],
        })),
      };
      const settings = {
        business_id: 'business-1',
        invoice_prefix: 'INV',
        next_invoice_number: 7,
        legal_business_name: 'Cafe Blue LLC',
        ...settingsOverrides,
      };
      const settingsRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => settings),
      };
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: orderRepository as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: settingsRepository as any,
      }, { enforceCapability: false });

      await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(expectedError);

      expect(invoiceRepository.create).not.toHaveBeenCalled();
      expect(invoiceRepository.save).not.toHaveBeenCalled();
      expect(settingsRepository.save).not.toHaveBeenCalled();
    }
  });

  it('rejects cross-order invoice source rows before settings or invoice writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-elsewhere',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice order id must match requested order'
    );

    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      relations: ['business', 'items', 'items.dish'],
    });
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects cross-business invoice source relations before settings or invoice writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-elsewhere', name: 'Cafe Elsewhere' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice order business relation id must match order business_id'
    );

    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      relations: ['business', 'items', 'items.dish'],
    });
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed invoice source customer/payment labels before settings or invoice writes', async () => {
    const scenarios = [
      {
        orderOverrides: { customer_name: '   ' },
        expectedError: 'tax invoice order customer_name must be a non-empty string',
      },
      {
        orderOverrides: { customer_name: 'Customer\u0000One' },
        expectedError: 'tax invoice order customer_name must not include unsafe control characters',
      },
      {
        orderOverrides: { customer_name: 'Customer\u202EOne' },
        expectedError: 'tax invoice order customer_name must not include unsafe control characters',
      },
      {
        orderOverrides: { customer_name: '\uFEFFCustomer One' },
        expectedError: 'tax invoice order customer_name must not include unsafe control characters',
      },
      {
        orderOverrides: { customer_phone: ['+15551234567'] },
        expectedError: 'tax invoice order customer_phone must be a string',
      },
      {
        orderOverrides: { customer_phone: '+15551234567\u007F' },
        expectedError: 'tax invoice order customer_phone must not include unsafe control characters',
      },
      {
        orderOverrides: { payment_method: { type: 'cash' } },
        expectedError: 'tax invoice order payment_method must be a string',
      },
      {
        orderOverrides: { payment_method: 'cash\u0007' },
        expectedError: 'tax invoice order payment_method must not include unsafe control characters',
      },
      {
        orderOverrides: { payment_method: 'cash\u200B' },
        expectedError: 'tax invoice order payment_method must not include unsafe control characters',
      },
      {
        orderOverrides: { payment_method: 'cash\uFEFF' },
        expectedError: 'tax invoice order payment_method must not include unsafe control characters',
      },
    ];

    for (const { orderOverrides, expectedError } of scenarios) {
      const invoiceRepository = createRepository();
      const settingsRepository = createRepository();
      const orderRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => ({
          id: 'order-1',
          business_id: 'business-1',
          customer_name: 'Customer One',
          customer_phone: '+15551234567',
          delivery_address: '123 Main St',
          payment_method: 'cash',
          delivery_fee_cents: 0,
          business: { id: 'business-1', name: 'Cafe Blue' },
          items: [
            {
              dish_name: 'Thali',
              price_cents: 10_500,
              quantity: 1,
              dish: { metadata: { gst_rate: 5 } },
            },
          ],
          ...orderOverrides,
        })),
      };
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: orderRepository as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: settingsRepository as any,
      }, { enforceCapability: false });

      await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(expectedError);

      expect(settingsRepository.findOne).not.toHaveBeenCalled();
      expect(invoiceRepository.create).not.toHaveBeenCalled();
      expect(invoiceRepository.save).not.toHaveBeenCalled();
      expect(settingsRepository.save).not.toHaveBeenCalled();
    }
  });

  it('validates existing tax invoice rows before reusing generateTaxInvoice results', async () => {
    const invoiceRow = validInvoiceRow({
      order: { id: 'order-1', business_id: 'business-1' },
      business: { id: 'business-1' },
    });
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => invoiceRow),
    };
    const orderRepository = createRepository();
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice(' order-1 ')).resolves.toBe(invoiceRow);

    expect(invoiceRepository.findOne).toHaveBeenCalledWith({
      where: { order_id: 'order-1' },
      relations: ['order', 'business'],
    });
    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed existing tax invoice envelopes before reusing generateTaxInvoice results', async () => {
    const malformedInvoice = [] as any;
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => malformedInvoice),
    };
    const orderRepository = createRepository();
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice must be an object'
    );

    expect(orderRepository.findOne).not.toHaveBeenCalled();
    expect(settingsRepository.findOne).not.toHaveBeenCalled();
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt existing tax invoice rows before reusing generateTaxInvoice results', async () => {
    const cases: Array<{
      row: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        row: validInvoiceRow({ id: 'invoice-existing-other-order', order_id: 'order-other' }),
        expectedError: 'tax invoice invoice-existing-other-order order_id must match requested order',
      },
      {
        row: validInvoiceRow({ id: 'invoice-existing-missing-order-relation' }),
        expectedError: 'tax invoice invoice-existing-missing-order-relation order relation is required before invoice reuse',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-missing-business-relation',
          order: { id: 'order-1', business_id: 'business-1' },
        }),
        expectedError: 'tax invoice invoice-existing-missing-business-relation business relation is required before invoice reuse',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-cross-business-order-relation',
          business_id: 'business-2',
          order: { id: 'order-1', business_id: 'business-1' },
          business: { id: 'business-2' },
        }),
        expectedError:
          'tax invoice invoice-existing-cross-business-order-relation order relation business_id must match invoice business_id',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-cross-business-relation',
          order: { id: 'order-1', business_id: 'business-1' },
          business: { id: 'business-elsewhere' },
        }),
        expectedError:
          'tax invoice invoice-existing-cross-business-relation business relation id must match invoice business_id',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-bad-financial-year-format',
          financial_year: 'FY2026',
        }),
        expectedError:
          'tax invoice invoice-existing-bad-financial-year-format financial_year must use YYYY-YY or YYYY-YYYY format',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-stale-financial-year',
          invoice_date: new Date('2026-06-10T12:00:00.000Z'),
          financial_year: '2025-2026',
        }),
        expectedError:
          'tax invoice invoice-existing-stale-financial-year financial_year must match invoice_date',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-stale-updated-at',
          invoice_date: new Date('2026-06-10T12:00:00.000Z'),
          created_at: new Date('2026-06-10T12:05:00.000Z'),
          updated_at: new Date('2026-06-10T12:04:59.000Z'),
        }),
        expectedError:
          'tax invoice invoice-existing-stale-updated-at updated_at cannot be before created_at',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-bad-seller-gstin',
          seller_gstin: 'bad-gstin',
        }),
        expectedError:
          'tax invoice invoice-existing-bad-seller-gstin seller_gstin must be a valid 15-character GSTIN',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-bad-lines',
          line_items: [
            {
              description: 'Thali',
              hsn_sac_code: '9963',
              quantity: 1,
              unit_price_cents: 10_000,
              gst_rate: 5,
              gst_amount_cents: 500,
              total_cents: 10_400,
            },
          ],
        }),
        expectedError:
          'tax invoice invoice-existing-bad-lines line_items[0] total_cents must equal unit_price_cents times quantity plus gst_amount_cents',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-pending-with-stale-url',
          pdf_status: 'pending',
          pdf_url: 'https://cdn.example.com/invoices/stale.pdf',
        }),
        expectedError:
          'tax invoice invoice-existing-pending-with-stale-url pdf_url must be empty when pdf_status is pending',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-pending-with-stale-error',
          pdf_status: 'pending',
          pdf_error: 'previous renderer timeout',
        }),
        expectedError:
          'tax invoice invoice-existing-pending-with-stale-error pdf_error must be empty when pdf_status is pending',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-generated-with-stale-error',
          pdf_status: 'generated',
          pdf_url: 'https://cdn.example.com/invoices/invoice-existing-generated-with-stale-error.pdf',
          pdf_error: 'previous renderer timeout',
        }),
        expectedError:
          'tax invoice invoice-existing-generated-with-stale-error pdf_error must be empty when pdf_status is generated',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-existing-failed-with-stale-url',
          pdf_status: 'failed',
          pdf_url: 'https://cdn.example.com/invoices/stale.pdf',
          pdf_error: 'renderer timeout',
        }),
        expectedError:
          'tax invoice invoice-existing-failed-with-stale-url pdf_url must be empty when pdf_status is failed',
      },
    ];

    for (const { row, expectedError } of cases) {
      const invoiceRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => row),
      };
      const orderRepository = createRepository();
      const settingsRepository = createRepository();
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: orderRepository as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: settingsRepository as any,
      }, { enforceCapability: false });

      await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(expectedError);
      expect(orderRepository.findOne).not.toHaveBeenCalled();
      expect(settingsRepository.findOne).not.toHaveBeenCalled();
      expect(invoiceRepository.create).not.toHaveBeenCalled();
      expect(invoiceRepository.save).not.toHaveBeenCalled();
    }
  });

  it('validates persisted tax invoice rows before returning read-side invoice JSON', async () => {
    const invoiceRow = validInvoiceRow();
    const orderLookupRow = validInvoiceRow({ id: 'invoice-for-order-1' });
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async (query: { where: { id?: string; order_id?: string } }) => (
        query.where.id ? invoiceRow : orderLookupRow
      )),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getInvoice('invoice-1')).resolves.toBe(invoiceRow);
    await expect(service.getInvoiceByOrderId('order-1')).resolves.toBe(orderLookupRow);
  });

  it('rejects malformed tax invoice lookup envelopes before returning invoice JSON', async () => {
    const malformedInvoice = [] as any;
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => malformedInvoice),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(service.getInvoice('invoice-1')).rejects.toThrow(
      'tax invoice must be an object'
    );
    await expect(service.getInvoiceByOrderId('order-1')).rejects.toThrow(
      'tax invoice must be an object'
    );
  });

  it('rejects corrupt tax invoice lookup rows before returning invoice JSON', async () => {
    const cases: Array<{
      row: Record<string, unknown>;
      call: 'invoice' | 'order';
      expectedError: string;
    }> = [
      {
        row: validInvoiceRow({ id: 'invoice-other' }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-other id must match requested invoice',
      },
      {
        row: validInvoiceRow({ order_id: 'order-other' }),
        call: 'order',
        expectedError: 'tax invoice invoice-1 order_id must match requested order',
      },
      {
        row: validInvoiceRow({ total_cents: 10_400 }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 total_cents must equal subtotal_cents plus total_gst_cents',
      },
      {
        row: validInvoiceRow({
          invoice_date: new Date('2026-06-10T12:00:00.000Z'),
          created_at: new Date('2026-06-10T11:59:59.000Z'),
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 created_at cannot be before invoice_date',
      },
      {
        row: validInvoiceRow({
          invoice_date: new Date('2026-06-10T12:00:00.000Z'),
          updated_at: new Date('2026-06-10T11:59:59.000Z'),
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 updated_at cannot be before invoice_date',
      },
      {
        row: validInvoiceRow({ pdf_status: 'uploaded' }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_status must be pending, generated, or failed',
      },
      {
        row: validInvoiceRow({
          payment_reference: `payment-${'x'.repeat(256)}`,
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 payment_reference must be at most 255 characters',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'pending',
          pdf_url: 'https://cdn.example.com/invoices/stale.pdf',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url must be empty when pdf_status is pending',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'pending',
          pdf_error: 'previous renderer timeout',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_error must be empty when pdf_status is pending',
      },
      {
        row: validInvoiceRow({ pdf_status: 'generated', pdf_url: undefined }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url is required when pdf_status is generated',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'generated',
          pdf_url: `https://cdn.example.com/invoices/${'x'.repeat(2048)}.pdf`,
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url must be at most 2048 characters',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'generated',
          pdf_url: 'https://cdn.example.com/invoices/invoice-1.pdf',
          pdf_error: 'previous renderer timeout',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_error must be empty when pdf_status is generated',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'generated',
          pdf_url: 'http://cdn.example.com/invoices/invoice-1.pdf',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url must be an absolute HTTPS URL',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'generated',
          pdf_url: '/invoices/invoice-1.pdf',
        }),
        call: 'order',
        expectedError: 'tax invoice invoice-1 pdf_url must be an absolute HTTPS URL',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'generated',
          pdf_url: 'https://user:secret@cdn.example.com/invoices/invoice-1.pdf',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url must not include embedded credentials',
      },
      {
        row: validInvoiceRow({ pdf_status: 'failed', pdf_error: undefined }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_error is required when pdf_status is failed',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'failed',
          pdf_error: `renderer-${'x'.repeat(1001)}`,
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_error must be at most 1000 characters',
      },
      {
        row: validInvoiceRow({
          pdf_status: 'failed',
          pdf_url: 'https://cdn.example.com/invoices/stale.pdf',
          pdf_error: 'renderer timeout',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 pdf_url must be empty when pdf_status is failed',
      },
      {
        row: validInvoiceRow({
          provider_trace_id: 'trace-123',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 include unsupported field(s): provider_trace_id',
      },
      {
        row: validInvoiceRow({
          ['provider_trace_id\uFEFF']: 'trace-123',
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 field names must not include unsafe control characters',
      },
      {
        row: validInvoiceRow({
          metadata: {
            bank_details: {},
          },
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 metadata.bank_details must include at least one populated detail',
      },
      {
        row: validInvoiceRow({
          order: { id: 'order-elsewhere', business_id: 'business-1' },
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 order relation id must match invoice order_id',
      },
      {
        row: validInvoiceRow({
          order: { id: 'order-1', business_id: 'business-elsewhere' },
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 order relation business_id must match invoice business_id',
      },
      {
        row: validInvoiceRow({
          business: { id: 'business-elsewhere' },
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 business relation id must match invoice business_id',
      },
      {
        row: validInvoiceRow({
          line_items: [
            {
              description: 'Thali',
              hsn_sac_code: '9963',
              quantity: 1,
              unit_price_cents: 10_000,
              gst_rate: 5,
              gst_amount_cents: 500,
              total_cents: 10_400,
            },
          ],
        }),
        call: 'invoice',
        expectedError:
          'tax invoice invoice-1 line_items[0] total_cents must equal unit_price_cents times quantity plus gst_amount_cents',
      },
      {
        row: validInvoiceRow({
          subtotal_cents: 0,
          total_gst_cents: 0,
          total_cents: 0,
          gst_breakdown: [],
          line_items: [],
        }),
        call: 'invoice',
        expectedError: 'tax invoice invoice-1 line_items must include at least one item',
      },
    ];

    for (const { row, call, expectedError } of cases) {
      const invoiceRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => row),
      };
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      const operation = call === 'invoice'
        ? service.getInvoice('invoice-1')
        : service.getInvoiceByOrderId('order-1');
      await expect(operation).rejects.toThrow(expectedError);
    }
  });

  it('rejects oversized tax invoice artifact evidence before returning statutory summaries', async () => {
    const scenarios: Array<{
      row: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        row: validInvoiceRow({
          id: 'invoice-oversized-reference',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          payment_reference: `payment-${'x'.repeat(256)}`,
        }),
        expectedError:
          'tax invoice invoice-oversized-reference payment_reference must be at most 255 characters',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-oversized-pdf-url',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          pdf_status: 'generated',
          pdf_url: `https://cdn.example.com/invoices/${'x'.repeat(2048)}.pdf`,
        }),
        expectedError:
          'tax invoice invoice-oversized-pdf-url pdf_url must be at most 2048 characters',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-oversized-pdf-error',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          pdf_status: 'failed',
          pdf_error: `renderer-${'x'.repeat(1001)}`,
        }),
        expectedError:
          'tax invoice invoice-oversized-pdf-error pdf_error must be at most 1000 characters',
      },
    ];

    for (const { row, expectedError } of scenarios) {
      const service = new TaxReportService({
        invoiceRepository: createRepository([row]) as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateGstReport(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(expectedError);
    }
  });

  it('normalizes tax report business identifiers before GST and profit repository queries', async () => {
    const invoiceRepository = createRepository();
    const paymentRepository = createRepository();
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });
    const start = new Date('2026-06-01T00:00:00.000Z');
    const end = new Date('2026-06-30T23:59:59.999Z');

    await service.generateGstReport(' business-1 ', start, end);
    await service.generateProfitAnalysis(' business-1 ', start, end);

    expect(invoiceRepository.find).toHaveBeenCalledWith({
      where: {
        business_id: 'business-1',
        invoice_date: expect.any(Object),
      },
      order: {
        invoice_date: 'ASC',
      },
    });
    expect(paymentRepository.find).toHaveBeenCalledWith({
      where: {
        business_id: 'business-1',
        status: 'succeeded',
        created_at: expect.any(Object),
      },
    });
    expect(payoutRepository.find).toHaveBeenCalledWith({
      where: {
        business_id: 'business-1',
        status: 'completed',
        created_at: expect.any(Object),
      },
    });
  });

  it('rejects corrupt invoice numbering settings before invoice or sequence writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: Number.NaN,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'next_invoice_number must be a positive integer'
    );

    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
    expect(Number.isNaN(settings.next_invoice_number)).toBe(true);
  });

  it('rejects cross-business invoice settings before invoice or sequence writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-elsewhere',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Elsewhere LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice settings business_id must match order business'
    );

    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
    expect(settings.next_invoice_number).toBe(7);
  });

  it('rejects unsupported invoice settings row fields before invoice or sequence writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      provider_trace_id: 'trace-123',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice settings row include unsupported field(s): provider_trace_id'
    );

    settingsRepository.findOne.mockResolvedValueOnce({
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      ['provider_trace_id\uFEFF']: 'trace-123',
    });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice settings row field names must not include unsafe control characters'
    );

    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
    expect(settings.next_invoice_number).toBe(7);
  });

  it('rejects malformed invoice settings scalar fields before invoice or sequence writes', async () => {
    const malformedSettingsCases = [
      {
        settingsOverride: { is_gst_registered: 'yes' },
        expectedError: 'tax invoice settings is_gst_registered must be a boolean',
      },
      {
        settingsOverride: { created_at: '2026-06-01T00:00:00.000Z' },
        expectedError: 'tax invoice settings created_at must be a valid Date',
      },
      {
        settingsOverride: {
          created_at: new Date('2026-06-30T00:00:00.000Z'),
          updated_at: new Date('2026-06-29T23:59:59.000Z'),
        },
        expectedError: 'tax invoice settings updated_at cannot be before created_at',
      },
      {
        settingsOverride: { invoice_prefix: ['INV'] },
        expectedError: 'invoice_prefix must be a string',
      },
      {
        settingsOverride: { invoice_prefix: '\uFEFFINV' },
        expectedError: 'invoice_prefix must not include unsafe control characters',
      },
    ];

    for (const { settingsOverride, expectedError } of malformedSettingsCases) {
      const invoiceRepository = createRepository();
      const orderRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => ({
          id: 'order-1',
          business_id: 'business-1',
          customer_name: 'Customer One',
          customer_phone: '+15551234567',
          delivery_address: '123 Main St',
          payment_method: 'cash',
          delivery_fee_cents: 0,
          business: { id: 'business-1', name: 'Cafe Blue' },
          items: [
            {
              dish_name: 'Thali',
              price_cents: 10_500,
              quantity: 1,
              dish: { metadata: { gst_rate: 5 } },
            },
          ],
        })),
      };
      const settings = {
        business_id: 'business-1',
        invoice_prefix: 'INV',
        next_invoice_number: 7,
        legal_business_name: 'Cafe Blue LLC',
        ...settingsOverride,
      };
      const settingsRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => settings),
      };
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: orderRepository as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: settingsRepository as any,
      }, { enforceCapability: false });

      await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(expectedError);

      expect(invoiceRepository.create).not.toHaveBeenCalled();
      expect(invoiceRepository.save).not.toHaveBeenCalled();
      expect(settingsRepository.save).not.toHaveBeenCalled();
      expect(settings.next_invoice_number).toBe(7);
    }
  });

  it('rejects invoice sequence values that cannot be safely incremented before invoice writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: Number.MAX_SAFE_INTEGER,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'next_invoice_number must be a safe integer with room for sequence increment'
    );

    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
    expect(settings.next_invoice_number).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects GST-registered businesses without a valid GSTIN before invoice writes', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      is_gst_registered: true,
      gstin: '   ',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'GST-registered businesses must have a GSTIN before tax invoice generation'
    );

    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(invoiceRepository.save).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
    expect(settings.next_invoice_number).toBe(7);

    settings.gstin = 'bad-gstin';
    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'gstin must be a valid 15-character GSTIN'
    );
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();

    settings.gstin = '\uFEFF22AAAAA0000A1Z5';
    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'gstin must not include unsafe control characters'
    );
    expect(invoiceRepository.create).not.toHaveBeenCalled();
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects malformed invoice settings metadata before invoice or sequence writes', async () => {
    const malformedSettingsCases = [
      {
        settingsOverride: { legal_business_name: ['Cafe Blue LLC'] },
        expectedError: 'tax invoice settings legal_business_name must be a string',
      },
      {
        settingsOverride: { business_address: ['123 Main St'] },
        expectedError: 'tax invoice settings business_address must be a string',
      },
      {
        settingsOverride: { invoice_terms: ['Payment due on receipt'] },
        expectedError: 'tax invoice settings invoice_terms must be a string',
      },
      {
        settingsOverride: { bank_details: ['bank account'] },
        expectedError: 'tax invoice settings bank_details must be an object',
      },
      {
        settingsOverride: {
          bank_details: {
            account_name: 'Cafe Blue LLC',
            provider_trace_id: 'trace-123',
          },
        },
        expectedError:
          'tax invoice settings bank_details include unsupported field(s): provider_trace_id',
      },
      {
        settingsOverride: {
          bank_details: {
            account_name: 'Cafe Blue LLC',
            'provider_trace_id\uFEFF': 'trace-123',
          },
        },
        expectedError:
          'tax invoice settings bank_details field names must not include unsafe control characters',
      },
      {
        settingsOverride: {
          bank_details: {
            account_number: 1234567890,
          },
        },
        expectedError: 'tax invoice settings bank_details.account_number must be a string',
      },
    ];

    for (const { settingsOverride, expectedError } of malformedSettingsCases) {
      const invoiceRepository = createRepository();
      const orderRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => ({
          id: 'order-1',
          business_id: 'business-1',
          customer_name: 'Customer One',
          customer_phone: '+15551234567',
          delivery_address: '123 Main St',
          payment_method: 'cash',
          delivery_fee_cents: 0,
          business: { id: 'business-1', name: 'Cafe Blue' },
          items: [
            {
              dish_name: 'Thali',
              price_cents: 10_500,
              quantity: 1,
              dish: { metadata: { gst_rate: 5 } },
            },
          ],
        })),
      };
      const settings = {
        business_id: 'business-1',
        invoice_prefix: 'INV',
        next_invoice_number: 7,
        legal_business_name: 'Cafe Blue LLC',
        ...settingsOverride,
      };
      const settingsRepository = {
        ...createRepository(),
        findOne: jest.fn(async () => settings),
      };
      const service = new TaxReportService({
        invoiceRepository: invoiceRepository as any,
        orderRepository: orderRepository as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: settingsRepository as any,
      }, { enforceCapability: false });

      await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(expectedError);

      expect(invoiceRepository.create).not.toHaveBeenCalled();
      expect(invoiceRepository.save).not.toHaveBeenCalled();
      expect(settingsRepository.save).not.toHaveBeenCalled();
      expect(settings.next_invoice_number).toBe(7);
    }
  });

  it('recovers a concurrent tax invoice save when the requested order invoice now exists', async () => {
    const recoveredInvoice = validInvoiceRow({
      id: 'invoice-concurrent',
      order_id: 'order-1',
      business_id: 'business-1',
      order: { id: 'order-1', business_id: 'business-1' },
      business: { id: 'business-1' },
    });
    const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => {
        if (invoiceRepository.findOne.mock.calls.length === 1) return null;
        return recoveredInvoice;
      }),
      save: jest.fn(async () => {
        throw duplicateError;
      }),
    };
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).resolves.toBe(recoveredInvoice);

    expect(invoiceRepository.save).toHaveBeenCalledTimes(1);
    expect(invoiceRepository.findOne).toHaveBeenNthCalledWith(2, {
      where: { order_id: 'order-1' },
      relations: ['order', 'business'],
    });
    expect(settings.next_invoice_number).toBe(7);
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects corrupt concurrent tax invoice recovery rows before consuming invoice numbers', async () => {
    const recoveredInvoice = validInvoiceRow({
      id: 'invoice-concurrent-other-order',
      order_id: 'order-other',
      business_id: 'business-1',
      order: { id: 'order-other', business_id: 'business-1' },
      business: { id: 'business-1' },
    });
    const duplicateError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    const invoiceRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => {
        if (invoiceRepository.findOne.mock.calls.length === 1) return null;
        return recoveredInvoice;
      }),
      save: jest.fn(async () => {
        throw duplicateError;
      }),
    };
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(service.generateTaxInvoice('order-1')).rejects.toThrow(
      'tax invoice invoice-concurrent-other-order order_id must match requested order'
    );

    expect(settings.next_invoice_number).toBe(7);
    expect(settingsRepository.save).not.toHaveBeenCalled();
  });

  it('normalizes valid GSTIN values before persisting tax invoices', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => ({
        id: 'order-1',
        business_id: 'business-1',
        customer_name: 'Customer One',
        customer_phone: '+15551234567',
        delivery_address: '123 Main St',
        payment_method: 'cash',
        delivery_fee_cents: 0,
        business: { id: 'business-1', name: 'Cafe Blue' },
        items: [
          {
            dish_name: 'Thali',
            price_cents: 10_500,
            quantity: 1,
            dish: { metadata: { gst_rate: 5 } },
          },
        ],
      })),
    };
    const settings = {
      business_id: 'business-1',
      invoice_prefix: 'INV',
      next_invoice_number: 7,
      legal_business_name: 'Cafe Blue LLC',
      is_gst_registered: true,
      gstin: '  22aaaaa0000a1z5  ',
    };
    const settingsRepository = {
      ...createRepository(),
      findOne: jest.fn(async () => settings),
    };
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await service.generateTaxInvoice('order-1');

    expect(invoiceRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      seller_gstin: '22AAAAA0000A1Z5',
      invoice_number: expect.stringMatching(/^INV-\d{4}-0007$/),
    }));
    expect(invoiceRepository.save).toHaveBeenCalledTimes(1);
    expect(settings.next_invoice_number).toBe(8);
    expect(settingsRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      next_invoice_number: 8,
    }));
  });

  it('aggregates GST reports from validated recorded invoice money', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-1',
        business_id: ' business-1 ',
        invoice_date: new Date('2026-06-10T12:00:00.000Z'),
        subtotal_cents: 10_000,
        total_gst_cents: 500,
        total_cents: 10_500,
        gst_breakdown: [
          { rate: 5, taxable_amount_cents: 10_000, gst_amount_cents: 500, hsn_sac_code: '9963' },
        ],
        line_items: [
          {
            description: 'Thali',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: 10_000,
            gst_rate: 5,
            gst_amount_cents: 500,
            total_cents: 10_500,
          },
        ],
      }),
      validInvoiceRow({
        id: 'invoice-2',
        order_id: 'order-2',
        invoice_number: 'INV-2026-0002',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-11T12:00:00.000Z'),
        subtotal_cents: 20_000,
        total_gst_cents: 2_600,
        total_cents: 22_600,
        gst_breakdown: [
          { rate: 5, taxable_amount_cents: 5_000, gst_amount_cents: 250, hsn_sac_code: '9963' },
          { rate: 18, taxable_amount_cents: 15_000, gst_amount_cents: 2_350, hsn_sac_code: '9964' },
        ],
        line_items: [
          {
            description: 'Starter',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: 5_000,
            gst_rate: 5,
            gst_amount_cents: 250,
            total_cents: 5_250,
          },
          {
            description: 'Main',
            hsn_sac_code: '9964',
            quantity: 1,
            unit_price_cents: 15_000,
            gst_rate: 18,
            gst_amount_cents: 2_350,
            total_cents: 17_350,
          },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).resolves.toMatchObject({
      summary: {
        total_orders: 2,
        total_sales_cents: 30_000,
        total_gst_collected_cents: 3_100,
        gst_by_rate: [
          { rate: 5, taxable_amount_cents: 15_000, gst_amount_cents: 750 },
          { rate: 18, taxable_amount_cents: 15_000, gst_amount_cents: 2_350 },
        ],
      },
    });
  });

  it('rejects duplicate GST report invoice order evidence before aggregating statutory totals', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-1',
        order_id: 'order-1',
        invoice_number: 'INV-2026-0001',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-10T12:00:00.000Z'),
      }),
      validInvoiceRow({
        id: 'invoice-duplicate',
        order_id: 'order-1',
        invoice_number: 'INV-2026-0099',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-11T12:00:00.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-duplicate order_id must be unique within GST report');
  });

  it('rejects duplicate GST report invoice ids before aggregating statutory totals', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-duplicate-id',
        order_id: 'order-1',
        invoice_number: 'INV-2026-0001',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-10T12:00:00.000Z'),
      }),
      validInvoiceRow({
        id: 'invoice-duplicate-id',
        order_id: 'order-2',
        invoice_number: 'INV-2026-0002',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-11T12:00:00.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-duplicate-id id must be unique within GST report');
  });

  it('rejects malformed GST report invoice row envelopes before reading invoice ids', async () => {
    const invoiceRepository = createRepository([[] as unknown as TaxInvoice]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('GST report invoice row 1 must be an object');
  });

  it('rejects duplicate GST report invoice numbers before aggregating statutory totals', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-1',
        order_id: 'order-1',
        invoice_number: 'INV-2026-0001',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-10T12:00:00.000Z'),
      }),
      validInvoiceRow({
        id: 'invoice-2',
        order_id: 'order-2',
        invoice_number: 'INV-2026-0001',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-11T12:00:00.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-2 invoice_number must be unique within GST report');
  });

  it('rejects invalid tax report periods before repository reads', async () => {
    const invoiceRepository = createRepository();
    const paymentRepository = createRepository();
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('invalid-date'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('startDate must be a valid Date');

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-30T23:59:59.999Z'),
        new Date('2026-06-01T00:00:00.000Z')
      )
    ).rejects.toThrow('startDate must be before or equal to endDate');

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2025-01-01T00:00:00.000Z'),
        new Date('2026-01-03T00:00:00.001Z')
      )
    ).rejects.toThrow('tax report period must be 366 days or less');

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2025-01-01T00:00:00.000Z'),
        new Date('2026-01-03T00:00:00.001Z')
      )
    ).rejects.toThrow('tax report period must be 366 days or less');

    expect(invoiceRepository.find).not.toHaveBeenCalled();
    expect(paymentRepository.find).not.toHaveBeenCalled();
    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects corrupt GST report invoice money before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-corrupt',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        subtotal_cents: 10_000,
        total_gst_cents: 500,
        total_cents: 10_500,
        gst_breakdown: [
          { rate: 5, taxable_amount_cents: -1, gst_amount_cents: 500, hsn_sac_code: '9963' },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-corrupt GST taxable_amount_cents must be a non-negative finite number of cents');
  });

  it('rejects unsupported GST report invoice metadata before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-provider-metadata',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        metadata: {
          terms_and_conditions: 'Payment due on receipt.',
          provider_trace_id: 'trace-123',
        },
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-provider-metadata metadata include unsupported field(s): provider_trace_id'
    );

    const unsafeFieldNameInvoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-provider-metadata',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        metadata: {
          terms_and_conditions: 'Payment due on receipt.',
          'provider_trace_id\uFEFF': 'trace-123',
        },
      }),
    ]);
    const unsafeFieldNameService = new TaxReportService({
      invoiceRepository: unsafeFieldNameInvoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      unsafeFieldNameService.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-provider-metadata metadata field names must not include unsafe control characters'
    );
  });

  it('rejects unsupported GST report invoice row fields before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-provider-row',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        provider_trace_id: 'trace-123',
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-provider-row include unsupported field(s): provider_trace_id'
    );
  });

  it('rejects stale GST report invoice updated-at evidence before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-stale-updated-at',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        created_at: new Date('2026-06-15T12:05:00.000Z'),
        updated_at: new Date('2026-06-15T12:04:59.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-stale-updated-at updated_at cannot be before created_at'
    );
  });

  it('rejects malformed GST breakdown HSN/SAC evidence before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-bad-hsn',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
        gst_breakdown: [
          { rate: 5, taxable_amount_cents: 10_000, gst_amount_cents: 500, hsn_sac_code: '   ' },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-bad-hsn GST hsn_sac_code must be a non-empty string');
  });

  it('rejects cross-business GST invoice rows before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-cross-business',
        business_id: 'business-2',
        invoice_date: new Date('2026-06-15T12:00:00.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-cross-business business_id must match requested business');
  });

  it('rejects out-of-period GST invoice rows before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-out-of-period',
        business_id: 'business-1',
        invoice_date: new Date('2026-07-01T00:00:00.000Z'),
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-out-of-period invoice_date must be within the requested report period');
  });

  it('rejects GST report aggregates that overflow safe integer cents', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-max',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-10T12:00:00.000Z'),
        subtotal_cents: Number.MAX_SAFE_INTEGER,
        total_gst_cents: 0,
        total_cents: Number.MAX_SAFE_INTEGER,
        gst_breakdown: [
          {
            rate: 5,
            taxable_amount_cents: Number.MAX_SAFE_INTEGER,
            gst_amount_cents: 0,
            hsn_sac_code: '9963',
          },
        ],
        line_items: [
          {
            description: 'Max Value Item',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: Number.MAX_SAFE_INTEGER,
            gst_rate: 5,
            gst_amount_cents: 0,
            total_cents: Number.MAX_SAFE_INTEGER,
          },
        ],
      }),
      validInvoiceRow({
        id: 'invoice-overflow',
        order_id: 'order-overflow',
        invoice_number: 'INV-2026-0002',
        business_id: 'business-1',
        invoice_date: new Date('2026-06-11T12:00:00.000Z'),
        subtotal_cents: 1,
        total_gst_cents: 0,
        total_cents: 1,
        gst_breakdown: [
          { rate: 5, taxable_amount_cents: 1, gst_amount_cents: 0, hsn_sac_code: '9963' },
        ],
        line_items: [
          {
            description: 'Overflow Item',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: 1,
            gst_rate: 5,
            gst_amount_cents: 0,
            total_cents: 1,
          },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'GST report total sales must be a safe integer number of cents'
    );
  });

  it('rejects malformed GST report invoice line items before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-bad-lines',
        line_items: [
          {
            description: 'Thali',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: 10_000,
            gst_rate: 5,
            gst_amount_cents: 500,
            total_cents: 10_400,
          },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-bad-lines line_items[0] total_cents must equal unit_price_cents times quantity plus gst_amount_cents'
    );
  });

  it('rejects GST report invoices with no line-item evidence before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-empty-lines',
        subtotal_cents: 0,
        total_gst_cents: 0,
        total_cents: 0,
        gst_breakdown: [],
        line_items: [],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('tax invoice invoice-empty-lines line_items must include at least one item');
  });

  it('rejects mismatched GST breakdown rate buckets before returning statutory summaries', async () => {
    const invoiceRepository = createRepository([
      validInvoiceRow({
        id: 'invoice-mismatched-gst-bucket',
        subtotal_cents: 10_000,
        total_gst_cents: 500,
        total_cents: 10_500,
        gst_breakdown: [
          { rate: 18, taxable_amount_cents: 10_000, gst_amount_cents: 500, hsn_sac_code: '9963' },
        ],
        line_items: [
          {
            description: 'Thali',
            hsn_sac_code: '9963',
            quantity: 1,
            unit_price_cents: 10_000,
            gst_rate: 5,
            gst_amount_cents: 500,
            total_cents: 10_500,
          },
        ],
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'tax invoice invoice-mismatched-gst-bucket GST breakdown 5%/9963 must match line item aggregate'
    );
  });

  it('calculates profit analysis from validated recorded payment and payout money', async () => {
    const invoiceRepository = createRepository();
    const orderRepository = createRepository();
    const paymentRepository = createRepository([
      {
        id: 'payment-1',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 10_000,
        processor_fee_cents: 300,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
        refund_details: {
          refund_id: 'refund-1',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
      },
      {
        id: 'payment-2',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 5_000,
        processor_fee_cents: 100,
        processor_type: 'razorpay',
        created_at: new Date('2026-06-20T12:00:00.000Z'),
      },
    ]);
    const payoutRepository = createRepository([
      validPayoutRow({ id: 'payout-1', processor_fee_cents: 300, subscription_fee_cents: 500 }),
    ]);
    const settingsRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: invoiceRepository as any,
      orderRepository: orderRepository as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: settingsRepository as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).resolves.toEqual({
      revenue: {
        gross_sales_cents: 15_000,
        by_month: [{ month: '2026-06', amount_cents: 15_000 }],
        by_processor: [
          { processor: 'stripe', amount_cents: 10_000 },
          { processor: 'razorpay', amount_cents: 5_000 },
        ],
      },
      expenses: {
        total_expenses_cents: 1_900,
        processor_fees_cents: 400,
        subscription_fees_cents: 500,
        delivery_waivers_cents: 0,
        refunds_cents: 1_000,
      },
      profit: {
        net_profit_cents: 13_100,
        profit_margin_percentage: 87.33,
      },
    });
  });

  it('counts validated completed payout subscription fees in profit analysis expenses', async () => {
    const payoutRepository = createRepository([
      validPayoutRow({
        id: 'payout-completed-1',
        subscription_fee_cents: 500,
        status: ' completed ',
        period_end: new Date('2026-06-10T12:00:00.000Z'),
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        completed_at: new Date('2026-06-10T12:05:00.000Z'),
      }),
      validPayoutRow({
        id: 'payout-completed-2',
        subscription_fee_cents: 700,
        period_end: new Date('2026-06-20T12:00:00.000Z'),
        created_at: new Date('2026-06-20T12:00:00.000Z'),
        completed_at: new Date('2026-06-20T12:05:00.000Z'),
        metadata: { payment_ids: ['payment-2'] },
      }),
    ]);
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-1',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
        {
          id: 'payment-2',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-15T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).resolves.toMatchObject({
      expenses: {
        total_expenses_cents: 1_400,
        processor_fees_cents: 200,
        subscription_fees_cents: 1_200,
        refunds_cents: 0,
      },
    });

    expect(payoutRepository.find).toHaveBeenCalledWith({
      where: {
        business_id: 'business-1',
        status: 'completed',
        created_at: expect.any(Object),
      },
    });
  });

  it('normalizes persisted profit-analysis payment and payout business evidence before statutory joins', async () => {
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: ' payment-1 ',
          business_id: ' business-1 ',
          status: ' SUCCEEDED ',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: ' stripe ',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: createRepository([
        validPayoutRow({
          business_id: ' business-1 ',
          status: ' COMPLETED ',
          metadata: { payment_ids: [' payment-1 '] },
        }),
      ]) as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).resolves.toMatchObject({
      revenue: {
        gross_sales_cents: 10_000,
        by_month: [{ month: '2026-06', amount_cents: 10_000 }],
        by_processor: [{ processor: 'stripe', amount_cents: 10_000 }],
      },
      expenses: {
        processor_fees_cents: 100,
        subscription_fees_cents: 500,
        refunds_cents: 0,
      },
    });
  });

  it('rejects duplicate profit-analysis payment rows before payout metadata joins', async () => {
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-duplicate',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
        {
          id: 'payment-duplicate',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 5_000,
          processor_fee_cents: 50,
          processor_type: 'stripe',
          created_at: new Date('2026-06-06T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payment payment-duplicate id must be unique within profit analysis');

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects malformed profit-analysis payment row envelopes before payout metadata joins', async () => {
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([[] as any]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('profit payment row 1 must be an object');

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects duplicate profit-analysis refund ids before payout metadata joins', async () => {
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-refund-1',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
          refund_details: {
            refund_id: ' refund-duplicate ',
            refund_amount_cents: 1_000,
            refunded_at: '2026-06-06T12:00:00.000Z',
          },
        },
        {
          id: 'payment-refund-2',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 5_000,
          processor_fee_cents: 50,
          processor_type: 'stripe',
          created_at: new Date('2026-06-07T12:00:00.000Z'),
          refund_details: {
            refund_id: 'refund-duplicate',
            refund_amount_cents: 500,
            refunded_at: '2026-06-08T12:00:00.000Z',
          },
        },
      ]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payment payment-refund-2 refund_id must be unique within profit analysis');

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects duplicate profit-analysis payout rows before returning subscription fee totals', async () => {
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-1',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: createRepository([
        validPayoutRow({ id: 'payout-duplicate' }),
        validPayoutRow({ id: 'payout-duplicate' }),
      ]) as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payout payout-duplicate id must be unique within profit analysis');
  });

  it('rejects malformed profit-analysis payout row envelopes before returning subscription fee totals', async () => {
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-1',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: createRepository([[] as any]) as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('profit payout row 1 must be an object');
  });

  it('rejects corrupt profit-analysis money before returning compliance totals', async () => {
    const paymentRepository = createRepository([
      {
        id: 'payment-corrupt',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 10_000,
        processor_fee_cents: 100,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
        refund_details: {
          refund_id: 'refund-corrupt',
          refund_amount_cents: -1,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
      },
    ]);
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payment payment-corrupt refund_amount_cents must be a non-negative finite number of cents');
  });

  it('rejects malformed profit-analysis refund metadata before payout reads', async () => {
    const payoutRepository = createRepository();
    const basePayment = {
      business_id: 'business-1',
      status: 'succeeded',
      amount_cents: 10_000,
      processor_fee_cents: 100,
      processor_type: 'stripe',
      created_at: new Date('2026-06-05T12:00:00.000Z'),
    };
    const cases = [
      {
        id: 'payment-bad-refund',
        refund_details: ['not-a-refund-object'],
        expectedError: 'payment payment-bad-refund refund_details must be an object',
      },
      {
        id: 'payment-missing-refund-amount',
        refund_details: {
          refund_id: 'refund-missing-amount',
          reason: 'provider omitted refund amount',
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError:
          'payment payment-missing-refund-amount refund_details refund_amount_cents is required when refund_details is present',
      },
      {
        id: 'payment-missing-refund-id',
        refund_details: {
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError:
          'payment payment-missing-refund-id refund_details refund_id is required when refund_details is present',
      },
      {
        id: 'payment-blank-refund-id',
        refund_details: {
          refund_id: '   ',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError: 'payment payment-blank-refund-id refund_id must be a non-empty string',
      },
      {
        id: 'payment-edge-control-refund-id',
        refund_details: {
          refund_id: '\uFEFFrefund-edge',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError:
          'payment payment-edge-control-refund-id refund_id must not include unsafe control characters',
      },
      {
        id: 'payment-zero-refund',
        refund_details: {
          refund_id: 'refund-zero',
          refund_amount_cents: 0,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError:
          'payment payment-zero-refund refund_amount_cents must be positive when refund_details is present',
      },
      {
        id: 'payment-missing-refunded-at',
        refund_details: {
          refund_id: 'refund-missing-date',
          refund_amount_cents: 1_000,
        },
        expectedError:
          'payment payment-missing-refunded-at refund_details refunded_at is required when refund_details is present',
      },
      {
        id: 'payment-invalid-refunded-at',
        refund_details: {
          refund_id: 'refund-bad-date',
          refund_amount_cents: 1_000,
          refunded_at: 'not-a-date',
        },
        expectedError: 'payment payment-invalid-refunded-at refunded_at must be a valid date string',
      },
      {
        id: 'payment-loose-refunded-at',
        refund_details: {
          refund_id: 'refund-loose-date',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06 12:00:00',
        },
        expectedError:
          'payment payment-loose-refunded-at refunded_at must be an ISO-8601 UTC date string',
      },
      {
        id: 'payment-unsupported-refund-provider-field',
        refund_details: {
          refund_id: 'refund-provider-field',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
          provider_trace_id: 'trace-123',
        },
        expectedError:
          'payment payment-unsupported-refund-provider-field refund_details include unsupported field(s): provider_trace_id',
      },
      {
        id: 'payment-unsafe-refund-provider-field-name',
        refund_details: {
          refund_id: 'refund-provider-field',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
          'provider_trace_id\uFEFF': 'trace-123',
        },
        expectedError:
          'payment payment-unsafe-refund-provider-field-name refund_details field names must not include unsafe control characters',
      },
      {
        id: 'payment-refund-before-created',
        refund_details: {
          refund_id: 'refund-before-payment',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-05T11:59:59.999Z',
        },
        expectedError: 'payment payment-refund-before-created refunded_at must not be before created_at',
      },
      {
        id: 'payment-updated-before-created',
        updated_at: new Date('2026-06-05T11:59:59.999Z'),
        expectedError: 'payment payment-updated-before-created updated_at must not be before created_at',
      },
      {
        id: 'payment-updated-before-refund',
        updated_at: new Date('2026-06-06T11:59:59.999Z'),
        refund_details: {
          refund_id: 'refund-after-update',
          refund_amount_cents: 1_000,
          refunded_at: '2026-06-06T12:00:00.000Z',
        },
        expectedError: 'payment payment-updated-before-refund updated_at must not be before refunded_at',
      },
    ];

    for (const scenario of cases) {
      const service = new TaxReportService({
        invoiceRepository: createRepository() as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository([
          {
            ...basePayment,
            id: scenario.id,
            ...('updated_at' in scenario ? { updated_at: scenario.updated_at } : {}),
            refund_details: scenario.refund_details,
          },
        ]) as any,
        payoutRepository: payoutRepository as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateProfitAnalysis(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(scenario.expectedError);
    }

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects corrupt profit-analysis payment metadata before returning compliance buckets', async () => {
    const payoutRepository = createRepository();
    const serviceWithInvalidCreatedAt = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-bad-date',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: '2026-06-05T12:00:00.000Z',
        },
      ]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      serviceWithInvalidCreatedAt.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payment payment-bad-date created_at must be a valid Date');

    const serviceWithInvalidProcessor = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-bad-processor',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: { name: 'stripe' },
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      serviceWithInvalidProcessor.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('payment payment-bad-processor processor_type must be a string');

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects stale profit-analysis payment rows outside requested filters before payout reads', async () => {
    const staleRows = [
      {
        id: 'payment-cross-business',
        business_id: 'business-2',
        status: 'succeeded',
        amount_cents: 10_000,
        processor_fee_cents: 100,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
      },
      {
        id: 'payment-pending',
        business_id: 'business-1',
        status: 'pending',
        amount_cents: 10_000,
        processor_fee_cents: 100,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
      },
      {
        id: 'payment-out-of-period',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 10_000,
        processor_fee_cents: 100,
        processor_type: 'stripe',
        created_at: new Date('2026-07-01T00:00:00.000Z'),
      },
      {
        id: 'payment-refund-out-of-period',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 10_000,
        processor_fee_cents: 100,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
        refund_details: {
          refund_id: 'refund-out-of-period',
          refund_amount_cents: 1_000,
          refunded_at: '2026-07-01T00:00:00.000Z',
        },
      },
    ];

    for (const row of staleRows) {
      const payoutRepository = createRepository();
      const service = new TaxReportService({
        invoiceRepository: createRepository() as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository([row]) as any,
        payoutRepository: payoutRepository as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateProfitAnalysis(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(
        row.id === 'payment-cross-business'
          ? 'payment payment-cross-business business_id must match requested business'
          : row.id === 'payment-pending'
            ? 'payment payment-pending status must be succeeded'
            : row.id === 'payment-out-of-period'
              ? 'payment payment-out-of-period created_at must be within the requested report period'
              : 'payment payment-refund-out-of-period refunded_at must be within the requested report period'
      );

      expect(payoutRepository.find).not.toHaveBeenCalled();
    }
  });

  it('rejects corrupt profit-analysis payout metadata before returning expense totals', async () => {
    const cases = [
      {
        row: validPayoutRow({
          id: 'payout-bad-status',
          status: { state: 'completed' },
        }),
        expectedError: 'payout payout-bad-status status must be a string',
      },
      {
        row: validPayoutRow({
          id: 'payout-missing-completed-at',
          completed_at: undefined,
        }),
        expectedError: 'payout payout-missing-completed-at completed_at must be a valid Date',
      },
      {
        row: validPayoutRow({
          id: 'payout-completed-before-created',
          created_at: new Date('2026-06-25T12:00:00.000Z'),
          completed_at: new Date('2026-06-25T11:59:00.000Z'),
        }),
        expectedError: 'payout payout-completed-before-created completed_at must not be before created_at',
      },
      {
        row: validPayoutRow({
          id: 'payout-missing-period-start',
          period_start: undefined,
        }),
        expectedError: 'payout payout-missing-period-start period_start must be a valid Date',
      },
      {
        row: validPayoutRow({
          id: 'payout-missing-period-end',
          period_end: undefined,
        }),
        expectedError: 'payout payout-missing-period-end period_end must be a valid Date',
      },
      {
        row: validPayoutRow({
          id: 'payout-inverted-period',
          period_start: new Date('2026-06-30T23:59:59.999Z'),
          period_end: new Date('2026-06-01T00:00:00.000Z'),
        }),
        expectedError: 'payout payout-inverted-period period_start must not be after period_end',
      },
      {
        row: validPayoutRow({
          id: 'payout-period-after-completion',
          period_end: new Date('2026-06-25T12:05:00.001Z'),
        }),
        expectedError: 'payout payout-period-after-completion period_end must not be after completed_at',
      },
      {
        row: validPayoutRow({
          id: 'payout-updated-before-completion',
          updated_at: new Date('2026-06-25T12:04:59.999Z'),
          completed_at: new Date('2026-06-25T12:05:00.000Z'),
        }),
        expectedError: 'payout payout-updated-before-completion updated_at must not be before completed_at',
      },
      {
        row: validPayoutRow({
          id: 'payout-stale-failure-reason',
          failure_reason: 'Previous bank rejection',
        }),
        expectedError: 'payout payout-stale-failure-reason failure_reason cannot be present when status is completed',
      },
      {
        row: validPayoutRow({
          id: 'payout-stale-failed-at',
          failed_at: new Date('2026-06-25T12:03:00.000Z'),
        }),
        expectedError: 'payout payout-stale-failed-at failed_at cannot be present when status is completed',
      },
      {
        row: validPayoutRow({
          id: 'payout-bad-net',
          net_amount_cents: 9_999,
        }),
        expectedError:
          'payout payout-bad-net net_amount_cents must equal gross_amount_cents minus fees plus volume_discount_cents',
      },
      {
        row: validPayoutRow({
          id: 'payout-impossible-discount',
          gross_amount_cents: 10_000,
          processor_fee_cents: 100,
          subscription_fee_cents: 500,
          platform_fee_cents: 0,
          volume_discount_cents: 10_001,
        }),
        expectedError: 'payout payout-impossible-discount volume_discount_cents cannot exceed gross_amount_cents',
      },
      {
        row: validPayoutRow({
          id: 'payout-missing-payment-count',
          payment_count: undefined,
        }),
        expectedError: 'payout payout-missing-payment-count payment_count must be a non-negative integer',
      },
      {
        row: validPayoutRow({
          id: 'payout-gross-without-payment-count',
          payment_count: 0,
          metadata: { payment_ids: [] },
        }),
        expectedError:
          'payout payout-gross-without-payment-count payment_count must be positive when gross_amount_cents is positive',
      },
      {
        row: validPayoutRow({
          id: 'payout-missing-payment-ids',
          metadata: {},
        }),
        expectedError:
          'payout payout-missing-payment-ids metadata.payment_ids is required when payment_count is positive',
      },
      {
        row: validPayoutRow({
          id: 'payout-unsupported-provider-metadata',
          metadata: { payment_ids: ['payment-1'], provider_trace_id: 'trace-123' },
        }),
        expectedError:
          'payout payout-unsupported-provider-metadata metadata include unsupported field(s): provider_trace_id',
      },
      {
        row: validPayoutRow({
          id: 'payout-unsafe-provider-metadata-field-name',
          metadata: { payment_ids: ['payment-1'], 'provider_trace_id\uFEFF': 'trace-123' },
        }),
        expectedError:
          'payout payout-unsafe-provider-metadata-field-name metadata field names must not include unsafe control characters',
      },
      {
        row: validPayoutRow({
          id: 'payout-mismatched-payment-ids',
          payment_count: 3,
          metadata: { payment_ids: ['payment-1', 'payment-2'] },
        }),
        expectedError: 'payout payout-mismatched-payment-ids metadata.payment_ids length must equal payment_count',
      },
      {
        row: validPayoutRow({
          id: 'payout-duplicate-payment-ids',
          metadata: { payment_ids: ['payment-1', 'payment-1'] },
        }),
        expectedError: 'payout payout-duplicate-payment-ids metadata.payment_ids must not contain duplicates',
      },
      {
        row: validPayoutRow({
          id: 'payout-out-of-scope-payment-id',
          metadata: { payment_ids: ['payment-elsewhere'] },
        }),
        expectedError:
          'payout payout-out-of-scope-payment-id metadata.payment_ids must reference requested payment rows',
      },
      {
        row: validPayoutRow({
          id: 'payout-oversized-payment-id',
          metadata: { payment_ids: [`payment-${'x'.repeat(256)}`] },
        }),
        expectedError:
          'payout payout-oversized-payment-id metadata.payment_ids[0] must be at most 255 characters',
      },
      {
        row: validPayoutRow({
          id: 'payout-mismatched-payment-gross',
          gross_amount_cents: 9_999,
          metadata: { payment_ids: ['payment-1'] },
        }),
        expectedError:
          'payout payout-mismatched-payment-gross gross_amount_cents must equal referenced metadata.payment_ids total',
      },
      {
        row: validPayoutRow({
          id: 'payout-mismatched-payment-fees',
          processor_fee_cents: 301,
          metadata: { payment_ids: ['payment-1'] },
        }),
        expectedError:
          'payout payout-mismatched-payment-fees processor_fee_cents must equal referenced metadata.payment_ids processor fees total',
      },
    ];

    for (const scenario of cases) {
      const service = new TaxReportService({
        invoiceRepository: createRepository() as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository([
          {
            id: 'payment-1',
            business_id: 'business-1',
            status: 'succeeded',
            amount_cents: 10_000,
            processor_fee_cents: 100,
            processor_type: 'stripe',
            created_at: new Date('2026-06-05T12:00:00.000Z'),
          },
        ]) as any,
        payoutRepository: createRepository([scenario.row]) as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateProfitAnalysis(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(scenario.expectedError);
    }
  });

  it('rejects oversized profit-analysis payment row IDs before payout linkage reads', async () => {
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: `payment-${'x'.repeat(256)}`,
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('profit payment row 1 id must be at most 255 characters');
  });

  it('rejects stale profit-analysis payout rows outside requested filters before returning expense totals', async () => {
    const staleRows = [
      validPayoutRow({
        id: 'payout-cross-business',
        business_id: 'business-2',
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        completed_at: new Date('2026-06-10T12:05:00.000Z'),
      }),
      validPayoutRow({
        id: 'payout-pending',
        status: 'pending',
        created_at: new Date('2026-06-10T12:00:00.000Z'),
        completed_at: undefined,
      }),
      validPayoutRow({
        id: 'payout-out-of-period',
        created_at: new Date('2026-07-01T00:00:00.000Z'),
        completed_at: new Date('2026-07-01T00:05:00.000Z'),
      }),
      validPayoutRow({
        id: 'payout-completed-out-of-period',
        created_at: new Date('2026-06-30T23:55:00.000Z'),
        completed_at: new Date('2026-07-01T00:05:00.000Z'),
      }),
      validPayoutRow({
        id: 'payout-period-start-out-of-period',
        period_start: new Date('2026-05-31T23:59:59.999Z'),
      }),
      validPayoutRow({
        id: 'payout-period-end-out-of-period',
        period_end: new Date('2026-07-01T00:00:00.000Z'),
      }),
    ];

    for (const row of staleRows) {
      const service = new TaxReportService({
        invoiceRepository: createRepository() as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository([
          {
            id: 'payment-1',
            business_id: 'business-1',
            status: 'succeeded',
            amount_cents: 10_000,
            processor_fee_cents: 100,
            processor_type: 'stripe',
            created_at: new Date('2026-06-05T12:00:00.000Z'),
          },
        ]) as any,
        payoutRepository: createRepository([row]) as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateProfitAnalysis(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(
        row.id === 'payout-cross-business'
          ? 'payout payout-cross-business business_id must match requested business'
          : row.id === 'payout-pending'
            ? 'payout payout-pending status must be completed'
            : row.id === 'payout-out-of-period'
              ? 'payout payout-out-of-period created_at must be within the requested report period'
              : row.id === 'payout-completed-out-of-period'
                ? 'payout payout-completed-out-of-period completed_at must be within the requested report period'
                : row.id === 'payout-period-start-out-of-period'
                  ? 'payout payout-period-start-out-of-period period_start must be within the requested report period'
                  : 'payout payout-period-end-out-of-period period_end must be within the requested report period'
      );
    }
  });

  it('rejects reused payout payment IDs before double-counting profit expenses', async () => {
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository([
        {
          id: 'payment-1',
          business_id: 'business-1',
          status: 'succeeded',
          amount_cents: 10_000,
          processor_fee_cents: 100,
          processor_type: 'stripe',
          created_at: new Date('2026-06-05T12:00:00.000Z'),
        },
      ]) as any,
      payoutRepository: createRepository([
        validPayoutRow({
          id: 'payout-1',
          metadata: { payment_ids: ['payment-1'] },
        }),
        validPayoutRow({
          id: 'payout-duplicate-payment',
          metadata: { payment_ids: ['payment-1'] },
        }),
      ]) as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'payout payout-duplicate-payment metadata.payment_ids must not reuse payment ids across payout rows'
    );
  });

  it('rejects profit report aggregates that overflow safe integer cents before payout reads', async () => {
    const paymentRepository = createRepository([
      {
        id: 'payment-max',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: Number.MAX_SAFE_INTEGER,
        processor_fee_cents: 0,
        processor_type: 'stripe',
        created_at: new Date('2026-06-05T12:00:00.000Z'),
      },
      {
        id: 'payment-overflow',
        business_id: 'business-1',
        status: 'succeeded',
        amount_cents: 1,
        processor_fee_cents: 0,
        processor_type: 'stripe',
        created_at: new Date('2026-06-06T12:00:00.000Z'),
      },
    ]);
    const payoutRepository = createRepository();
    const service = new TaxReportService({
      invoiceRepository: createRepository() as any,
      orderRepository: createRepository() as any,
      paymentRepository: paymentRepository as any,
      payoutRepository: payoutRepository as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      service.generateProfitAnalysis(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow(
      'profit report gross sales must be a safe integer number of cents'
    );

    expect(payoutRepository.find).not.toHaveBeenCalled();
  });

  it('rejects unsupported nested tax invoice evidence before returning statutory summaries', async () => {
    const scenarios: Array<{
      row: Record<string, unknown>;
      expectedError: string;
    }> = [
      {
        row: validInvoiceRow({
          id: 'invoice-provider-gst-breakdown',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          gst_breakdown: [
            {
              rate: 5,
              taxable_amount_cents: 10_000,
              gst_amount_cents: 500,
              hsn_sac_code: '9963',
              provider_trace_id: 'trace-123',
            },
          ],
        }),
        expectedError:
          'invoice invoice-provider-gst-breakdown gst_breakdown[0] include unsupported field(s): provider_trace_id',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-unsafe-gst-breakdown-field',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          gst_breakdown: [
            {
              rate: 5,
              taxable_amount_cents: 10_000,
              gst_amount_cents: 500,
              hsn_sac_code: '9963',
              ['provider_trace_id\uFEFF']: 'trace-123',
            },
          ],
        }),
        expectedError:
          'invoice invoice-unsafe-gst-breakdown-field gst_breakdown[0] field names must not include unsafe control characters',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-provider-line-item',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          line_items: [
            {
              description: 'Thali',
              hsn_sac_code: '9963',
              quantity: 1,
              unit_price_cents: 10_000,
              gst_rate: 5,
              gst_amount_cents: 500,
              total_cents: 10_500,
              provider_trace_id: 'trace-123',
            },
          ],
        }),
        expectedError:
          'tax invoice invoice-provider-line-item line_items[0] include unsupported field(s): provider_trace_id',
      },
      {
        row: validInvoiceRow({
          id: 'invoice-unsafe-line-item-field',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          line_items: [
            {
              description: 'Thali',
              hsn_sac_code: '9963',
              quantity: 1,
              unit_price_cents: 10_000,
              gst_rate: 5,
              gst_amount_cents: 500,
              total_cents: 10_500,
              ['provider_trace_id\uFEFF']: 'trace-123',
            },
          ],
        }),
        expectedError:
          'tax invoice invoice-unsafe-line-item-field line_items[0] field names must not include unsafe control characters',
      },
    ];

    for (const { row, expectedError } of scenarios) {
      const service = new TaxReportService({
        invoiceRepository: createRepository([row]) as any,
        orderRepository: createRepository() as any,
        paymentRepository: createRepository() as any,
        payoutRepository: createRepository() as any,
        settingsRepository: createRepository() as any,
      }, { enforceCapability: false });

      await expect(
        service.generateGstReport(
          'business-1',
          new Date('2026-06-01T00:00:00.000Z'),
          new Date('2026-06-30T23:59:59.999Z')
        )
      ).rejects.toThrow(expectedError);
    }
  });

  it('rejects internally inconsistent GST invoice totals before returning statutory summaries', async () => {
    const serviceWithBadGrandTotal = new TaxReportService({
      invoiceRepository: createRepository([
        validInvoiceRow({
          id: 'invoice-bad-total',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          subtotal_cents: 10_000,
          total_gst_cents: 500,
          total_cents: 10_400,
          gst_breakdown: [
            { rate: 5, taxable_amount_cents: 10_000, gst_amount_cents: 500, hsn_sac_code: '9963' },
          ],
        }),
      ]) as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      serviceWithBadGrandTotal.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-bad-total total_cents must equal subtotal_cents plus total_gst_cents');

    const serviceWithBadBreakdown = new TaxReportService({
      invoiceRepository: createRepository([
        validInvoiceRow({
          id: 'invoice-bad-breakdown',
          business_id: 'business-1',
          invoice_date: new Date('2026-06-12T12:00:00.000Z'),
          subtotal_cents: 10_000,
          total_gst_cents: 500,
          total_cents: 10_500,
          gst_breakdown: [
            { rate: 5, taxable_amount_cents: 9_000, gst_amount_cents: 500, hsn_sac_code: '9963' },
          ],
        }),
      ]) as any,
      orderRepository: createRepository() as any,
      paymentRepository: createRepository() as any,
      payoutRepository: createRepository() as any,
      settingsRepository: createRepository() as any,
    }, { enforceCapability: false });

    await expect(
      serviceWithBadBreakdown.generateGstReport(
        'business-1',
        new Date('2026-06-01T00:00:00.000Z'),
        new Date('2026-06-30T23:59:59.999Z')
      )
    ).rejects.toThrow('invoice invoice-bad-breakdown GST taxable breakdown total must equal subtotal_cents');
  });
});
