import { Repository, Between } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { TaxInvoice } from '../models/TaxInvoice.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Payout } from '../models/Payout.js';
import { BusinessSettings } from '../models/BusinessSettings.js';
import { TaxService } from './TaxService.js';
import { assertCapabilityEnabled } from '../config/capabilities.js';

type TaxInvoiceBankDetails = NonNullable<TaxInvoice['metadata']>['bank_details'];
const UNSAFE_TAX_TEXT_CONTROLS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u;
const TAX_INVOICE_ROW_KEYS = new Set([
  'id',
  'order',
  'order_id',
  'business',
  'business_id',
  'invoice_number',
  'invoice_date',
  'financial_year',
  'customer_name',
  'customer_phone',
  'customer_address',
  'seller_gstin',
  'seller_business_name',
  'seller_address',
  'subtotal_cents',
  'gst_breakdown',
  'total_gst_cents',
  'total_cents',
  'currency',
  'line_items',
  'payment_method',
  'payment_reference',
  'pdf_url',
  'pdf_status',
  'pdf_error',
  'metadata',
  'created_at',
  'updated_at',
]);
const TAX_INVOICE_DISH_METADATA_KEYS = new Set(['gst_rate']);
const TAX_INVOICE_METADATA_KEYS = new Set(['terms_and_conditions', 'bank_details']);
const TAX_INVOICE_GST_BREAKDOWN_KEYS = new Set([
  'rate',
  'taxable_amount_cents',
  'gst_amount_cents',
  'hsn_sac_code',
]);
const TAX_INVOICE_LINE_ITEM_KEYS = new Set([
  'description',
  'hsn_sac_code',
  'quantity',
  'unit_price_cents',
  'gst_rate',
  'gst_amount_cents',
  'total_cents',
]);
const TAX_INVOICE_SETTINGS_ROW_KEYS = new Set([
  'id',
  'business',
  'business_id',
  'delivery_type',
  'delivery_fee_cents',
  'delivery_base_fee_cents',
  'delivery_per_km_cents',
  'min_order_free_delivery_cents',
  'distance_rounding',
  'payment_method',
  'payment_instructions',
  'currency',
  'min_order_value_cents',
  'auto_confirm_orders',
  'enable_customer_notes',
  'whatsapp_enabled',
  'whatsapp_phone_number',
  'whatsapp_notify_new_order',
  'whatsapp_notify_order_update',
  'whatsapp_notify_payment',
  'whatsapp_customer_notifications',
  'gstin',
  'legal_business_name',
  'business_address',
  'is_gst_registered',
  'invoice_prefix',
  'next_invoice_number',
  'bank_details',
  'invoice_terms',
  'default_locale',
  'supported_locales',
  'rtl_enabled',
  'date_format',
  'time_format',
  'currency_display',
  'created_at',
  'updated_at',
]);
const TAX_REPORT_REFUND_DETAILS_KEYS = new Set([
  'refund_amount_cents',
  'refund_id',
  'refunded_at',
]);
const TAX_REPORT_PAYOUT_METADATA_KEYS = new Set(['payment_ids']);
const MAX_TAX_REPORT_LINKED_PAYMENT_ID_LENGTH = 255;
const MAX_TAX_INVOICE_PAYMENT_REFERENCE_LENGTH = 255;
const MAX_TAX_INVOICE_PDF_URL_LENGTH = 2048;
const MAX_TAX_INVOICE_PDF_ERROR_LENGTH = 1000;

export interface TaxLineItemBreakdown {
  description: string;
  hsn_sac_code: string;
  quantity: number;
  unit_price_cents: number;
  gst_rate: number;
  gst_amount_cents: number;
  total_cents: number;
}

export interface TaxRateBreakdown {
  rate: number;
  taxable_amount_cents: number;
  gst_amount_cents: number;
  hsn_sac_code: string;
}

export interface TaxBreakdownResult {
  lineItems: TaxLineItemBreakdown[];
  gstBreakdown: TaxRateBreakdown[];
  subtotal: number;
  totalGst: number;
  grandTotal: number;
}

interface TaxReportRepositoryOverrides {
  invoiceRepository?: Repository<TaxInvoice>;
  orderRepository?: Repository<Order>;
  paymentRepository?: Repository<Payment>;
  payoutRepository?: Repository<Payout>;
  settingsRepository?: Repository<BusinessSettings>;
}

interface TaxReportServiceOptions {
  enforceCapability?: boolean;
}

/**
 * TaxReportService
 * Phase 3: Advanced Reporting & Tax Compliance (US3.4)
 *
 * Handles:
 * - Tax invoice generation with GST breakdown
 * - GST reports (monthly outward supplies)
 * - Profit analysis (revenue/expense breakdown)
 * - Compliance reports (payouts, refunds)
 */
export class TaxReportService {
  private static readonly MAX_REPORT_PERIOD_DAYS = 366;
  private static readonly MAX_REPORT_PERIOD_MS =
    TaxReportService.MAX_REPORT_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  private invoiceRepository: Repository<TaxInvoice>;
  private orderRepository: Repository<Order>;
  private paymentRepository: Repository<Payment>;
  private payoutRepository: Repository<Payout>;
  private settingsRepository: Repository<BusinessSettings>;
  private readonly enforceCapability: boolean;

  // GST rates for food items
  private static readonly GST_RATES = {
    RESTAURANT: 5, // Restaurant services (5%)
    FOOD_ITEMS: 5, // Packaged food (5%)
    CATERING: 18, // Catering services (18%)
  };

  // HSN/SAC codes
  private static readonly HSN_SAC_CODES = {
    FOOD_SERVICE: '9963', // Restaurant and food service
    CATERING: '9964', // Catering services
  };

  constructor(
    repositories: TaxReportRepositoryOverrides = {},
    options: TaxReportServiceOptions = {}
  ) {
    this.invoiceRepository = repositories.invoiceRepository ?? AppDataSource.getRepository(TaxInvoice);
    this.orderRepository = repositories.orderRepository ?? AppDataSource.getRepository(Order);
    this.paymentRepository = repositories.paymentRepository ?? AppDataSource.getRepository(Payment);
    this.payoutRepository = repositories.payoutRepository ?? AppDataSource.getRepository(Payout);
    this.settingsRepository = repositories.settingsRepository ?? AppDataSource.getRepository(BusinessSettings);
    this.enforceCapability = options.enforceCapability !== false;
  }

  /**
   * Generate tax invoice for an order
   */
  async generateTaxInvoice(orderId: string): Promise<TaxInvoice> {
    this.assertTaxReportingEnabled();
    const normalizedOrderId = TaxReportService.validatedIdentifier('orderId', orderId);
    // Check if invoice already exists
    const existing = await this.invoiceRepository.findOne({
      where: { order_id: normalizedOrderId },
      relations: ['order', 'business'],
    });

    if (existing) {
      TaxReportService.assertReadableTaxInvoice(existing, {
        orderId: normalizedOrderId,
        requireRelationEvidence: true,
      });
      return existing;
    }

    // Get order with items
    const order = await this.orderRepository.findOne({
      where: { id: normalizedOrderId },
      relations: ['business', 'items', 'items.dish'],
    });

    if (!order) {
      throw new Error('Order not found');
    }
    const orderBusinessId = TaxReportService.assertInvoiceOrderMatchesRequest(
      order,
      normalizedOrderId
    );
    const orderBusinessName = TaxReportService.assertInvoiceOrderBusinessRelation(
      order,
      orderBusinessId
    );
    const customerName = TaxReportService.validatedIdentifier(
      'tax invoice order customer_name',
      order.customer_name
    );
    const customerPhone = TaxReportService.validatedOptionalSettingString(
      'tax invoice order customer_phone',
      order.customer_phone
    );
    const paymentMethod = TaxReportService.validatedOptionalSettingString(
      'tax invoice order payment_method',
      order.payment_method
    );

    // Get business settings
    const settings = await this.settingsRepository.findOne({
      where: { business_id: orderBusinessId },
    });

    if (!settings) {
      throw new Error('Business settings not found');
    }
    TaxReportService.assertInvoiceSettingsMatchBusiness(settings, orderBusinessId);

    // Generate invoice number
    const sellerGstin = TaxReportService.validatedSellerGstin(settings);
    const invoiceNumber = this.generateInvoiceNumber(settings);
    const financialYear = this.getFinancialYear(new Date());
    const sellerBusinessName = TaxReportService.validatedOptionalLabel(
      'tax invoice settings legal_business_name',
      settings.legal_business_name,
      orderBusinessName
    );
    const sellerAddress = TaxReportService.validatedOptionalSettingString(
      'tax invoice settings business_address',
      settings.business_address
    );
    const invoiceTerms = TaxReportService.validatedOptionalSettingString(
      'tax invoice settings invoice_terms',
      settings.invoice_terms
    );
    const bankDetails = TaxReportService.validatedOptionalBankDetails(
      'tax invoice settings bank_details',
      settings.bank_details
    );
    const customerAddress = TaxReportService.validatedOptionalSettingString(
      'tax invoice order delivery_address',
      order.delivery_address
    );

    // Calculate GST breakdown
    const { lineItems, gstBreakdown, subtotal, totalGst, grandTotal } =
      TaxReportService.calculateGstBreakdown(order);
    const invoiceMetadata = {
      ...(invoiceTerms === undefined ? {} : { terms_and_conditions: invoiceTerms }),
      ...(bankDetails === undefined ? {} : { bank_details: bankDetails }),
    };

    // Create invoice
    const invoice = this.invoiceRepository.create({
      order_id: normalizedOrderId,
      business_id: orderBusinessId,
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
      financial_year: financialYear,
      customer_name: customerName,
      ...(customerPhone === undefined ? {} : { customer_phone: customerPhone }),
      ...(customerAddress === undefined ? {} : { customer_address: customerAddress }),
      ...(sellerGstin === undefined ? {} : { seller_gstin: sellerGstin }),
      seller_business_name: sellerBusinessName,
      ...(sellerAddress === undefined ? {} : { seller_address: sellerAddress }),
      subtotal_cents: subtotal,
      gst_breakdown: gstBreakdown,
      total_gst_cents: totalGst,
      total_cents: grandTotal,
      line_items: lineItems,
      ...(paymentMethod === undefined ? {} : { payment_method: paymentMethod }),
      ...(Object.keys(invoiceMetadata).length === 0 ? {} : { metadata: invoiceMetadata }),
    });

    try {
      await this.invoiceRepository.save(invoice);
    } catch (error) {
      if (!TaxReportService.isRecoverableDuplicateInvoiceSaveError(error)) {
        throw error;
      }

      const recoveredInvoice = await this.invoiceRepository.findOne({
        where: { order_id: normalizedOrderId },
        relations: ['order', 'business'],
      });
      if (!recoveredInvoice) {
        throw error;
      }
      TaxReportService.assertReadableTaxInvoice(recoveredInvoice, {
        orderId: normalizedOrderId,
        requireRelationEvidence: true,
      });
      return recoveredInvoice;
    }

    // Increment invoice number
    settings.next_invoice_number++;
    await this.settingsRepository.save(settings);

    return invoice;
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(settings: BusinessSettings): string {
    const prefix = this.validatedInvoicePrefix(settings.invoice_prefix);
    const year = new Date().getFullYear();
    const number = this.validatedNextInvoiceNumber(settings.next_invoice_number).toString().padStart(4, '0');
    return `${prefix}-${year}-${number}`;
  }

  private validatedInvoicePrefix(prefix?: unknown): string {
    if (prefix !== undefined && prefix !== null && typeof prefix !== 'string') {
      throw new Error('invoice_prefix must be a string');
    }
    const prefixText = typeof prefix === 'string' ? prefix : 'INV';
    TaxReportService.assertNoUnsafeTaxTextControls('invoice_prefix', prefixText);
    const normalized = prefixText.trim().toUpperCase();
    if (!/^[A-Z0-9-]{1,10}$/.test(normalized)) {
      throw new Error('invoice_prefix must be 1-10 uppercase letters, numbers, or hyphens');
    }
    return normalized;
  }

  private validatedNextInvoiceNumber(nextInvoiceNumber: number): number {
    if (!Number.isInteger(nextInvoiceNumber) || nextInvoiceNumber <= 0) {
      throw new Error('next_invoice_number must be a positive integer');
    }
    if (!Number.isSafeInteger(nextInvoiceNumber) || nextInvoiceNumber >= Number.MAX_SAFE_INTEGER) {
      throw new Error('next_invoice_number must be a safe integer with room for sequence increment');
    }
    return nextInvoiceNumber;
  }

  private static isRecoverableDuplicateInvoiceSaveError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const errorRecord = error as Record<string, unknown>;
    const code = typeof errorRecord.code === 'string' ? errorRecord.code : '';
    if (code === '23505' || code === 'SQLITE_CONSTRAINT' || code === 'ER_DUP_ENTRY') {
      return true;
    }

    const message = typeof errorRecord.message === 'string' ? errorRecord.message.toLowerCase() : '';
    return (
      message.includes('duplicate') ||
      message.includes('unique constraint') ||
      message.includes('unique violation') ||
      message.includes('constraint failed')
    );
  }

