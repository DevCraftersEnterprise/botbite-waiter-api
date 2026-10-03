import { Product } from '@/modules/products/entities/product.entity';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { MenuItem } from '@/modules/menus/entities/menu-item.entity';
import { OpenAIService } from '@/modules/openai/openai.service';
import { CashierNotification } from '@/modules/messages/entities/cashier-notifications.entity';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { OrdersGateway } from '@/modules/messages/gateways/orders.gateway';
import { calculateOrderChangesUtil } from '@/modules/messages/utils/calculate-order-changes.util';
import { detectAmenityIntentUtil } from '@/modules/messages/utils/detect-amenity-intent.util';
import {
  detectCancelKeywordUtil,
  detectModifyKeywordUtil,
} from '@/modules/messages/utils/detect-cancel-modify-intent.util';
import { detectConsumoIntentUtil } from '@/modules/messages/utils/detect-consumo-intent.util';
import { detectCuentaIntentUtil } from '@/modules/messages/utils/detect-cuenta-intent.util';
import { detectMenuIntentUtil } from '@/modules/messages/utils/detect-menu-intent.util';
import { detectOrderResponseUtil } from '@/modules/messages/utils/detect-order-response.util';
import { detectPaymentMethodInputUtil } from '@/modules/messages/utils/detect-payment-method-input.util';
import { detectProductInfoIntentUtil } from '@/modules/messages/utils/detect-product-info-intent.util';
import { detectRecommendationIntentUtil } from '@/modules/messages/utils/detect-recommendation-intent.util';
import { detectSocialMessageUtil } from '@/modules/messages/utils/detect-social-message.util';
import { detectSplitBillIntentUtil } from '@/modules/messages/utils/detect-split-bill-intent.util';
import { removeStopwordsUtil } from '@/modules/messages/utils/detect-stopwords.util';
import { extractAddItemIntentUtil } from '@/modules/messages/utils/extract-add-item-intent.util';
import {
  findAllMenuItemsInMessage,
  FoundOrderItem,
} from '@/modules/messages/utils/find-all-menu-items-in-message.util';
import {
  classifyMenuMatch,
  findMatchingMenuItemsUtil,
  findMenuItemFuzzyUtil,
  FUZZY_THRESHOLD,
  scoreMenuItem,
} from '@/modules/messages/utils/find-menu-item-fuzzy.util';
import {
  detectPhotoRequestUtil,
  getAmenityResponseMessage,
  getBillClosedMessage,
  getBillNotifiedMessage,
  getCannotCancelOrderMessage,
  getCannotModifyOrderMessage,
  getCannotSplitBillMessage,
  getCartMessage,
  getCategoryOptionsMessage,
  getConfirmationRePromptMessage,
  getConsumoMessage,
  getDefaultFlowMessage,
  getInfoRequestMessage,
  getMenuWelcomeMessage,
  getMatchingProductsMessage,
  getMixedMatchMessage,
  getMultipleProductInfoMessage,
  getNoPhotoAvailableMessage,
  getNoRecommendationsMessage,
  getOrderCancelledMessage,
  getOrderConfirmedMessage,
  getPartialMatchMessage,
  getPaymentMethodRetryMessage,
  getProductInfoMessage,
  getProductNotFoundMessage,
  getProductUnavailableMessage,
  getRecommendationsMessage,
  getSocialResponseMessage,
} from '@/modules/messages/utils/get-onboarding-messages.util';
import { CreateOrderAfterBillRequestUseCase } from '@/modules/messages/use-cases/messages/create-order-after-bill-request.usecase';
import { SendMessageUseCase } from '@/modules/messages/use-cases/messages/send-message.usecase';

type OrderItems = Record<
  string,
  { price: number; quantity: number; menuItemId: string; notes?: string }
>;

@Injectable()
export class ProcessMainFlowUseCase {
  private readonly logger = new Logger(ProcessMainFlowUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(CashierNotification)
    private readonly cashierNotificationRepository: Repository<CashierNotification>,
    private readonly sendMessageUseCase: SendMessageUseCase,
    private readonly ordersGateway: OrdersGateway,
    private readonly createOrderAfterBillRequestUseCase: CreateOrderAfterBillRequestUseCase,
    private readonly openAIService: OpenAIService,
  ) {}

