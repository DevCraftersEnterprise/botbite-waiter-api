import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { Conversation } from '@/modules/messages/entities/conversation.entity';
import { GetOrCreateConversationUseCase } from '@/modules/messages/use-cases/conversations/get-create-conversation.usecase';
import { ProcessMainFlowUseCase } from '@/modules/messages/use-cases/messages/process-main-flow.usecase';
import { detectLanguageUtil } from '@/modules/messages/utils/detect-language.util';
import { extractLocationFromMessageUtil } from '@/modules/messages/utils/extract-location-from-message.util';
import { validateQrScanUtil } from '@/modules/messages/utils/validate-qr-scan.util';

/** Estado de una sesión nueva en la mesa. */
const FRESH_SESSION_STATE: Partial<Conversation> = {
  location: null,
  lastOrderSentToCashier: null,
  lastOrderSentAt: null,
  preferredLanguage: null,
  pendingOrder: null,
  amenities: null,
  awaitingPaymentMethod: false,
};

/**
 * Máquina de estados de la conversación: QR → idioma → ubicación → flujo
 * principal. Devuelve banderas (QR_*, AWAITING_*, LANG_SELECTED, ...) o
 * `MAIN_FLOW:<respuesta>`.
 */
@Injectable()
export class ProcessMessageUseCase {
  private readonly logger = new Logger(ProcessMessageUseCase.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    private readonly getOrCreateConversationUseCase: GetOrCreateConversationUseCase,
    private readonly processMainFlowUseCase: ProcessMainFlowUseCase,
  ) {}

  async execute(
    phoneNumber: string,
    userMessage: string,
    branch: Branch,
    customer: Customer,
  ): Promise<string> {
    const conversation = await this.getOrCreateConversationUseCase.execute(
      phoneNumber,
      branch.id,
    );
    const { isValidQrScan, token } = validateQrScanUtil(userMessage);
    const isCurrentQr =
      isValidQrScan && !!branch.qrToken && token === branch.qrToken;

    if (!conversation.isQrValidated) {
      if (!isValidQrScan) {
        this.logger.warn(
          `Conversation attempt without QR scan. Branch: ${branch.id}`,
        );
        return 'QR_VALIDATION_FAILED';
      }

      if (!isCurrentQr) {
        this.logger.warn(`Invalid or outdated QR token. Branch: ${branch.id}`);
        return 'QR_TOKEN_INVALID';
      }

      await this.conversationRepository.update(
        { id: conversation.id },
        { ...FRESH_SESSION_STATE, isQrValidated: true },
      );

      this.logger.log(`QR validated for conversation ${conversation.id}`);
      return 'QR_VALIDATION_SUCCESS';
    }

    // Volver a escanear el QR inicia una sesión nueva (otro comensal en la
    // misma mesa). En v1 quedaban restos del pedido pendiente anterior.
    if (isCurrentQr) {
      this.logger.log(
        `QR re-scan detected for conversation ${conversation.id}. Resetting state.`,
      );
      await this.conversationRepository.update(
        { id: conversation.id },
        FRESH_SESSION_STATE,
      );
      return 'QR_VALIDATION_SUCCESS';
    }

    if (!conversation.preferredLanguage) {
      const detectedLanguage = detectLanguageUtil(userMessage);
      if (!detectedLanguage) return 'AWAITING_LANGUAGE';

      await this.conversationRepository.update(
        { id: conversation.id },
        { preferredLanguage: detectedLanguage },
      );
      return `LANG_SELECTED:${detectedLanguage}`;
    }

    if (!conversation.location) {
      const location = extractLocationFromMessageUtil(userMessage);
      if (!location)
        return `AWAITING_LOCATION:${conversation.preferredLanguage}`;

      await this.conversationRepository.update(
        { id: conversation.id },
        { location },
      );
      return `LOCATION_RECEIVED:${conversation.preferredLanguage}`;
    }

    const mainFlowResponse = await this.processMainFlowUseCase.execute(
      conversation,
      userMessage,
      branch,
      customer,
    );
    return `MAIN_FLOW:${mainFlowResponse}`;
  }
}