  private static validatedSellerGstin(settings: BusinessSettings): string | undefined {
    const rawGstin = settings.gstin;
    if (rawGstin === undefined || rawGstin === null) {
      if (settings.is_gst_registered) {
        throw new Error('GST-registered businesses must have a GSTIN before tax invoice generation');
      }
      return undefined;
    }
    if (typeof rawGstin !== 'string') {
      throw new Error('gstin must be a string');
    }
    TaxReportService.assertNoUnsafeTaxTextControls('gstin', rawGstin);
    if (rawGstin.trim() === '') {
      if (settings.is_gst_registered) {
        throw new Error('GST-registered businesses must have a GSTIN before tax invoice generation');
      }
      return undefined;
    }

    const normalized = rawGstin.trim().toUpperCase();
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized)) {
      throw new Error('gstin must be a valid 15-character GSTIN');
    }

    return normalized;
  }

  private static assertInvoiceOrderMatchesRequest(order: Order, orderId: string): string {
    const persistedOrderId = TaxReportService.validatedIdentifier('tax invoice order id', order.id);
    if (persistedOrderId !== orderId) {
      throw new Error('tax invoice order id must match requested order');
    }

    return TaxReportService.validatedIdentifier(
      `tax invoice order ${persistedOrderId} business_id`,
      order.business_id
    );
  }

  private static assertInvoiceOrderBusinessRelation(order: Order, businessId: string): string {
    const relatedBusiness = (order as Order & { business?: { id?: unknown; name?: unknown } }).business;
    if (!relatedBusiness) {
      throw new Error('tax invoice order business relation is required');
    }

    const relatedBusinessId = TaxReportService.validatedIdentifier(
      'tax invoice order business relation id',
      relatedBusiness.id
    );
    if (relatedBusinessId !== businessId) {
      throw new Error('tax invoice order business relation id must match order business_id');
    }

    return TaxReportService.validatedIdentifier(
      'tax invoice order business relation name',
      relatedBusiness.name
    );
  }

  private static assertInvoiceSettingsMatchBusiness(
    settings: BusinessSettings,
    businessId: string
  ): void {
    TaxReportService.assertInvoiceSettingsRowEnvelope(settings);
    const persistedBusinessId = TaxReportService.validatedIdentifier(
      'tax invoice settings business_id',
      settings.business_id
    );
    if (persistedBusinessId !== businessId) {
      throw new Error('tax invoice settings business_id must match order business');
    }
    if (
      settings.is_gst_registered !== undefined &&
      typeof settings.is_gst_registered !== 'boolean'
    ) {
      throw new Error('tax invoice settings is_gst_registered must be a boolean');
    }
  }

  private static assertInvoiceSettingsRowEnvelope(settings: BusinessSettings): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('tax invoice settings row must be an object');
    }
    const settingsRecord = settings as unknown as Record<string, unknown>;
    const settingsKeys = Object.keys(settingsRecord);
    TaxReportService.assertTaxFieldNamesAreSafe('tax invoice settings row', settingsKeys);
    const unsupportedKeys = settingsKeys.filter(
      (key) => !TAX_INVOICE_SETTINGS_ROW_KEYS.has(key) && settingsRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `tax invoice settings row include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    let createdAt: Date | undefined;
    if (settings.created_at !== undefined && settings.created_at !== null) {
      createdAt = TaxReportService.validatedDate('tax invoice settings created_at', settings.created_at);
    }
    let updatedAt: Date | undefined;
    if (settings.updated_at !== undefined && settings.updated_at !== null) {
      updatedAt = TaxReportService.validatedDate('tax invoice settings updated_at', settings.updated_at);
    }
    if (createdAt && updatedAt && updatedAt < createdAt) {
      throw new Error('tax invoice settings updated_at cannot be before created_at');
    }
  }

  /**
   * Get financial year (Apr-Mar in India)
   */
  private getFinancialYear(date: Date): string {
    const { startYear, endYear } = TaxReportService.financialYearForDate(date);
    return `${startYear}-${endYear.toString().slice(2)}`;
  }

  /**
   * Calculate GST breakdown for order
   */
  static calculateGstBreakdown(order: Pick<Order, 'items' | 'delivery_fee_cents'>): TaxBreakdownResult {
    if (!order || typeof order !== 'object' || Array.isArray(order)) {
      throw new Error('tax invoice order must be an object');
    }
    const orderItems = order.items ?? [];
    if (!Array.isArray(orderItems)) {
      throw new Error('tax invoice order items must be an array');
    }

    const lineItems: TaxLineItemBreakdown[] = [];
    const gstByRate = new Map<number, { taxable: number; gst: number }>();
    const deliveryFeeCents = order.delivery_fee_cents ?? 0;
    TaxReportService.assertNonNegativeMinorUnits(deliveryFeeCents, 'delivery_fee_cents');

    let subtotal = 0;
    let totalGst = 0;

    // Process order items
    for (const [index, item] of orderItems.entries()) {
      const itemLabel = TaxReportService.validatedOrderItemDescription(item, index);
      TaxReportService.assertPositiveIntegerQuantity(item.quantity, itemLabel);
      TaxReportService.assertNonNegativeMinorUnits(item.price_cents, itemLabel);

      // Determine GST rate (default 5% for food only when no dish GST metadata exists)
      const gstRate = TaxReportService.validatedOrderItemGstRate(itemLabel, item);
      const hsnCode = TaxReportService.HSN_SAC_CODES.FOOD_SERVICE;

      const unitPriceWithGst = item.price_cents;
      const unitSplit = TaxService.splitInclusiveTax(unitPriceWithGst, gstRate);

      const itemSubtotal = TaxReportService.checkedMultiplyMinorUnits(
        `${itemLabel} taxable total`,
        unitSplit.taxable_amount_cents,
        item.quantity
      );
      const itemGst = TaxReportService.checkedMultiplyMinorUnits(
        `${itemLabel} GST total`,
        unitSplit.tax_amount_cents,
        item.quantity
      );
      const itemTotal = TaxReportService.checkedMultiplyMinorUnits(
        `${itemLabel} line total`,
        unitPriceWithGst,
        item.quantity
      );

      lineItems.push({
        description: itemLabel,
        hsn_sac_code: hsnCode,
        quantity: item.quantity,
        unit_price_cents: unitSplit.taxable_amount_cents,
        gst_rate: gstRate,
        gst_amount_cents: itemGst,
        total_cents: itemTotal,
      });

      // Aggregate by GST rate
      if (!gstByRate.has(gstRate)) {
        gstByRate.set(gstRate, { taxable: 0, gst: 0 });
      }
      const rateData = gstByRate.get(gstRate)!;
      rateData.taxable = TaxReportService.checkedAddMinorUnits(
        `GST ${gstRate}% taxable aggregate`,
        rateData.taxable,
        itemSubtotal
      );
      rateData.gst = TaxReportService.checkedAddMinorUnits(
        `GST ${gstRate}% amount aggregate`,
        rateData.gst,
        itemGst
      );

      subtotal = TaxReportService.checkedAddMinorUnits('invoice subtotal', subtotal, itemSubtotal);
      totalGst = TaxReportService.checkedAddMinorUnits('invoice GST total', totalGst, itemGst);
    }

    // Add delivery fee (if any)
    if (deliveryFeeCents > 0) {
      const deliveryGstRate = TaxReportService.GST_RATES.RESTAURANT;
      const deliverySplit = TaxService.splitInclusiveTax(deliveryFeeCents, deliveryGstRate);

      lineItems.push({
        description: 'Delivery Charges',
        hsn_sac_code: TaxReportService.HSN_SAC_CODES.FOOD_SERVICE,
        quantity: 1,
        unit_price_cents: deliverySplit.taxable_amount_cents,
        gst_rate: deliveryGstRate,
        gst_amount_cents: deliverySplit.tax_amount_cents,
        total_cents: deliveryFeeCents,
      });

      if (!gstByRate.has(deliveryGstRate)) {
        gstByRate.set(deliveryGstRate, { taxable: 0, gst: 0 });
      }
      const rateData = gstByRate.get(deliveryGstRate)!;
      rateData.taxable = TaxReportService.checkedAddMinorUnits(
        `GST ${deliveryGstRate}% taxable aggregate`,
        rateData.taxable,
        deliverySplit.taxable_amount_cents
      );
      rateData.gst = TaxReportService.checkedAddMinorUnits(
        `GST ${deliveryGstRate}% amount aggregate`,
        rateData.gst,
        deliverySplit.tax_amount_cents
      );

      subtotal = TaxReportService.checkedAddMinorUnits(
        'invoice subtotal',
        subtotal,
        deliverySplit.taxable_amount_cents
      );
      totalGst = TaxReportService.checkedAddMinorUnits(
        'invoice GST total',
        totalGst,
        deliverySplit.tax_amount_cents
      );
    }

    // Build GST breakdown
    const gstBreakdown = Array.from(gstByRate.entries()).map(([rate, data]) => ({
      rate,
      taxable_amount_cents: data.taxable,
      gst_amount_cents: data.gst,
      hsn_sac_code: TaxReportService.HSN_SAC_CODES.FOOD_SERVICE,
    }));

    return {
      lineItems,
      gstBreakdown,
      subtotal,
      totalGst,
      grandTotal: TaxReportService.checkedAddMinorUnits('invoice grand total', subtotal, totalGst),
    };
  }

  private static assertNonNegativeMinorUnits(amountCents: number, fieldName: string): void {
    if (!Number.isFinite(amountCents) || amountCents < 0) {
      throw new Error(`${fieldName} must be a non-negative finite number of cents`);
    }
    if (!Number.isInteger(amountCents)) {
      throw new Error(`${fieldName} must be an integer number of cents`);
    }
    if (!Number.isSafeInteger(amountCents)) {
      throw new Error(`${fieldName} must be a safe integer number of cents`);
    }
  }

  private static assertPositiveIntegerQuantity(quantity: number, itemName?: string): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      const label = itemName ? `quantity for ${itemName}` : 'quantity';
      throw new Error(`${label} must be a positive integer`);
    }
  }

  private static checkedMultiplyMinorUnits(fieldName: string, amountCents: number, multiplier: number): number {
    const total = amountCents * multiplier;
    TaxReportService.assertNonNegativeMinorUnits(total, fieldName);
    return total;
  }

  private static checkedAddMinorUnits(fieldName: string, leftCents: number, rightCents: number): number {
    const total = leftCents + rightCents;
    TaxReportService.assertNonNegativeMinorUnits(total, fieldName);
    return total;
  }

  /**
   * Generate GST report for a period
   */
  async generateGstReport(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    summary: {
      total_orders: number;
      total_sales_cents: number;
      total_gst_collected_cents: number;
      gst_by_rate: Array<{
        rate: number;
        taxable_amount_cents: number;
        gst_amount_cents: number;
      }>;
    };
    invoices: TaxInvoice[];
  }> {
    this.assertTaxReportingEnabled();
    const normalizedBusinessId = TaxReportService.validatedIdentifier('businessId', businessId);
    TaxReportService.assertValidReportPeriod(startDate, endDate);

    // Get all invoices for period
    const invoices = await this.invoiceRepository.find({
      where: {
        business_id: normalizedBusinessId,
        invoice_date: Between(startDate, endDate),
      },
      order: {
        invoice_date: 'ASC',
      },
    });

    // Aggregate data
    let totalSales = 0;
    let totalGst = 0;
    const gstByRateMap = new Map<number, { taxable: number; gst: number }>();
    const seenInvoiceIds = new Set<string>();
    const seenInvoiceNumbers = new Set<string>();
    const seenInvoiceOrderIds = new Set<string>();

    for (const [index, invoice] of invoices.entries()) {
      TaxReportService.assertTaxInvoiceRowObject(`GST report invoice row ${index + 1}`, invoice);
      const invoiceId = TaxReportService.validatedIdentifier('GST report invoice id', invoice.id);
      const invoiceLabel = `invoice ${invoiceId}`;
      TaxReportService.assertInvoiceBelongsToReportPeriod(
        invoice,
        normalizedBusinessId,
        startDate,
        endDate,
        invoiceLabel
      );
      TaxReportService.assertReadableTaxInvoice(invoice, {});
      if (seenInvoiceIds.has(invoiceId)) {
        throw new Error(`${invoiceLabel} id must be unique within GST report`);
      }
      seenInvoiceIds.add(invoiceId);
      const invoiceNumber = TaxReportService.validatedIdentifier(`${invoiceLabel} invoice_number`, invoice.invoice_number);
      if (seenInvoiceNumbers.has(invoiceNumber)) {
        throw new Error(`${invoiceLabel} invoice_number must be unique within GST report`);
      }
      seenInvoiceNumbers.add(invoiceNumber);
      const invoiceOrderId = TaxReportService.validatedIdentifier(`${invoiceLabel} order_id`, invoice.order_id);
      if (seenInvoiceOrderIds.has(invoiceOrderId)) {
        throw new Error(`${invoiceLabel} order_id must be unique within GST report`);
      }
      seenInvoiceOrderIds.add(invoiceOrderId);
      const {
        subtotalCents,
        gstCents,
        gstBreakdownEntries,
      } = TaxReportService.validatedInvoiceMoneyConsistency(invoiceLabel, invoice);

      totalSales = TaxReportService.checkedAddMinorUnits(
        'GST report total sales',
        totalSales,
        subtotalCents
      );
      totalGst = TaxReportService.checkedAddMinorUnits(
        'GST report total collected',
        totalGst,
        gstCents
      );

      // Aggregate by rate
      for (const { rate, taxableAmountCents, breakdownGstCents } of gstBreakdownEntries) {
        if (!gstByRateMap.has(rate)) {
          gstByRateMap.set(rate, { taxable: 0, gst: 0 });
        }
        const rateData = gstByRateMap.get(rate)!;
        rateData.taxable = TaxReportService.checkedAddMinorUnits(
          `GST report ${rate}% taxable aggregate`,
          rateData.taxable,
          taxableAmountCents
        );
        rateData.gst = TaxReportService.checkedAddMinorUnits(
          `GST report ${rate}% amount aggregate`,
          rateData.gst,
          breakdownGstCents
        );
      }
    }

    const gstByRate = Array.from(gstByRateMap.entries()).map(([rate, data]) => ({
      rate,
      taxable_amount_cents: data.taxable,
      gst_amount_cents: data.gst,
    }));

    return {
      summary: {
        total_orders: invoices.length,
        total_sales_cents: totalSales,
        total_gst_collected_cents: totalGst,
        gst_by_rate: gstByRate,
      },
      invoices,
    };
  }

  /**
   * Generate profit analysis report
   */
  async generateProfitAnalysis(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    revenue: {
      gross_sales_cents: number;
      by_month: Array<{ month: string; amount_cents: number }>;
      by_processor: Array<{ processor: string; amount_cents: number }>;
    };
    expenses: {
      total_expenses_cents: number;
      processor_fees_cents: number;
      subscription_fees_cents: number;
      delivery_waivers_cents: number;
      refunds_cents: number;
    };
    profit: {
      net_profit_cents: number;
      profit_margin_percentage: number;
    };
  }> {
    this.assertTaxReportingEnabled();
    const normalizedBusinessId = TaxReportService.validatedIdentifier('businessId', businessId);
    TaxReportService.assertValidReportPeriod(startDate, endDate);

    // Get payments for revenue
    const payments = await this.paymentRepository.find({
      where: {
        business_id: normalizedBusinessId,
        status: 'succeeded',
        created_at: Between(startDate, endDate),
      },
    });

    // Calculate revenue from recorded, validated money fields.
    let grossSales = 0;
    let processorFees = 0;
    let refunds = 0;

    // Revenue by month
    const byMonthMap = new Map<string, number>();
    const byProcessorMap = new Map<string, number>();
    const reportPaymentAmounts = new Map<string, number>();
    const reportPaymentProcessorFees = new Map<string, number>();
    const reportRefundIds = new Set<string>();
    for (const [paymentIndex, payment] of payments.entries()) {
      TaxReportService.assertPersistedProfitReportRowObject(
        `profit payment row ${paymentIndex + 1}`,
        payment
      );
      const paymentId = TaxReportService.validatedProfitReportPaymentId(
        `profit payment row ${paymentIndex + 1} id`,
        payment.id
      );
      const paymentLabel = `payment ${paymentId}`;
      TaxReportService.assertPaymentBelongsToProfitReport(
        payment,
        normalizedBusinessId,
        startDate,
        endDate,
        paymentLabel
      );
      if (reportPaymentAmounts.has(paymentId)) {
        throw new Error(`${paymentLabel} id must be unique within profit analysis`);
      }
      const paymentCreatedAt = TaxReportService.validatedDate(
        `${paymentLabel} created_at`,
        payment.created_at
      );
      let paymentUpdatedAt: Date | undefined;
      if (payment.updated_at !== undefined && payment.updated_at !== null) {
        paymentUpdatedAt = TaxReportService.validatedDate(`${paymentLabel} updated_at`, payment.updated_at);
        if (paymentUpdatedAt.getTime() < paymentCreatedAt.getTime()) {
          throw new Error(`${paymentLabel} updated_at must not be before created_at`);
        }
      }
      const amountCents = TaxReportService.validatedMinorUnits(`${paymentLabel} amount_cents`, payment.amount_cents);
      reportPaymentAmounts.set(paymentId, amountCents);
      const processorFeeCents = TaxReportService.validatedMinorUnits(
        `${paymentLabel} processor_fee_cents`,
        payment.processor_fee_cents
      );
      if (processorFeeCents > amountCents) {
        throw new Error(`${paymentLabel} processor_fee_cents cannot exceed amount_cents`);
      }
      reportPaymentProcessorFees.set(paymentId, processorFeeCents);

      const refundDetails = TaxReportService.validatedRefundDetails(
        `${paymentLabel} refund_details`,
        payment.refund_details
      );
      const refundAmountCents = refundDetails
        ? TaxReportService.validatedMinorUnits(
          `${paymentLabel} refund_amount_cents`,
          refundDetails.refund_amount_cents as number
        )
        : 0;
      if (refundDetails) {
        const refundId = TaxReportService.validatedIdentifier(`${paymentLabel} refund_id`, refundDetails.refund_id);
        if (reportRefundIds.has(refundId)) {
          throw new Error(`${paymentLabel} refund_id must be unique within profit analysis`);
        }
        reportRefundIds.add(refundId);
        const refundedAt = TaxReportService.validatedDateString(`${paymentLabel} refunded_at`, refundDetails.refunded_at);
        const refundedAtTime = Date.parse(refundedAt);
        if (refundAmountCents === 0) {
          throw new Error(`${paymentLabel} refund_amount_cents must be positive when refund_details is present`);
        }
        if (refundedAtTime < paymentCreatedAt.getTime()) {
          throw new Error(`${paymentLabel} refunded_at must not be before created_at`);
        }
        if (paymentUpdatedAt && paymentUpdatedAt.getTime() < refundedAtTime) {
          throw new Error(`${paymentLabel} updated_at must not be before refunded_at`);
        }
        if (refundedAtTime < startDate.getTime() || refundedAtTime > endDate.getTime()) {
          throw new Error(`${paymentLabel} refunded_at must be within the requested report period`);
        }
      }
      if (refundAmountCents > amountCents) {
        throw new Error(`${paymentLabel} refund_amount_cents cannot exceed amount_cents`);
      }

      grossSales = TaxReportService.checkedAddMinorUnits(
        'profit report gross sales',
        grossSales,
        amountCents
      );
      processorFees = TaxReportService.checkedAddMinorUnits(
        'profit report processor fees',
        processorFees,
        processorFeeCents
      );
      refunds = TaxReportService.checkedAddMinorUnits(
        'profit report refunds',
        refunds,
        refundAmountCents
      );

      const month = paymentCreatedAt.toISOString().slice(0, 7); // YYYY-MM
      byMonthMap.set(
        month,
        TaxReportService.checkedAddMinorUnits(
          `profit report ${month} sales`,
          byMonthMap.get(month) || 0,
          amountCents
        )
      );

      const processor = TaxReportService.validatedOptionalLabel(
        `${paymentLabel} processor_type`,
        payment.processor_type,
        'unknown'
      );
      byProcessorMap.set(
        processor,
        TaxReportService.checkedAddMinorUnits(
          `profit report ${processor} processor sales`,
          byProcessorMap.get(processor) || 0,
          amountCents
        )
      );
    }
    const byMonth = Array.from(byMonthMap.entries()).map(([month, amount_cents]) => ({
      month,
      amount_cents,
    }));

    // Revenue by processor
    const byProcessor = Array.from(byProcessorMap.entries()).map(
      ([processor, amount_cents]) => ({
        processor,
        amount_cents,
      })
    );

    // Get payouts for subscription fees
    const payouts = await this.payoutRepository.find({
      where: {
        business_id: normalizedBusinessId,
        status: 'completed',
        created_at: Between(startDate, endDate),
      },
    });

    const reportPayoutIds = new Set<string>();
    const reportPayoutPaymentIds = new Set<string>();
    const subscriptionFees = payouts.reduce(
      (sum, payout, payoutIndex) => {
        TaxReportService.assertPersistedProfitReportRowObject(
          `profit payout row ${payoutIndex + 1}`,
          payout
        );
        const payoutLabel = `payout ${payout.id}`;
        const payoutId = TaxReportService.validatedIdentifier(`${payoutLabel} id`, payout.id);
        if (reportPayoutIds.has(payoutId)) {
          throw new Error(`${payoutLabel} id must be unique within profit analysis`);
        }
        reportPayoutIds.add(payoutId);
        TaxReportService.assertPayoutBelongsToProfitReport(
          payout,
          normalizedBusinessId,
          startDate,
          endDate,
          payoutLabel,
          reportPaymentAmounts,
          reportPaymentProcessorFees,
          reportPayoutPaymentIds
        );

        return TaxReportService.checkedAddMinorUnits(
          'profit report subscription fees',
          sum,
          TaxReportService.validatedMinorUnits(
            `${payoutLabel} subscription_fee_cents`,
            payout.subscription_fee_cents
          )
        );
      },
      0
    );

    // Total expenses
    const totalExpenses = TaxReportService.checkedAddMinorUnits(
      'profit report total expenses',
      TaxReportService.checkedAddMinorUnits(
        'profit report total expenses',
        processorFees,
        subscriptionFees
      ),
      refunds
    );

    // Net profit
    const netProfit = grossSales - totalExpenses;
    const profitMargin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

    return {
      revenue: {
        gross_sales_cents: grossSales,
        by_month: byMonth,
        by_processor: byProcessor,
      },
      expenses: {
        total_expenses_cents: totalExpenses,
        processor_fees_cents: processorFees,
        subscription_fees_cents: subscriptionFees,
        delivery_waivers_cents: 0, // Disabled tax scope: waiver tracking is registered in the capability registry.
        refunds_cents: refunds,
      },
      profit: {
        net_profit_cents: netProfit,
        profit_margin_percentage: Math.round(profitMargin * 100) / 100,
      },
    };
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<TaxInvoice | null> {
    this.assertTaxReportingEnabled();
    const normalizedInvoiceId = TaxReportService.validatedIdentifier('invoiceId', invoiceId);
    const invoice = await this.invoiceRepository.findOne({
      where: { id: normalizedInvoiceId },
      relations: ['business', 'order'],
    });
    if (!invoice) return null;
    TaxReportService.assertReadableTaxInvoice(invoice, { invoiceId: normalizedInvoiceId });
    return invoice;
  }

  /**
   * Get invoice by order ID
   */
  async getInvoiceByOrderId(orderId: string): Promise<TaxInvoice | null> {
    this.assertTaxReportingEnabled();
    const normalizedOrderId = TaxReportService.validatedIdentifier('orderId', orderId);
    const invoice = await this.invoiceRepository.findOne({
      where: { order_id: normalizedOrderId },
      relations: ['business', 'order'],
    });
    if (!invoice) return null;
    TaxReportService.assertReadableTaxInvoice(invoice, { orderId: normalizedOrderId });
    return invoice;
  }

  private assertTaxReportingEnabled(): void {
    if (this.enforceCapability) {
      assertCapabilityEnabled('tax_reporting');
    }
  }

  private static validatedMinorUnits(fieldName: string, amountCents: number): number {
    TaxReportService.assertNonNegativeMinorUnits(amountCents, fieldName);
    return amountCents;
  }

  private static validatedOrderItemDescription(item: unknown, index: number): string {
    const itemLabel = `order item ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`${itemLabel} must be an object`);
    }

    const record = item as {
      dish_name?: unknown;
      dish?: unknown;
    };
    const dishName = TaxReportService.validatedOptionalLabel(
      `${itemLabel} dish_name`,
      record.dish_name,
      ''
    );
    if (dishName) return dishName;

    if (record.dish !== undefined && record.dish !== null) {
      if (typeof record.dish !== 'object' || Array.isArray(record.dish)) {
        throw new Error(`${itemLabel} dish relation must be an object`);
      }

      const relatedDishName = TaxReportService.validatedOptionalLabel(
        `${itemLabel} dish.name`,
        (record.dish as { name?: unknown }).name,
        ''
      );
      if (relatedDishName) return relatedDishName;
    }

    throw new Error(
      `${itemLabel} must include a non-empty dish_name or dish.name before tax invoice generation`
    );
  }

  private static assertValidReportPeriod(startDate: Date, endDate: Date): void {
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
      throw new Error('startDate must be a valid Date');
    }
    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
      throw new Error('endDate must be a valid Date');
    }
    if (startDate.getTime() > endDate.getTime()) {
      throw new Error('startDate must be before or equal to endDate');
    }
    if (endDate.getTime() - startDate.getTime() > TaxReportService.MAX_REPORT_PERIOD_MS) {
      throw new Error(
        `tax report period must be ${TaxReportService.MAX_REPORT_PERIOD_DAYS} days or less`
      );
    }
  }

  private static validatedItemGstRate(itemLabel: string, rate: unknown): number {
    return TaxReportService.validatedGstRate(`${itemLabel} GST rate`, rate);
  }

  private static validatedOrderItemGstRate(itemLabel: string, item: unknown): number {
    const record = item as {
      dish?: unknown;
    };

    if (record.dish === undefined || record.dish === null) {
      return TaxReportService.GST_RATES.RESTAURANT;
    }

    if (typeof record.dish !== 'object' || Array.isArray(record.dish)) {
      throw new Error(`${itemLabel} dish relation must be an object`);
    }

    const metadata = (record.dish as { metadata?: unknown }).metadata;
    if (metadata === undefined || metadata === null) {
      return TaxReportService.GST_RATES.RESTAURANT;
    }

    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new Error(`${itemLabel} dish metadata must be an object`);
    }
    const metadataRecord = metadata as Record<string, unknown>;
    const metadataKeys = Object.keys(metadataRecord);
    TaxReportService.assertTaxFieldNamesAreSafe(`${itemLabel} dish metadata`, metadataKeys);
    const unsupportedKeys = metadataKeys.filter(
      (key) => !TAX_INVOICE_DISH_METADATA_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `${itemLabel} dish metadata include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    return TaxReportService.validatedItemGstRate(
      itemLabel,
      metadataRecord.gst_rate ?? TaxReportService.GST_RATES.RESTAURANT
    );
  }

  private static validatedGstRate(fieldName: string, rate: unknown): number {
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new Error(`${fieldName} must be between 0 and 100`);
    }
    return rate;
  }

  private static validatedPositiveInteger(fieldName: string, value: unknown): number {
    if (!Number.isInteger(value) || (value as number) <= 0) {
      throw new Error(`${fieldName} must be a positive integer`);
    }
    return value as number;
  }

  private static validatedDate(fieldName: string, value: unknown): Date {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} must be a valid Date`);
    }
    return value;
  }

  private static assertInvoiceBelongsToReportPeriod(
    invoice: TaxInvoice,
    businessId: string,
    startDate: Date,
    endDate: Date,
    invoiceLabel: string
  ): void {
    const invoiceBusinessId = TaxReportService.validatedIdentifier(
      `${invoiceLabel} business_id`,
      invoice.business_id
    );
    if (invoiceBusinessId !== businessId) {
      throw new Error(`${invoiceLabel} business_id must match requested business`);
    }

    const invoiceDate = TaxReportService.validatedDate(`${invoiceLabel} invoice_date`, invoice.invoice_date);
    const invoiceTime = invoiceDate.getTime();
    if (invoiceTime < startDate.getTime() || invoiceTime > endDate.getTime()) {
      throw new Error(`${invoiceLabel} invoice_date must be within the requested report period`);
    }
  }

  private static validatedInvoiceMoneyConsistency(
    invoiceLabel: string,
    invoice: TaxInvoice
  ): {
    subtotalCents: number;
    gstCents: number;
    totalCents: number;
    gstBreakdownEntries: Array<{
      rate: number;
      hsnSacCode: string;
      taxableAmountCents: number;
      breakdownGstCents: number;
    }>;
  } {
    const subtotalCents = TaxReportService.validatedMinorUnits(
      `${invoiceLabel} subtotal_cents`,
      invoice.subtotal_cents
    );
    const gstCents = TaxReportService.validatedMinorUnits(
      `${invoiceLabel} total_gst_cents`,
      invoice.total_gst_cents
    );
    const totalCents = TaxReportService.validatedMinorUnits(
      `${invoiceLabel} total_cents`,
      invoice.total_cents
    );
    const expectedInvoiceTotalCents = TaxReportService.checkedAddMinorUnits(
      `${invoiceLabel} subtotal plus GST total`,
      subtotalCents,
      gstCents
    );
    if (totalCents !== expectedInvoiceTotalCents) {
      throw new Error(`${invoiceLabel} total_cents must equal subtotal_cents plus total_gst_cents`);
    }

    if (!Array.isArray(invoice.gst_breakdown)) {
      throw new Error(`${invoiceLabel} gst_breakdown must be an array`);
    }

    let invoiceBreakdownTaxableCents = 0;
    let invoiceBreakdownGstCents = 0;
    const gstBreakdownEntries: Array<{
      rate: number;
      hsnSacCode: string;
      taxableAmountCents: number;
      breakdownGstCents: number;
    }> = [];
    for (const [index, breakdown] of invoice.gst_breakdown.entries()) {
      const breakdownLabel = `${invoiceLabel} gst_breakdown[${index}]`;
      TaxReportService.assertTaxInvoiceNestedEntryEnvelope(
        breakdownLabel,
        breakdown,
        TAX_INVOICE_GST_BREAKDOWN_KEYS
      );
      const rate = TaxReportService.validatedGstRate(`${invoiceLabel} GST rate`, breakdown.rate);
      const hsnSacCode = TaxReportService.validatedIdentifier(
        `${invoiceLabel} GST hsn_sac_code`,
        breakdown.hsn_sac_code
      );
      const taxableAmountCents = TaxReportService.validatedMinorUnits(
        `${invoiceLabel} GST taxable_amount_cents`,
        breakdown.taxable_amount_cents
      );
      const breakdownGstCents = TaxReportService.validatedMinorUnits(
        `${invoiceLabel} GST gst_amount_cents`,
        breakdown.gst_amount_cents
      );

      invoiceBreakdownTaxableCents = TaxReportService.checkedAddMinorUnits(
        `${invoiceLabel} GST taxable breakdown total`,
        invoiceBreakdownTaxableCents,
        taxableAmountCents
      );
      invoiceBreakdownGstCents = TaxReportService.checkedAddMinorUnits(
        `${invoiceLabel} GST amount breakdown total`,
        invoiceBreakdownGstCents,
        breakdownGstCents
      );
      gstBreakdownEntries.push({ rate, hsnSacCode, taxableAmountCents, breakdownGstCents });
    }
    if (invoiceBreakdownTaxableCents !== subtotalCents) {
      throw new Error(`${invoiceLabel} GST taxable breakdown total must equal subtotal_cents`);
    }
    if (invoiceBreakdownGstCents !== gstCents) {
      throw new Error(`${invoiceLabel} GST amount breakdown total must equal total_gst_cents`);
    }

    return { subtotalCents, gstCents, totalCents, gstBreakdownEntries };
  }

  private static financialYearForDate(date: Date): { startYear: number; endYear: number } {
    const validDate = TaxReportService.validatedDate('invoice_date', date);
    const month = validDate.getMonth(); // 0-11
    const year = validDate.getFullYear();
    const startYear = month >= 3 ? year : year - 1;
    return { startYear, endYear: startYear + 1 };
  }

  private static assertInvoiceFinancialYearMatchesDate(
    invoiceLabel: string,
    financialYear: unknown,
    invoiceDate: Date
  ): void {
    const normalizedFinancialYear = TaxReportService.validatedIdentifier(
      `${invoiceLabel} financial_year`,
      financialYear
    );
    const match = normalizedFinancialYear.match(/^(\d{4})-(\d{2}|\d{4})$/);
    if (!match) {
      throw new Error(`${invoiceLabel} financial_year must use YYYY-YY or YYYY-YYYY format`);
    }

    const startYear = Number(match[1]);
    const endYearToken = match[2];
    const { startYear: expectedStartYear, endYear: expectedEndYear } =
      TaxReportService.financialYearForDate(invoiceDate);
    const endYearMatches =
      endYearToken.length === 2
        ? endYearToken === expectedEndYear.toString().slice(2)
        : Number(endYearToken) === expectedEndYear;

    if (startYear !== expectedStartYear || !endYearMatches) {
      throw new Error(`${invoiceLabel} financial_year must match invoice_date`);
    }
  }

  private static validatedOptionalGstin(fieldName: string, value: unknown): string | undefined {
    const normalized = TaxReportService.validatedOptionalLabel(fieldName, value, '');
    if (!normalized) return undefined;
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(normalized)) {
      throw new Error(`${fieldName} must be a valid 15-character GSTIN`);
    }
    return normalized;
  }

  private static assertReadableTaxInvoice(
    invoice: TaxInvoice,
    expected: { invoiceId?: string; orderId?: string; requireRelationEvidence?: boolean }
  ): void {
    TaxReportService.assertTaxInvoiceRowObject('tax invoice', invoice);
    const invoiceId = TaxReportService.validatedIdentifier('tax invoice id', invoice.id);
    const invoiceLabel = `tax invoice ${invoiceId}`;
    TaxReportService.assertTaxInvoiceRowEnvelope(invoiceLabel, invoice);
    if (expected.invoiceId && invoiceId !== expected.invoiceId) {
      throw new Error(`${invoiceLabel} id must match requested invoice`);
    }

    const orderId = TaxReportService.validatedIdentifier(`${invoiceLabel} order_id`, invoice.order_id);
    if (expected.orderId && orderId !== expected.orderId) {
      throw new Error(`${invoiceLabel} order_id must match requested order`);
    }

    const businessId = TaxReportService.validatedIdentifier(`${invoiceLabel} business_id`, invoice.business_id);
    TaxReportService.validatedIdentifier(`${invoiceLabel} invoice_number`, invoice.invoice_number);
    const invoiceDate = TaxReportService.validatedDate(`${invoiceLabel} invoice_date`, invoice.invoice_date);
    let createdAt: Date | undefined;
    if (invoice.created_at !== undefined && invoice.created_at !== null) {
      createdAt = TaxReportService.validatedDate(`${invoiceLabel} created_at`, invoice.created_at);
      if (createdAt < invoiceDate) {
        throw new Error(`${invoiceLabel} created_at cannot be before invoice_date`);
      }
    }
    const updatedAtEvidence = (invoice as { updated_at?: unknown }).updated_at;
    if (updatedAtEvidence !== undefined && updatedAtEvidence !== null) {
      const updatedAt = TaxReportService.validatedDate(`${invoiceLabel} updated_at`, updatedAtEvidence);
      if (updatedAt < invoiceDate) {
        throw new Error(`${invoiceLabel} updated_at cannot be before invoice_date`);
      }
      if (createdAt && updatedAt < createdAt) {
        throw new Error(`${invoiceLabel} updated_at cannot be before created_at`);
      }
    }
    TaxReportService.assertInvoiceFinancialYearMatchesDate(
      invoiceLabel,
      invoice.financial_year,
      invoiceDate
    );
    TaxReportService.validatedIdentifier(`${invoiceLabel} customer_name`, invoice.customer_name);
    TaxReportService.validatedOptionalLabel(`${invoiceLabel} customer_phone`, invoice.customer_phone, '');
    TaxReportService.validatedOptionalLabel(`${invoiceLabel} customer_address`, invoice.customer_address, '');
    TaxReportService.validatedOptionalGstin(`${invoiceLabel} seller_gstin`, invoice.seller_gstin);
    TaxReportService.validatedIdentifier(`${invoiceLabel} seller_business_name`, invoice.seller_business_name);
    TaxReportService.validatedOptionalLabel(`${invoiceLabel} seller_address`, invoice.seller_address, '');
    TaxReportService.validatedIdentifier(`${invoiceLabel} currency`, invoice.currency);
    TaxReportService.validatedOptionalLabel(`${invoiceLabel} payment_method`, invoice.payment_method, '');
    TaxReportService.validatedOptionalBoundedLabel(
      `${invoiceLabel} payment_reference`,
      invoice.payment_reference,
      '',
      MAX_TAX_INVOICE_PAYMENT_REFERENCE_LENGTH
    );
    const pdfUrl = TaxReportService.validatedOptionalBoundedLabel(
      `${invoiceLabel} pdf_url`,
      invoice.pdf_url,
      '',
      MAX_TAX_INVOICE_PDF_URL_LENGTH
    );
    const pdfError = TaxReportService.validatedOptionalBoundedLabel(
      `${invoiceLabel} pdf_error`,
      invoice.pdf_error,
      '',
      MAX_TAX_INVOICE_PDF_ERROR_LENGTH
    );

    const pdfStatus = TaxReportService.validatedOptionalLabel(`${invoiceLabel} pdf_status`, invoice.pdf_status, 'pending')
      .toLowerCase();
    if (!['pending', 'generated', 'failed'].includes(pdfStatus)) {
      throw new Error(`${invoiceLabel} pdf_status must be pending, generated, or failed`);
    }
    if (pdfStatus === 'pending' && pdfUrl) {
      throw new Error(`${invoiceLabel} pdf_url must be empty when pdf_status is pending`);
    }
    if (pdfStatus === 'pending' && pdfError) {
      throw new Error(`${invoiceLabel} pdf_error must be empty when pdf_status is pending`);
    }
    if (pdfStatus === 'generated' && !pdfUrl) {
      throw new Error(`${invoiceLabel} pdf_url is required when pdf_status is generated`);
    }
    if (pdfStatus === 'generated') {
      TaxReportService.validatedHttpsUrl(`${invoiceLabel} pdf_url`, pdfUrl);
    }
    if (pdfStatus === 'generated' && pdfError) {
      throw new Error(`${invoiceLabel} pdf_error must be empty when pdf_status is generated`);
    }
    if (pdfStatus === 'failed' && !pdfError) {
      throw new Error(`${invoiceLabel} pdf_error is required when pdf_status is failed`);
    }
    if (pdfStatus === 'failed' && pdfUrl) {
      throw new Error(`${invoiceLabel} pdf_url must be empty when pdf_status is failed`);
    }

    TaxReportService.assertReadableTaxInvoiceMetadata(invoiceLabel, invoice.metadata);

    const { subtotalCents, gstCents, totalCents, gstBreakdownEntries } =
      TaxReportService.validatedInvoiceMoneyConsistency(invoiceLabel, invoice);
    TaxReportService.assertInvoiceLineItemsConsistency(
      invoiceLabel,
      invoice,
      subtotalCents,
      gstCents,
      totalCents,
      gstBreakdownEntries
    );
    TaxReportService.assertReadableTaxInvoiceRelations(
      invoiceLabel,
      invoice,
      orderId,
      businessId,
      expected.requireRelationEvidence === true
    );
  }

  private static assertTaxInvoiceRowObject(invoiceLabel: string, invoice: TaxInvoice): void {
    if (!invoice || typeof invoice !== 'object' || Array.isArray(invoice)) {
      throw new Error(`${invoiceLabel} must be an object`);
    }
  }

  private static assertTaxInvoiceRowEnvelope(invoiceLabel: string, invoice: TaxInvoice): void {
    TaxReportService.assertTaxInvoiceRowObject(invoiceLabel, invoice);
    const invoiceRecord = invoice as unknown as Record<string, unknown>;
    const invoiceKeys = Object.keys(invoiceRecord);
    TaxReportService.assertTaxFieldNamesAreSafe(invoiceLabel, invoiceKeys);
    const unsupportedKeys = invoiceKeys.filter(
      (key) => !TAX_INVOICE_ROW_KEYS.has(key) && invoiceRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${invoiceLabel} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
  }

  private static assertReadableTaxInvoiceMetadata(
    invoiceLabel: string,
    metadata: unknown
  ): void {
    const metadataRecord = TaxReportService.validatedOptionalPlainObject(
      `${invoiceLabel} metadata`,
      metadata
    );
    if (!metadataRecord) return;

    const metadataKeys = Object.keys(metadataRecord);
    TaxReportService.assertTaxFieldNamesAreSafe(`${invoiceLabel} metadata`, metadataKeys);
    const unsupportedKeys = metadataKeys.filter(
      (key) => !TAX_INVOICE_METADATA_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `${invoiceLabel} metadata include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    TaxReportService.validatedOptionalSettingString(
      `${invoiceLabel} metadata.terms_and_conditions`,
      metadataRecord.terms_and_conditions
    );
    const bankDetails = TaxReportService.validatedOptionalBankDetails(
      `${invoiceLabel} metadata.bank_details`,
      metadataRecord.bank_details
    );
    if (
      Object.prototype.hasOwnProperty.call(metadataRecord, 'bank_details') &&
      bankDetails === undefined
    ) {
      throw new Error(`${invoiceLabel} metadata.bank_details must include at least one populated detail`);
    }
  }

  private static assertReadableTaxInvoiceRelations(
    invoiceLabel: string,
    invoice: TaxInvoice,
    orderId: string,
    businessId: string,
    requireRelationEvidence = false
  ): void {
    const relatedOrder = (invoice as TaxInvoice & {
      order?: { id?: unknown; business_id?: unknown };
    }).order;
    if (requireRelationEvidence && (relatedOrder === undefined || relatedOrder === null)) {
      throw new Error(`${invoiceLabel} order relation is required before invoice reuse`);
    }
    if (relatedOrder !== undefined && relatedOrder !== null) {
      const relatedOrderId = TaxReportService.validatedIdentifier(
        `${invoiceLabel} order relation id`,
        relatedOrder.id
      );
      if (relatedOrderId !== orderId) {
        throw new Error(`${invoiceLabel} order relation id must match invoice order_id`);
      }

      const relatedOrderBusinessId = TaxReportService.validatedIdentifier(
        `${invoiceLabel} order relation business_id`,
        relatedOrder.business_id
      );
      if (relatedOrderBusinessId !== businessId) {
        throw new Error(`${invoiceLabel} order relation business_id must match invoice business_id`);
      }
    }

    const relatedBusiness = (invoice as TaxInvoice & { business?: { id?: unknown } }).business;
    if (requireRelationEvidence && (relatedBusiness === undefined || relatedBusiness === null)) {
      throw new Error(`${invoiceLabel} business relation is required before invoice reuse`);
    }
    if (relatedBusiness !== undefined && relatedBusiness !== null) {
      const relatedBusinessId = TaxReportService.validatedIdentifier(
        `${invoiceLabel} business relation id`,
        relatedBusiness.id
      );
      if (relatedBusinessId !== businessId) {
        throw new Error(`${invoiceLabel} business relation id must match invoice business_id`);
      }
    }
  }

  private static assertInvoiceLineItemsConsistency(
    invoiceLabel: string,
    invoice: TaxInvoice,
    subtotalCents: number,
    gstCents: number,
    totalCents: number,
    gstBreakdownEntries: Array<{
      rate: number;
      hsnSacCode: string;
      taxableAmountCents: number;
      breakdownGstCents: number;
    }>
  ): void {
	    if (!Array.isArray(invoice.line_items)) {
	      throw new Error(`${invoiceLabel} line_items must be an array`);
	    }
	    if (invoice.line_items.length === 0) {
	      throw new Error(`${invoiceLabel} line_items must include at least one item`);
	    }

	    let taxableTotalCents = 0;
    let gstTotalCents = 0;
    let grandTotalCents = 0;
    const lineItemGstAggregates = new Map<string, { taxable: number; gst: number }>();
    for (const [index, lineItem] of invoice.line_items.entries()) {
      const itemLabel = `${invoiceLabel} line_items[${index}]`;
      TaxReportService.assertTaxInvoiceNestedEntryEnvelope(
        itemLabel,
        lineItem,
        TAX_INVOICE_LINE_ITEM_KEYS
      );
      TaxReportService.validatedIdentifier(`${itemLabel} description`, lineItem.description);
      const hsnSacCode = TaxReportService.validatedIdentifier(`${itemLabel} hsn_sac_code`, lineItem.hsn_sac_code);
      const quantity = TaxReportService.validatedPositiveInteger(`${itemLabel} quantity`, lineItem.quantity);
      const unitPriceCents = TaxReportService.validatedMinorUnits(
        `${itemLabel} unit_price_cents`,
        lineItem.unit_price_cents
      );
      const gstRate = TaxReportService.validatedGstRate(`${itemLabel} GST rate`, lineItem.gst_rate);
      const lineGstCents = TaxReportService.validatedMinorUnits(
        `${itemLabel} gst_amount_cents`,
        lineItem.gst_amount_cents
      );
      const lineTotalCents = TaxReportService.validatedMinorUnits(
        `${itemLabel} total_cents`,
        lineItem.total_cents
      );
      const lineTaxableCents = TaxReportService.checkedMultiplyMinorUnits(
        `${itemLabel} taxable total`,
        unitPriceCents,
        quantity
      );
      const expectedLineTotalCents = TaxReportService.checkedAddMinorUnits(
        `${itemLabel} taxable plus GST total`,
        lineTaxableCents,
        lineGstCents
      );
      if (lineTotalCents !== expectedLineTotalCents) {
        throw new Error(`${itemLabel} total_cents must equal unit_price_cents times quantity plus gst_amount_cents`);
      }

      taxableTotalCents = TaxReportService.checkedAddMinorUnits(
        `${invoiceLabel} line item taxable total`,
        taxableTotalCents,
        lineTaxableCents
      );
      gstTotalCents = TaxReportService.checkedAddMinorUnits(
        `${invoiceLabel} line item GST total`,
        gstTotalCents,
        lineGstCents
      );
      grandTotalCents = TaxReportService.checkedAddMinorUnits(
        `${invoiceLabel} line item grand total`,
        grandTotalCents,
        lineTotalCents
      );

      const aggregateKey = TaxReportService.gstAggregateKey(gstRate, hsnSacCode);
      const aggregate = lineItemGstAggregates.get(aggregateKey) ?? { taxable: 0, gst: 0 };
      lineItemGstAggregates.set(aggregateKey, {
        taxable: TaxReportService.checkedAddMinorUnits(
          `${invoiceLabel} line item ${gstRate}%/${hsnSacCode} taxable aggregate`,
          aggregate.taxable,
          lineTaxableCents
        ),
        gst: TaxReportService.checkedAddMinorUnits(
          `${invoiceLabel} line item ${gstRate}%/${hsnSacCode} GST aggregate`,
          aggregate.gst,
          lineGstCents
        ),
      });
    }

    if (taxableTotalCents !== subtotalCents) {
      throw new Error(`${invoiceLabel} line item taxable total must equal subtotal_cents`);
    }
    if (gstTotalCents !== gstCents) {
      throw new Error(`${invoiceLabel} line item GST total must equal total_gst_cents`);
    }
    if (grandTotalCents !== totalCents) {
      throw new Error(`${invoiceLabel} line item grand total must equal total_cents`);
    }

    const breakdownGstAggregates = new Map<string, { taxable: number; gst: number }>();
    for (const entry of gstBreakdownEntries) {
      const aggregateKey = TaxReportService.gstAggregateKey(entry.rate, entry.hsnSacCode);
      const aggregate = breakdownGstAggregates.get(aggregateKey) ?? { taxable: 0, gst: 0 };
      breakdownGstAggregates.set(aggregateKey, {
        taxable: TaxReportService.checkedAddMinorUnits(
          `${invoiceLabel} GST breakdown ${entry.rate}%/${entry.hsnSacCode} taxable aggregate`,
          aggregate.taxable,
          entry.taxableAmountCents
        ),
        gst: TaxReportService.checkedAddMinorUnits(
          `${invoiceLabel} GST breakdown ${entry.rate}%/${entry.hsnSacCode} GST aggregate`,
          aggregate.gst,
          entry.breakdownGstCents
        ),
      });
    }

    TaxReportService.assertGstAggregatesMatch(invoiceLabel, lineItemGstAggregates, breakdownGstAggregates);
  }

  private static gstAggregateKey(rate: number, hsnSacCode: string): string {
    return `${rate}::${hsnSacCode}`;
  }

  private static assertGstAggregatesMatch(
    invoiceLabel: string,
    lineItemGstAggregates: Map<string, { taxable: number; gst: number }>,
    breakdownGstAggregates: Map<string, { taxable: number; gst: number }>
  ): void {
    for (const [key, lineAggregate] of lineItemGstAggregates.entries()) {
      const breakdownAggregate = breakdownGstAggregates.get(key);
      if (
        !breakdownAggregate ||
        breakdownAggregate.taxable !== lineAggregate.taxable ||
        breakdownAggregate.gst !== lineAggregate.gst
      ) {
        const [rate, hsnSacCode] = key.split('::');
        throw new Error(
          `${invoiceLabel} GST breakdown ${rate}%/${hsnSacCode} must match line item aggregate`
        );
      }
    }

    for (const key of breakdownGstAggregates.keys()) {
      if (!lineItemGstAggregates.has(key)) {
        const [rate, hsnSacCode] = key.split('::');
        throw new Error(
          `${invoiceLabel} GST breakdown ${rate}%/${hsnSacCode} must match line item aggregate`
        );
      }
    }
  }

  private static assertTaxInvoiceNestedEntryEnvelope(
    entryLabel: string,
    entry: unknown,
    allowedKeys: Set<string>
  ): asserts entry is Record<string, unknown> {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`${entryLabel} must be an object`);
    }
    const entryRecord = entry as Record<string, unknown>;
    const entryKeys = Object.keys(entryRecord);
    TaxReportService.assertTaxFieldNamesAreSafe(entryLabel, entryKeys);
    const unsupportedKeys = entryKeys.filter(
      (key) => !allowedKeys.has(key) && entryRecord[key] !== undefined
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${entryLabel} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
  }

  private static assertPaymentBelongsToProfitReport(
    payment: Payment,
    businessId: string,
    startDate: Date,
    endDate: Date,
    paymentLabel: string
  ): void {
    const paymentBusinessId = TaxReportService.validatedIdentifier(
      `${paymentLabel} business_id`,
      payment.business_id
    );
    if (paymentBusinessId !== businessId) {
      throw new Error(`${paymentLabel} business_id must match requested business`);
    }

    const status = TaxReportService.validatedOptionalLabel(`${paymentLabel} status`, payment.status, '');
    if (status.toLowerCase() !== 'succeeded') {
      throw new Error(`${paymentLabel} status must be succeeded`);
    }

    const paymentDate = TaxReportService.validatedDate(`${paymentLabel} created_at`, payment.created_at);
    const paymentTime = paymentDate.getTime();
    if (paymentTime < startDate.getTime() || paymentTime > endDate.getTime()) {
      throw new Error(`${paymentLabel} created_at must be within the requested report period`);
    }
  }

  private static assertPersistedProfitReportRowObject(label: string, row: unknown): void {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error(`${label} must be an object`);
    }
  }

  private static assertPayoutBelongsToProfitReport(
    payout: Payout,
    businessId: string,
    startDate: Date,
    endDate: Date,
    payoutLabel: string,
    reportPaymentAmounts: Map<string, number>,
    reportPaymentProcessorFees: Map<string, number>,
    reportPayoutPaymentIds: Set<string>
  ): void {
    const payoutBusinessId = TaxReportService.validatedIdentifier(
      `${payoutLabel} business_id`,
      payout.business_id
    );
    if (payoutBusinessId !== businessId) {
      throw new Error(`${payoutLabel} business_id must match requested business`);
    }

    const status = TaxReportService.validatedPayoutStatus(
      `${payoutLabel} status`,
      payout.status
    );
    if (status !== 'completed') {
      throw new Error(`${payoutLabel} status must be completed`);
    }

    const payoutDate = TaxReportService.validatedDate(`${payoutLabel} created_at`, payout.created_at);
    const payoutTime = payoutDate.getTime();
    if (payoutTime < startDate.getTime() || payoutTime > endDate.getTime()) {
      throw new Error(`${payoutLabel} created_at must be within the requested report period`);
    }

    const completedAt = TaxReportService.validatedDate(`${payoutLabel} completed_at`, payout.completed_at);
    if (completedAt.getTime() < payoutDate.getTime()) {
      throw new Error(`${payoutLabel} completed_at must not be before created_at`);
    }
    const completedTime = completedAt.getTime();
    if (completedTime < startDate.getTime() || completedTime > endDate.getTime()) {
      throw new Error(`${payoutLabel} completed_at must be within the requested report period`);
    }
    if (payout.updated_at !== undefined && payout.updated_at !== null) {
      const updatedAt = TaxReportService.validatedDate(`${payoutLabel} updated_at`, payout.updated_at);
      if (updatedAt.getTime() < completedTime) {
        throw new Error(`${payoutLabel} updated_at must not be before completed_at`);
      }
    }
    const periodStart = TaxReportService.validatedDate(`${payoutLabel} period_start`, payout.period_start);
    const periodEnd = TaxReportService.validatedDate(`${payoutLabel} period_end`, payout.period_end);
    if (periodStart.getTime() > periodEnd.getTime()) {
      throw new Error(`${payoutLabel} period_start must not be after period_end`);
    }
    if (periodStart.getTime() < startDate.getTime() || periodStart.getTime() > endDate.getTime()) {
      throw new Error(`${payoutLabel} period_start must be within the requested report period`);
    }
    if (periodEnd.getTime() < startDate.getTime() || periodEnd.getTime() > endDate.getTime()) {
      throw new Error(`${payoutLabel} period_end must be within the requested report period`);
    }
    if (periodEnd.getTime() > completedTime) {
      throw new Error(`${payoutLabel} period_end must not be after completed_at`);
    }
    if (payout.failure_reason !== undefined && payout.failure_reason !== null) {
      throw new Error(`${payoutLabel} failure_reason cannot be present when status is completed`);
    }
    if (payout.failed_at !== undefined && payout.failed_at !== null) {
      throw new Error(`${payoutLabel} failed_at cannot be present when status is completed`);
    }

    const grossAmountCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} gross_amount_cents`,
      payout.gross_amount_cents
    );
    const processorFeeCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} processor_fee_cents`,
      payout.processor_fee_cents
    );
    TaxReportService.assertPayoutPaymentEvidence(
      payout,
      payoutLabel,
      grossAmountCents,
      processorFeeCents,
      reportPaymentAmounts,
      reportPaymentProcessorFees,
      reportPayoutPaymentIds
    );
    const subscriptionFeeCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} subscription_fee_cents`,
      payout.subscription_fee_cents
    );
    const platformFeeCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} platform_fee_cents`,
      payout.platform_fee_cents
    );
    const volumeDiscountCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} volume_discount_cents`,
      payout.volume_discount_cents
    );
    if (volumeDiscountCents > grossAmountCents) {
      throw new Error(`${payoutLabel} volume_discount_cents cannot exceed gross_amount_cents`);
    }
    const netAmountCents = TaxReportService.validatedMinorUnits(
      `${payoutLabel} net_amount_cents`,
      payout.net_amount_cents
    );
    const totalDeductionsCents = TaxReportService.checkedAddMinorUnits(
      `${payoutLabel} payout deductions`,
      TaxReportService.checkedAddMinorUnits(
        `${payoutLabel} processor plus subscription fees`,
        processorFeeCents,
        subscriptionFeeCents
      ),
      platformFeeCents
    );
    const grossPlusDiscountCents = TaxReportService.checkedAddMinorUnits(
      `${payoutLabel} gross plus volume discount`,
      grossAmountCents,
      volumeDiscountCents
    );
    if (netAmountCents !== grossPlusDiscountCents - totalDeductionsCents) {
      throw new Error(
        `${payoutLabel} net_amount_cents must equal gross_amount_cents minus fees plus volume_discount_cents`
      );
    }
  }

  private static assertPayoutPaymentEvidence(
    payout: Payout,
    payoutLabel: string,
    grossAmountCents: number,
    processorFeeCents: number,
    reportPaymentAmounts: Map<string, number>,
    reportPaymentProcessorFees: Map<string, number>,
    reportPayoutPaymentIds: Set<string>
  ): void {
    const paymentCount = TaxReportService.validatedNonNegativeSafeInteger(
      `${payoutLabel} payment_count`,
      payout.payment_count
    );
    if (grossAmountCents > 0 && paymentCount === 0) {
      throw new Error(`${payoutLabel} payment_count must be positive when gross_amount_cents is positive`);
    }
    if (grossAmountCents === 0 && paymentCount > 0) {
      throw new Error(`${payoutLabel} payment_count cannot be positive when gross_amount_cents is zero`);
    }

    const payoutMetadata = TaxReportService.validatedOptionalPlainObject(
      `${payoutLabel} metadata`,
      payout.metadata
    );
    if (payoutMetadata) {
      const metadataKeys = Object.keys(payoutMetadata);
      TaxReportService.assertTaxFieldNamesAreSafe(`${payoutLabel} metadata`, metadataKeys);
      const unsupportedKeys = metadataKeys.filter(
        (key) => !TAX_REPORT_PAYOUT_METADATA_KEYS.has(key)
      );
      if (unsupportedKeys.length > 0) {
        throw new Error(`${payoutLabel} metadata include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
      }
    }
    if (
      paymentCount > 0 &&
      (!payoutMetadata || !Object.prototype.hasOwnProperty.call(payoutMetadata, 'payment_ids'))
    ) {
      throw new Error(`${payoutLabel} metadata.payment_ids is required when payment_count is positive`);
    }
    if (!payoutMetadata || !Object.prototype.hasOwnProperty.call(payoutMetadata, 'payment_ids')) {
      return;
    }
    if (!Array.isArray(payoutMetadata.payment_ids)) {
      throw new Error(`${payoutLabel} metadata.payment_ids must be an array`);
    }

    const paymentIds = payoutMetadata.payment_ids.map((paymentId, index) =>
      TaxReportService.validatedProfitReportPaymentId(
        `${payoutLabel} metadata.payment_ids[${index}]`,
        paymentId
      )
    );
    if (new Set(paymentIds).size !== paymentIds.length) {
      throw new Error(`${payoutLabel} metadata.payment_ids must not contain duplicates`);
    }
    if (paymentIds.length !== paymentCount) {
      throw new Error(`${payoutLabel} metadata.payment_ids length must equal payment_count`);
    }
    let referencedGrossAmountCents = 0;
    let referencedProcessorFeeCents = 0;
    for (const paymentId of paymentIds) {
      if (reportPayoutPaymentIds.has(paymentId)) {
        throw new Error(`${payoutLabel} metadata.payment_ids must not reuse payment ids across payout rows`);
      }
      const referencedAmountCents = reportPaymentAmounts.get(paymentId);
      const referencedProcessorFee = reportPaymentProcessorFees.get(paymentId);
      if (referencedAmountCents === undefined || referencedProcessorFee === undefined) {
        throw new Error(`${payoutLabel} metadata.payment_ids must reference requested payment rows`);
      }
      referencedGrossAmountCents = TaxReportService.checkedAddMinorUnits(
        `${payoutLabel} referenced payment gross_amount_cents`,
        referencedGrossAmountCents,
        referencedAmountCents
      );
      referencedProcessorFeeCents = TaxReportService.checkedAddMinorUnits(
        `${payoutLabel} referenced payment processor_fee_cents`,
        referencedProcessorFeeCents,
        referencedProcessorFee
      );
    }
    if (referencedGrossAmountCents !== grossAmountCents) {
      throw new Error(
        `${payoutLabel} gross_amount_cents must equal referenced metadata.payment_ids total`
      );
    }
    if (referencedProcessorFeeCents !== processorFeeCents) {
      throw new Error(
        `${payoutLabel} processor_fee_cents must equal referenced metadata.payment_ids processor fees total`
      );
    }
    paymentIds.forEach((paymentId) => reportPayoutPaymentIds.add(paymentId));
  }

  private static validatedPayoutStatus(fieldName: string, value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    const normalized = value.trim().toLowerCase();
    if (!['pending', 'processing', 'completed', 'failed', 'held', 'cancelled'].includes(normalized)) {
      throw new Error(`${fieldName} must be a valid payout status`);
    }
    return normalized;
  }

  private static validatedNonNegativeSafeInteger(fieldName: string, value: unknown): number {
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw new Error(`${fieldName} must be a non-negative integer`);
    }
    if (!Number.isSafeInteger(value)) {
      throw new Error(`${fieldName} must be a safe integer`);
    }
    return value as number;
  }

  private static validatedRefundDetails(
    fieldName: string,
    value: unknown
  ): { refund_amount_cents: unknown; refund_id: unknown; refunded_at: unknown } | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${fieldName} must be an object`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'refund_amount_cents')) {
      throw new Error(`${fieldName} refund_amount_cents is required when refund_details is present`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'refund_id')) {
      throw new Error(`${fieldName} refund_id is required when refund_details is present`);
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'refunded_at')) {
      throw new Error(`${fieldName} refunded_at is required when refund_details is present`);
    }
    const refundDetails = value as Record<string, unknown>;
    const refundDetailKeys = Object.keys(refundDetails);
    TaxReportService.assertTaxFieldNamesAreSafe(fieldName, refundDetailKeys);
    const unsupportedKeys = refundDetailKeys.filter(
      (key) => !TAX_REPORT_REFUND_DETAILS_KEYS.has(key)
    );
    if (unsupportedKeys.length > 0) {
      throw new Error(`${fieldName} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`);
    }
    return value as { refund_amount_cents: unknown; refund_id: unknown; refunded_at: unknown };
  }

  private static validatedIdentifier(fieldName: string, value: unknown): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`${fieldName} must be a non-empty string`);
    }
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    const normalized = value.trim();
    return normalized;
  }

  private static validatedProfitReportPaymentId(fieldName: string, value: unknown): string {
    const normalized = TaxReportService.validatedIdentifier(fieldName, value);
    if (normalized.length > MAX_TAX_REPORT_LINKED_PAYMENT_ID_LENGTH) {
      throw new Error(`${fieldName} must be at most ${MAX_TAX_REPORT_LINKED_PAYMENT_ID_LENGTH} characters`);
    }
    return normalized;
  }

  private static assertNoUnsafeTaxTextControls(fieldName: string, value: unknown): void {
    if (typeof value === 'string') {
      if (TaxReportService.hasUnsafeTaxTextControls(value)) {
        throw new Error(`${fieldName} must not include unsafe control characters`);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry, index) =>
        TaxReportService.assertNoUnsafeTaxTextControls(`${fieldName}[${index}]`, entry)
      );
      return;
    }

    if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        TaxReportService.assertNoUnsafeTaxTextControls(`${fieldName}.${key}`, entry);
      }
    }
  }

  private static hasUnsafeTaxTextControls(value: string): boolean {
    return UNSAFE_TAX_TEXT_CONTROLS.test(value);
  }

  private static assertTaxFieldNamesAreSafe(fieldName: string, fieldNames: string[]): void {
    if (fieldNames.some((field) => TaxReportService.hasUnsafeTaxTextControls(field))) {
      throw new Error(`${fieldName} field names must not include unsafe control characters`);
    }
  }

  private static validatedDateString(fieldName: string, value: unknown): string {
    const normalized = TaxReportService.validatedIdentifier(fieldName, value);
    if (Number.isNaN(Date.parse(normalized))) {
      throw new Error(`${fieldName} must be a valid date string`);
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(normalized)) {
      throw new Error(`${fieldName} must be an ISO-8601 UTC date string`);
    }
    if (new Date(normalized).toISOString() !== normalized) {
      throw new Error(`${fieldName} must be an ISO-8601 UTC date string`);
    }
    return normalized;
  }

  private static validatedOptionalLabel(
    fieldName: string,
    value: unknown,
    fallback: string
  ): string {
    if (value === undefined || value === null) return fallback;
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    const normalized = value.trim();
    return normalized || fallback;
  }

  private static validatedOptionalBoundedLabel(
    fieldName: string,
    value: unknown,
    fallback: string,
    maxLength: number
  ): string {
    const normalized = TaxReportService.validatedOptionalLabel(fieldName, value, fallback);
    if (normalized.length > maxLength) {
      throw new Error(`${fieldName} must be at most ${maxLength} characters`);
    }
    return normalized;
  }

  private static validatedHttpsUrl(fieldName: string, value: string): string {
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(value);
    } catch {
      throw new Error(`${fieldName} must be an absolute HTTPS URL`);
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new Error(`${fieldName} must be an absolute HTTPS URL`);
    }
    if (parsedUrl.username || parsedUrl.password) {
      throw new Error(`${fieldName} must not include embedded credentials`);
    }
    return parsedUrl.toString();
  }

  private static validatedOptionalSettingString(
    fieldName: string,
    value: unknown
  ): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    const normalized = value.trim();
    return normalized || undefined;
  }

  private static validatedOptionalPlainObject(
    fieldName: string,
    value: unknown
  ): Record<string, unknown> | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${fieldName} must be an object`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${fieldName} must be an object`);
    }
    TaxReportService.assertNoUnsafeTaxTextControls(fieldName, value);
    return value as Record<string, unknown>;
  }

  private static validatedOptionalBankDetails(
    fieldName: string,
    value: unknown
  ): TaxInvoiceBankDetails | undefined {
    const details = TaxReportService.validatedOptionalPlainObject(fieldName, value);
    if (!details) return undefined;

    const allowedKeys = new Set(['account_name', 'account_number', 'ifsc_code', 'bank_name']);
    const detailKeys = Object.keys(details);
    TaxReportService.assertTaxFieldNamesAreSafe(fieldName, detailKeys);
    const unsupportedKeys = detailKeys.filter((key) => !allowedKeys.has(key));
    if (unsupportedKeys.length > 0) {
      throw new Error(
        `${fieldName} include unsupported field(s): ${unsupportedKeys.sort().join(', ')}`
      );
    }

    const normalized: TaxInvoiceBankDetails = {};
    for (const key of allowedKeys) {
      const detailValue = details[key];
      if (detailValue === undefined || detailValue === null) continue;
      if (typeof detailValue !== 'string') {
        throw new Error(`${fieldName}.${key} must be a string`);
      }
      TaxReportService.assertNoUnsafeTaxTextControls(`${fieldName}.${key}`, detailValue);
      const normalizedValue = detailValue.trim();
      if (normalizedValue) {
        normalized[key as keyof NonNullable<TaxInvoiceBankDetails>] = normalizedValue;
      }
    }

    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }
}
