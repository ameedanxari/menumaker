import { Repository, Between } from 'typeorm';
import { AppDataSource } from '../config/database.js';
import { TaxInvoice } from '../models/TaxInvoice.js';
import { Order } from '../models/Order.js';
import { Payment } from '../models/Payment.js';
import { Payout } from '../models/Payout.js';
import { BusinessSettings } from '../models/BusinessSettings.js';

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
  private invoiceRepository: Repository<TaxInvoice>;
  private orderRepository: Repository<Order>;
  private paymentRepository: Repository<Payment>;
  private payoutRepository: Repository<Payout>;
  private settingsRepository: Repository<BusinessSettings>;

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

  constructor() {
    this.invoiceRepository = AppDataSource.getRepository(TaxInvoice);
    this.orderRepository = AppDataSource.getRepository(Order);
    this.paymentRepository = AppDataSource.getRepository(Payment);
    this.payoutRepository = AppDataSource.getRepository(Payout);
    this.settingsRepository = AppDataSource.getRepository(BusinessSettings);
  }

  /**
   * Generate tax invoice for an order
   */
  async generateTaxInvoice(orderId: string): Promise<TaxInvoice> {
    // Check if invoice already exists
    const existing = await this.invoiceRepository.findOne({
      where: { order_id: orderId },
    });

    if (existing) {
      return existing;
    }

    // Get order with items
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['business', 'items', 'items.dish'],
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Get business settings
    const settings = await this.settingsRepository.findOne({
      where: { business_id: order.business_id },
    });

    if (!settings) {
      throw new Error('Business settings not found');
    }

    // Generate invoice number
    const invoiceNumber = this.generateInvoiceNumber(settings);
    const financialYear = this.getFinancialYear(new Date());

    // Calculate GST breakdown
    const { lineItems, gstBreakdown, subtotal, totalGst, grandTotal } =
      this.calculateGstBreakdown(order);

    // Create invoice
    const invoice = this.invoiceRepository.create({
      order_id: orderId,
      business_id: order.business_id,
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
      financial_year: financialYear,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_address: order.delivery_address || undefined,
      seller_gstin: settings.gstin || undefined,
      seller_business_name: settings.legal_business_name || order.business.name,
      seller_address: settings.business_address || undefined,
      subtotal_cents: subtotal,
      gst_breakdown: gstBreakdown,
      total_gst_cents: totalGst,
      total_cents: grandTotal,
      line_items: lineItems,
      payment_method: order.payment_method,
      metadata: {
        terms_and_conditions: settings.invoice_terms,
        bank_details: settings.bank_details,
      },
    });

    await this.invoiceRepository.save(invoice);

    // Increment invoice number
    settings.next_invoice_number++;
    await this.settingsRepository.save(settings);

    return invoice;
  }

  /**
   * Generate invoice number
   */
  private generateInvoiceNumber(settings: BusinessSettings): string {
    const prefix = settings.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const number = settings.next_invoice_number.toString().padStart(4, '0');
    return `${prefix}-${year}-${number}`;
  }

  /**
   * Get financial year (Apr-Mar in India)
   */
  private getFinancialYear(date: Date): string {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();

    if (month >= 3) {
      // Apr-Dec
      return `${year}-${(year + 1).toString().slice(2)}`;
    } else {
      // Jan-Mar
      return `${year - 1}-${year.toString().slice(2)}`;
    }
  }

  /**
   * Calculate GST breakdown for order
   */
  private calculateGstBreakdown(order: Order): {
    lineItems: any[];
    gstBreakdown: any[];
    subtotal: number;
    totalGst: number;
    grandTotal: number;
  } {
    const lineItems: any[] = [];
    const gstByRate = new Map<number, { taxable: number; gst: number }>();

    let subtotal = 0;
    let totalGst = 0;

    // Process order items
    for (const item of order.items || []) {
      // Determine GST rate (default 5% for food)
      const gstRate = item.dish?.metadata?.gst_rate || TaxReportService.GST_RATES.RESTAURANT;
      const hsnCode = TaxReportService.HSN_SAC_CODES.FOOD_SERVICE;

      // Calculate amounts
      const unitPriceWithGst = item.price_cents;
      const unitPrice = Math.round((unitPriceWithGst * 100) / (100 + gstRate));
      const gstPerUnit = unitPriceWithGst - unitPrice;

      const itemSubtotal = unitPrice * item.quantity;
      const itemGst = gstPerUnit * item.quantity;
      const itemTotal = unitPriceWithGst * item.quantity;

      lineItems.push({
        description: item.dish_name,
        hsn_sac_code: hsnCode,
        quantity: item.quantity,
        unit_price_cents: unitPrice,
        gst_rate: gstRate,
        gst_amount_cents: itemGst,
        total_cents: itemTotal,
      });

      // Aggregate by GST rate
      if (!gstByRate.has(gstRate)) {
        gstByRate.set(gstRate, { taxable: 0, gst: 0 });
      }
      const rateData = gstByRate.get(gstRate)!;
      rateData.taxable += itemSubtotal;
      rateData.gst += itemGst;

      subtotal += itemSubtotal;
      totalGst += itemGst;
    }

    // Add delivery fee (if any)
    if (order.delivery_fee_cents > 0) {
      const deliveryGstRate = TaxReportService.GST_RATES.RESTAURANT;
      const deliveryPrice = Math.round(
        (order.delivery_fee_cents * 100) / (100 + deliveryGstRate)
      );
      const deliveryGst = order.delivery_fee_cents - deliveryPrice;

      lineItems.push({
        description: 'Delivery Charges',
        hsn_sac_code: TaxReportService.HSN_SAC_CODES.FOOD_SERVICE,
        quantity: 1,
        unit_price_cents: deliveryPrice,
        gst_rate: deliveryGstRate,
        gst_amount_cents: deliveryGst,
        total_cents: order.delivery_fee_cents,
      });

      if (!gstByRate.has(deliveryGstRate)) {
        gstByRate.set(deliveryGstRate, { taxable: 0, gst: 0 });
      }
      const rateData = gstByRate.get(deliveryGstRate)!;
      rateData.taxable += deliveryPrice;
      rateData.gst += deliveryGst;

      subtotal += deliveryPrice;
      totalGst += deliveryGst;
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
      grandTotal: subtotal + totalGst,
    };
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
    // Get all invoices for period
    const invoices = await this.invoiceRepository.find({
      where: {
        business_id: businessId,
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

    for (const invoice of invoices) {
      totalSales += invoice.subtotal_cents;
      totalGst += invoice.total_gst_cents;

      // Aggregate by rate
      for (const breakdown of invoice.gst_breakdown) {
        if (!gstByRateMap.has(breakdown.rate)) {
          gstByRateMap.set(breakdown.rate, { taxable: 0, gst: 0 });
        }
        const rateData = gstByRateMap.get(breakdown.rate)!;
        rateData.taxable += breakdown.taxable_amount_cents;
        rateData.gst += breakdown.gst_amount_cents;
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
    // Get payments for revenue
    const payments = await this.paymentRepository.find({
      where: {
        business_id: businessId,
        status: 'succeeded',
        created_at: Between(startDate, endDate),
      },
    });

    // Calculate revenue
    const grossSales = payments.reduce((sum, p) => sum + p.amount_cents, 0);
    const processorFees = payments.reduce((sum, p) => sum + p.processor_fee_cents, 0);

    // Revenue by month
    const byMonthMap = new Map<string, number>();
    for (const payment of payments) {
      const month = payment.created_at.toISOString().slice(0, 7); // YYYY-MM
      byMonthMap.set(month, (byMonthMap.get(month) || 0) + payment.amount_cents);
    }
    const byMonth = Array.from(byMonthMap.entries()).map(([month, amount_cents]) => ({
      month,
      amount_cents,
    }));

    // Revenue by processor
    const byProcessorMap = new Map<string, number>();
    for (const payment of payments) {
      const processor = payment.processor_type || 'unknown';
      byProcessorMap.set(processor, (byProcessorMap.get(processor) || 0) + payment.amount_cents);
    }
    const byProcessor = Array.from(byProcessorMap.entries()).map(
      ([processor, amount_cents]) => ({
        processor,
        amount_cents,
      })
    );

    // Get payouts for subscription fees
    const payouts = await this.payoutRepository.find({
      where: {
        business_id: businessId,
        created_at: Between(startDate, endDate),
      },
    });

    const subscriptionFees = payouts.reduce((sum, p) => sum + p.subscription_fee_cents, 0);

    // Calculate refunds
    const refunds = payments
      .filter((p) => p.refund_details)
      .reduce((sum, p) => sum + (p.refund_details?.refund_amount_cents || 0), 0);

    // Total expenses
    const totalExpenses = processorFees + subscriptionFees + refunds;

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
        delivery_waivers_cents: 0, // TODO: Track delivery waivers
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
    return this.invoiceRepository.findOne({
      where: { id: invoiceId },
      relations: ['business', 'order'],
    });
  }

  /**
   * Get invoice by order ID
   */
  async getInvoiceByOrderId(orderId: string): Promise<TaxInvoice | null> {
    return this.invoiceRepository.findOne({
      where: { order_id: orderId },
      relations: ['business', 'order'],
    });
  }
}