  async execute(
    conversation: Conversation,
    userMessage: string,
    branch: Branch,
    customer: Customer,
  ): Promise<string> {
    const lang = conversation.preferredLanguage ?? 'es';
    const allMenuItems: MenuItem[] =
      branch.menus?.flatMap((m) => m.menuItems ?? []) ?? [];
    const activeMenuItems = allMenuItems.filter((i) => i.isActive && i.product);

    // ── STATE 1: Awaiting payment method ──────────────────────────────────────
    if (conversation.awaitingPaymentMethod) {
      return this.handlePaymentMethod(
        userMessage,
        conversation,
        branch,
        customer,
        lang,
        allMenuItems,
      );
    }

    // ── STATE 2: Pending order confirmation ───────────────────────────────────
    const hasPending =
      conversation.pendingOrder &&
      Object.keys(conversation.pendingOrder).length > 0;
    if (hasPending) {
      return this.handlePendingConfirmation(
        userMessage,
        conversation,
        branch,
        customer,
        lang,
        activeMenuItems,
        allMenuItems,
      );
    }

    // ── STATE 3: Main flow ────────────────────────────────────────────────────
    return this.handleMainFlow(
      userMessage,
      conversation,
      branch,
      customer,
      lang,
      activeMenuItems,
      allMenuItems,
    );
  }

  // ── State 1 ─────────────────────────────────────────────────────────────────

  private async handlePaymentMethod(
    userMessage: string,
    conversation: Conversation,
    branch: Branch,
    customer: Customer,
    lang: string,
    allMenuItems: MenuItem[],
  ): Promise<string> {
    const paymentMethod = detectPaymentMethodInputUtil(userMessage);

    if (!paymentMethod) {
      return getPaymentMethodRetryMessage(lang);
    }

    // Build full order for the bill
    const fullOrder: OrderItems = {
      ...(conversation.lastOrderSentToCashier ?? {}),
    };
    const totalAmount = Object.values(fullOrder).reduce(
      (acc, i) => acc + i.price * i.quantity,
      0,
    );

    const cashierMessage =
      `💳 El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* ha solicitado su cuenta.\n\n` +
      `${this.buildOrderLines(fullOrder, allMenuItems)}\n` +
      `Total: $${totalAmount.toFixed(2)}\n` +
      `Método de pago: *${paymentMethod}*`;

    await this.notifyCashier(cashierMessage, branch, customer);

    // Create DB order + delete conversation
    try {
      await this.createOrderAfterBillRequestUseCase.execute(
        customer.id,
        fullOrder,
        branch,
      );
    } catch (e) {
      this.logger.error('Error creating order on bill close:', e);
    }

    await this.conversationRepository.delete({
      conversationId: conversation.conversationId,
    });
    this.ordersGateway.emitOrderUpdate(branch.id);

    return getBillClosedMessage(lang, fullOrder, allMenuItems, branch);
  }

  // ── State 2 ─────────────────────────────────────────────────────────────────

  private async handlePendingConfirmation(
    userMessage: string,
    conversation: Conversation,
    branch: Branch,
    customer: Customer,
    lang: string,
    activeMenuItems: MenuItem[],
    allMenuItems: MenuItem[],
  ): Promise<string> {
    // Edge cases: modify on already-confirmed items (cancel is handled below with pending cleanup)
    if (detectModifyKeywordUtil(userMessage)) {
      return getCannotModifyOrderMessage(lang);
    }
    // Split bill while in pending → refusal, stay in state 2
    if (detectSplitBillIntentUtil(userMessage)) {
      return getCannotSplitBillMessage(lang);
    }

    const orderResponse = detectOrderResponseUtil(userMessage);

    // Confirm
    if (orderResponse === 'confirm') {
      return this.confirmOrder(
        conversation,
        branch,
        customer,
        lang,
        allMenuItems,
      );
    }

    // Cancel → clear ONLY pending order; preserve already-confirmed order
    if (orderResponse === 'cancel') {
      await this.conversationRepository.update(
        { id: conversation.id },
        {
          pendingOrder: null,
        },
      );
      return getOrderCancelledMessage(
        lang,
        this.hasConfirmedOrder(conversation),
      );
    }

    // Continue (no) → keep pending order, show menu so user can keep adding
    if (orderResponse === 'continue') {
      return getMenuWelcomeMessage(lang, branch);
    }

    // Si el usuario escribe solo 'detalles' o 'detalle', no agregar productos
    const detallesWords = [
      'detalles',
      'detalle',
      'descripcion',
      'descripción',
      'info',
      'informacion',
      'información',
    ];
    if (detallesWords.includes(userMessage.trim().toLowerCase())) {
      return getConfirmationRePromptMessage(lang);
    }

    // User adds more products while in pending state (multi-item first)
    const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);
    if (foundItems.length > 0) {
      return this.addMultipleItemsAndShowCart(
        foundItems,
        conversation,
        lang,
        allMenuItems,
      );
    }

    // Single fuzzy match fallback
    const foundItem = findMenuItemFuzzyUtil(userMessage, activeMenuItems);
    if (foundItem) {
      return this.addItemAndShowCart(
        userMessage,
        foundItem,
        conversation,
        lang,
        allMenuItems,
      );
    }

    // Unrecognized → re-prompt
    return getConfirmationRePromptMessage(lang);
  }

  // ── State 3 ─────────────────────────────────────────────────────────────────

  private async handleMainFlow(
    userMessage: string,
    conversation: Conversation,
    branch: Branch,
    customer: Customer,
    lang: string,
    activeMenuItems: MenuItem[],
    allMenuItems: MenuItem[],
  ): Promise<string> {
    // 1. Social / farewell
    if (detectSocialMessageUtil(userMessage)) {
      return getSocialResponseMessage(lang, branch);
    }

    // 2. Split bill
    if (detectSplitBillIntentUtil(userMessage)) {
      return getCannotSplitBillMessage(lang);
    }

    // 3. Cancel keyword — only refuse if there's a confirmed order
    if (
      detectCancelKeywordUtil(userMessage) &&
      this.hasConfirmedOrder(conversation)
    ) {
      return getCannotCancelOrderMessage(lang);
    }

    // 4. Modify keyword — only refuse if there's a confirmed order
    if (
      detectModifyKeywordUtil(userMessage) &&
      this.hasConfirmedOrder(conversation)
    ) {
      return getCannotModifyOrderMessage(lang);
    }

    // 5. Menu
    if (detectMenuIntentUtil(userMessage)) {
      return getMenuWelcomeMessage(lang, branch);
    }

    // 6. Consumo
    if (detectConsumoIntentUtil(userMessage)) {
      return getConsumoMessage(
        lang,
        conversation.lastOrderSentToCashier ?? null,
        conversation.pendingOrder ?? null,
        allMenuItems,
      );
    }

    // 7. Cuenta — notificar directo a caja y cerrar conversación con mensaje corto
    if (detectCuentaIntentUtil(userMessage)) {
      const fullOrder: OrderItems = {
        ...(conversation.lastOrderSentToCashier ?? {}),
      };
      const totalAmount = Object.values(fullOrder).reduce(
        (acc, i) => acc + i.price * i.quantity,
        0,
      );

      const cashierMessage =
        `🧾 El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* solicita su cuenta.\n\n` +
        `${this.buildOrderLines(fullOrder, allMenuItems)}\n` +
        `Total: $${totalAmount.toFixed(2)}`;

      await this.notifyCashier(cashierMessage, branch, customer);

      try {
        await this.createOrderAfterBillRequestUseCase.execute(
          customer.id,
          fullOrder,
          branch,
        );
      } catch (e) {
        this.logger.error('Error creating order on bill close:', e);
      }

      await this.conversationRepository.delete({
        conversationId: conversation.conversationId,
      });
      this.ordersGateway.emitOrderUpdate(branch.id);

      return getBillNotifiedMessage(lang, branch);
    }

    // 8. Recommendations
    if (detectRecommendationIntentUtil(userMessage)) {
      const recommended = activeMenuItems.filter((i) => i.shouldRecommend);
      if (recommended.length === 0) return getNoRecommendationsMessage(lang);
      const translatedRecommended = await this.translateItemDescriptions(
        recommended,
        lang,
      );
      return getRecommendationsMessage(lang, translatedRecommended);
    }

    // 9. Product info / photo request
    if (
      detectProductInfoIntentUtil(userMessage) ||
      detectPhotoRequestUtil(userMessage)
    ) {
      const foundItems = findAllMenuItemsInMessage(
        userMessage,
        activeMenuItems,
      );

      if (foundItems.length > 1) {
        // Multiple products: show all descriptions
        const translatedItems = await this.translateItemDescriptions(
          foundItems.map((f) => f.item),
          lang,
        );
        return getMultipleProductInfoMessage(lang, translatedItems);
      }

      if (foundItems.length === 1) {
        const item = foundItems[0].item;
        if (detectPhotoRequestUtil(userMessage) && !item.product?.imageUrl) {
          return getNoPhotoAvailableMessage(lang, item.product?.name ?? '');
        }
        const [translatedItem] = await this.translateItemDescriptions(
          [item],
          lang,
        );
        return getProductInfoMessage(lang, translatedItem);
      }

      // Fallback: fuzzy single match
      const foundItem = findMenuItemFuzzyUtil(userMessage, activeMenuItems);
      if (!foundItem) {
        // If the message was ONLY info-trigger words (stopwords removed → empty),
        // ask the user which dish they want info about.
        const cleaned = removeStopwordsUtil(userMessage);
        if (!cleaned || cleaned.trim() === '') {
          return getInfoRequestMessage(lang);
        }
        return getProductNotFoundMessage(lang);
      }
      if (detectPhotoRequestUtil(userMessage) && !foundItem.product?.imageUrl) {
        return getNoPhotoAvailableMessage(lang, foundItem.product?.name ?? '');
      }
      const [translatedFoundItem] = await this.translateItemDescriptions(
        [foundItem],
        lang,
      );
      return getProductInfoMessage(lang, translatedFoundItem);
    }

    // 10. Amenity request
    const { isAmenity, amenities } = detectAmenityIntentUtil(userMessage);
    if (isAmenity) {
      const amenityMsg =
        `🍴 El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* solicita:\n` +
        Object.entries(amenities)
          .map(([k, q]) => `• ${k}: ${q}`)
          .join('\n');
      await this.notifyCashier(amenityMsg, branch, customer);
      return getAmenityResponseMessage(lang, amenities);
    }

    // 11. Inactive product detection — scan ALL items directly (no ambiguity guard)
    // so that "chips de camote" (inactive) is detected even when "chips de papa" (active) scores equally.
    {
      let bestInactiveScore = 0;
      let bestInactiveItem: MenuItem | null = null;
      for (const item of allMenuItems) {
        if (item.isActive && item.product?.isActive !== false) continue;
        const s = scoreMenuItem(userMessage, item, true);
        if (s > bestInactiveScore) {
          bestInactiveScore = s;
          bestInactiveItem = item;
        }
      }

      if (bestInactiveItem && bestInactiveScore >= FUZZY_THRESHOLD) {
        let bestActiveScore = 0;
        for (const item of activeMenuItems) {
          const s = scoreMenuItem(userMessage, item);
          if (s > bestActiveScore) bestActiveScore = s;
        }
        // Show "unavailable" if the inactive product is at least as relevant as the best active one.
        if (bestInactiveScore >= bestActiveScore) {
          return getProductUnavailableMessage(
            lang,
            bestInactiveItem.product?.name ?? '',
          );
        }
      }
    }

    // 12. Multi-item order detection
    const foundItems = findAllMenuItemsInMessage(userMessage, activeMenuItems);
    if (foundItems.length > 0) {
      // Category-guard: if exactly one product was found but the query is a category keyword
      // and that category has multiple active products, list the options instead of adding directly.
      if (foundItems.length === 1) {
        const matchedItem = foundItems[0].item;
        const categoryName = matchedItem.category?.name;
        if (categoryName) {
          const siblingsInCategory = activeMenuItems.filter(
            (i) => i.category?.name === categoryName && i.id !== matchedItem.id,
          );
          if (siblingsInCategory.length > 0) {
            // Check if query is essentially the category name (no distinguishing words).
            // Use removeStopwordsUtil for consistent lowercase+accent-stripped comparison.
            const cleaned = removeStopwordsUtil(userMessage);
            const normQuery = cleaned;
            const normCategory = removeStopwordsUtil(categoryName).replace(
              /s$/,
              '',
            );
            if (
              normQuery &&
              normCategory &&
              (normCategory.includes(normQuery) ||
                normQuery.includes(normCategory))
            ) {
              const allCategoryItems = activeMenuItems.filter(
                (i) => i.category?.name === categoryName,
              );
              return getCategoryOptionsMessage(
                lang,
                categoryName,
                allCategoryItems,
              );
            }
          }
        }
      }
      return this.addMultipleItemsAndShowCart(
        foundItems,
        conversation,
        lang,
        allMenuItems,
      );
    }

    // 13. Classify intent; list concrete candidates when available
    const match = classifyMenuMatch(userMessage, activeMenuItems);
    if (match.type === 'partial') {
      // Try listing by category name first (query = "cervezas" → list Cervezas category)
      const normQuery = removeStopwordsUtil(userMessage);
      const categoryMatch = normQuery
        ? activeMenuItems.find((i) => {
            const catNorm = removeStopwordsUtil(i.category?.name ?? '');
            const catSingular = catNorm.replace(/s$/, '');
            return (
              catNorm &&
              (catNorm === normQuery ||
                catSingular === normQuery ||
                normQuery.includes(catSingular))
            );
          })
        : null;
      if (categoryMatch) {
        const catName = categoryMatch.category.name;
        const catItems = activeMenuItems.filter(
          (i) => i.category?.name === catName,
        );
        return getCategoryOptionsMessage(lang, catName, catItems);
      }
      // Otherwise list all product candidates scoring above threshold
      const candidates = findMatchingMenuItemsUtil(
        userMessage,
        activeMenuItems,
      ).slice(0, 5);
      if (candidates.length > 0) {
        return getMatchingProductsMessage(lang, candidates);
      }
      return getPartialMatchMessage(lang, branch);
    }
    if (match.type === 'mixed') {
      return getMixedMatchMessage(lang, branch);
    }

    // Unknown intent
    return getDefaultFlowMessage(lang);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private async confirmOrder(
    conversation: Conversation,
    branch: Branch,
    customer: Customer,
    lang: string,
    allMenuItems: MenuItem[],
  ): Promise<string> {
    const pending = conversation.pendingOrder ?? {};
    const last = conversation.lastOrderSentToCashier ?? {};

    // Build merged total order
    const merged: OrderItems = { ...last };
    for (const [key, item] of Object.entries(pending)) {
      if (merged[key]) {
        merged[key] = {
          ...merged[key],
          quantity: merged[key].quantity + item.quantity,
        };
      } else {
        merged[key] = item;
      }
    }

    // Only send DELTA to cashier
    const changes = calculateOrderChangesUtil(last, merged, this.logger);

    const orderLines = this.buildOrderLines(changes, allMenuItems);
    const totalChanges = Object.values(changes).reduce(
      (acc, i) => acc + i.price * i.quantity,
      0,
    );

    const cashierMessage =
      `🛎️ El cliente *${customer.name}* en *${conversation.location ?? 'ubicación desconocida'}* ha pedido:\n\n` +
      `${orderLines}\n` +
      `Total nuevos items: $${totalChanges.toFixed(2)}`;

    await this.notifyCashier(cashierMessage, branch, customer);

    // Persist merged order, clear pending
    await this.conversationRepository.update(
      { id: conversation.id },
      {
        lastOrderSentToCashier: merged,
        pendingOrder: null,
      },
    );

    this.ordersGateway.emitOrderUpdate(branch.id);

    return getOrderConfirmedMessage(lang);
  }

  private async addItemAndShowCart(
    userMessage: string,
    item: MenuItem,
    conversation: Conversation,
    lang: string,
    allMenuItems: MenuItem[],
  ): Promise<string> {
    if (!item.isActive || !item.product?.isActive) {
      return getProductUnavailableMessage(lang, item.product?.name ?? '');
    }

    const { quantity, notes } = extractAddItemIntentUtil(userMessage);
    const productName = item.product.name;
    const key = notes ? `${productName}||${notes}` : productName;

    // Capture snapshot before update so getCartMessage shows only the newly added item.
    const previousPendingSnapshot: OrderItems = {
      ...(conversation.pendingOrder ?? {}),
    };

    const currentPending: OrderItems = { ...previousPendingSnapshot };
    if (currentPending[key]) {
      currentPending[key] = {
        ...currentPending[key],
        quantity: currentPending[key].quantity + quantity,
      };
    } else {
      currentPending[key] = {
        price: Number(item.price),
        quantity,
        menuItemId: item.id,
        notes: notes ?? undefined,
      };
    }

    await this.conversationRepository.update(
      { id: conversation.id },
      {
        pendingOrder: currentPending,
      },
    );

    return getCartMessage(
      lang,
      currentPending,
      previousPendingSnapshot,
      conversation.lastOrderSentToCashier ?? null,
      allMenuItems,
    );
  }

  private async addMultipleItemsAndShowCart(
    items: FoundOrderItem[],
    conversation: Conversation,
    lang: string,
    allMenuItems: MenuItem[],
  ): Promise<string> {
    // Capture snapshot before update so getCartMessage shows only the newly added items.
    const previousPendingSnapshot: OrderItems = {
      ...(conversation.pendingOrder ?? {}),
    };
    const currentPending: OrderItems = { ...previousPendingSnapshot };

    for (const { item, quantity, notes } of items) {
      if (!item.isActive || !item.product?.isActive) continue;
      const productName = item.product.name;
      const key = notes ? `${productName}||${notes}` : productName;
      if (currentPending[key]) {
        currentPending[key] = {
          ...currentPending[key],
          quantity: currentPending[key].quantity + quantity,
        };
      } else {
        currentPending[key] = {
          price: Number(item.price),
          quantity,
          menuItemId: item.id,
          notes: notes ?? undefined,
        };
      }
    }

    await this.conversationRepository.update(
      { id: conversation.id },
      {
        pendingOrder: currentPending,
      },
    );

    return getCartMessage(
      lang,
      currentPending,
      previousPendingSnapshot,
      conversation.lastOrderSentToCashier ?? null,
      allMenuItems,
    );
  }

  private buildOrderLines(order: OrderItems, allMenuItems: MenuItem[]): string {
    return Object.entries(order)
      .map(([key, item]) => {
        const productName = key.split('||')[0];
        const menuItem = allMenuItems.find((mi) => mi.id === item.menuItemId);
        const cat = menuItem?.category?.name
          ? ` (${menuItem.category.name})`
          : '';
        const notesStr = item.notes ? ` [${item.notes}]` : '';
        return `• ${productName}${cat}: $${item.price.toFixed(2)} x ${item.quantity} = $${(item.price * item.quantity).toFixed(2)}${notesStr}`;
      })
      .join('\n');
  }

  /**
   * Returns a shallow copy of each MenuItem with the product description
   * translated to `lang` when lang !== 'es'. Descriptions are stored in
   * Spanish; no translation is needed for Spanish conversations.
   */
  private async translateItemDescriptions(
    items: MenuItem[],
    lang: string,
  ): Promise<MenuItem[]> {
    if (lang === 'es') return items;
    return Promise.all(
      items.map(async (item) => {
        if (!item.product?.description) return item;
        const translatedDescription = await this.openAIService.translateText(
          item.product.description,
          lang,
        );
        // Copias para no modificar las entidades cargadas de la sucursal.
        const productCopy: Product = Object.assign(
          new Product(),
          item.product,
          { description: translatedDescription },
        );
        return Object.assign(new MenuItem(), item, { product: productCopy });
      }),
    );
  }

  private hasConfirmedOrder(conversation: Conversation): boolean {
    return !!(
      conversation.lastOrderSentToCashier &&
      Object.keys(conversation.lastOrderSentToCashier).length > 0
    );
  }

  private async notifyCashier(
    message: string,
    branch: Branch,
    customer: Customer,
  ): Promise<void> {
    try {
      if (branch.phoneNumberReception) {
        await this.sendMessageUseCase.execute(
          branch.phoneNumberReception,
          message,
          branch.phoneNumberAssistant,
        );
      }

      const notification = await this.cashierNotificationRepository.save({
        branchId: branch.id,
        phoneNumber: customer.phone,
        message,
      });

      this.ordersGateway.emitNotificationUpdate(branch.id, notification);
    } catch (e) {
      this.logger.error('Error notifying cashier:', e);
    }
  }
}
