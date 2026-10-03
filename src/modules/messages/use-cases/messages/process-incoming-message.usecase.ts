import { errorMessage, errorCode } from '@/common/utils/error.util';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchesService } from '@/modules/branches/branches.service';
import { Branch } from '@/modules/branches/entities/branch.entity';
import { Customer } from '@/modules/customers/entities/customer.entity';
import { WebhookDataTwilio } from '@/modules/messages/models/webhook-data.twilio';
import { ConversationService } from '@/modules/messages/services/conversation.service';
import { TwilioService } from '@/modules/messages/services/twilio.service';
import { NotifyCashierAboutInappropriateBehaviorUseCase } from '@/modules/messages/use-cases/messages/notifications/notify-cashier-about-inappropriate-behavior.usecase';
import { SendMessageUseCase } from '@/modules/messages/use-cases/messages/send-message.usecase';
import { detectInappropriateBehaviorUtil } from '@/modules/messages/utils/detect-inappropriate-behavior.util';
import { detectInvalidTableResponseUtil } from '@/modules/messages/utils/detect-invalid-table-response.util';
import {
  getLanguageSelectionPrompt,
  getLocationRequestMessage,
  getLocationRetryMessage,
  getMenuWelcomeMessage,
} from '@/modules/messages/utils/get-onboarding-messages.util';
import { removeMenuItemsIdsUtil } from '@/modules/messages/utils/remove-menu-items-ids.util';
import { OpenAIService } from '@/modules/openai/openai.service';

const AUDIO_ERROR_MESSAGE =
  'Lo siento, no pude procesar tu nota de voz. Por favor intenta nuevamente o escribe tu mensaje. 🎤\n\n' +
  "Sorry, I couldn't process your voice note. Please try again or send a text message. 🎤";

const AUDIO_TOO_LARGE_MESSAGE =
  'El archivo de audio es muy grande. Por favor intenta con un audio más corto o escribe tu mensaje. 📁\n\n' +
  'The audio file is too large. Please try with a shorter audio or send a text message. 📁';

const QR_REQUIRED_MESSAGE =
  'Por favor, escanea el código QR de tu mesa para iniciar tu pedido. 📱\n\nPlease scan the QR code on your table to start your order. 📱';

const QR_EXPIRED_MESSAGE =
  'El código QR ha expirado. Por favor, solicita uno nuevo al personal. ⚠️\n\nThe QR code has expired. Please request a new one from staff. ⚠️';

const TERMINATED_MESSAGE =
  'Su comunicación ha sido terminada por comportamiento inapropiado. El personal ha sido notificado.';

@Injectable()
export class ProcessIncomingMessageUseCase {
  private readonly logger = new Logger(ProcessIncomingMessageUseCase.name);

  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly twilioService: TwilioService,
    private readonly openAIService: OpenAIService,
    private readonly conversationService: ConversationService,
    private readonly branchService: BranchesService,
    private readonly notifyCashierAboutInappropriateBehaviorUseCase: NotifyCashierAboutInappropriateBehaviorUseCase,
    private readonly sendMessageUseCase: SendMessageUseCase,
  ) {}

  async execute(body: WebhookDataTwilio): Promise<void> {
    const incoming = this.twilioService.processIncomingWhatsappMessage(body);
    const {
      to,
      from,
      profileName,
      hasAudio,
      audioUrl,
      audioMimeType,
      messageSid,
    } = incoming;

    const branch = await this.findServingBranch(to);
    if (!branch) return;

    // La caja recibe notificaciones desde este número; sus mensajes no son
    // pedidos de clientes (v1 los trataba como cliente con id falso).
    if (from === branch.phoneNumberReception) {
      this.logger.log(
        `Ignoring message from the cashier number of branch ${branch.id}`,
      );
      return;
    }

    if (branch.availableMessages <= 0) {
      this.logger.warn(
        `Branch ${branch.id} has no available messages left. Message ${messageSid} not processed.`,
      );
      return;
    }

    let processedMessage = incoming.message;

    if (hasAudio && audioUrl && audioMimeType) {
      try {
        const audioBuffer = await this.twilioService.downloadMedia(audioUrl);
        processedMessage = await this.openAIService.transcribeAudio(
          audioBuffer,
          audioMimeType,
        );
      } catch (error) {
        this.logger.error(
          `Error transcribing audio of message ${messageSid}: ${errorMessage(error)}`,
        );
        const tooLarge =
          errorMessage(error) === 'AUDIO_TOO_LARGE' ||
          errorCode(error) === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED';
        await this.sendMessageUseCase.execute(
          from,
          tooLarge ? AUDIO_TOO_LARGE_MESSAGE : AUDIO_ERROR_MESSAGE,
          to,
        );
        return;
      }
    }

    if (!processedMessage?.trim()) {
      this.logger.warn(`Empty message received (${messageSid})`);
      return;
    }

    const customer = await this.getOrCreateCustomer(from, profileName);
    if (!customer) return;

    if (
      detectInappropriateBehaviorUtil(processedMessage) ||
      detectInvalidTableResponseUtil(processedMessage)
    ) {
      await this.terminateConversation(
        from,
        processedMessage,
        branch,
        customer,
      );
      return;
    }

    const response = await this.conversationService.processMessage(
      from,
      processedMessage,
      branch,
      customer,
    );

    await this.handleResponse(response, from, to, branch, customer);
  }

  private async handleResponse(
    response: string,
    from: string,
    to: string,
    branch: Branch,
    customer: Customer,
  ) {
    if (response === 'QR_VALIDATION_FAILED') {
      await this.sendMessageUseCase.execute(from, QR_REQUIRED_MESSAGE, to);
      return;
    }

    if (response === 'QR_TOKEN_INVALID') {
      await this.sendMessageUseCase.execute(from, QR_EXPIRED_MESSAGE, to);
      return;
    }

    if (response === 'QR_VALIDATION_SUCCESS') {
      const restaurantName = branch.restaurant?.name || 'our restaurant';
      const greeting = customer.name
        ? `Hello ${customer.name}! 👋 Welcome to ${restaurantName} - ${branch.name}.`
        : `Hello! 👋 Welcome to ${restaurantName} - ${branch.name}.`;

      await this.sendMessageUseCase.execute(
        from,
        `${greeting}\n\n` +
          '📝 You can send text messages or voice notes (max 30 seconds).\n' +
          '📝 Puedes enviar mensajes de texto o notas de voz (máximo 30 segundos).\n\n' +
          'Please select your preferred language:\n\n' +
          '🇲🇽 Español\n' +
          '🇺🇸 English\n' +
          '🇫🇷 Français\n' +
          '🇰🇷 한국어',
        to,
      );
      return;
    }

    if (response === 'AWAITING_LANGUAGE') {
      await this.sendMessageUseCase.execute(
        from,
        getLanguageSelectionPrompt(),
        to,
      );
      return;
    }

    const [flag, lang] = response.split(':');

    if (flag === 'LANG_SELECTED') {
      await this.sendMessageUseCase.execute(
        from,
        getLocationRequestMessage(lang),
        to,
      );
      return;
    }

    if (flag === 'AWAITING_LOCATION') {
      await this.sendMessageUseCase.execute(
        from,
        getLocationRetryMessage(lang),
        to,
      );
      return;
    }

    if (flag === 'LOCATION_RECEIVED') {
      await this.sendMessageUseCase.execute(
        from,
        getMenuWelcomeMessage(lang, branch),
        to,
      );
      return;
    }

    // Respuesta del flujo principal (MAIN_FLOW:<mensaje>).
    const actualMessage = response.startsWith('MAIN_FLOW:')
      ? response.substring('MAIN_FLOW:'.length)
      : response;

    await this.sendMessageUseCase.execute(
      from,
      removeMenuItemsIdsUtil(actualMessage),
      to,
    );

    if (!(await this.branchService.consumeMessageCredit(branch.id))) {
      this.logger.warn(`Branch ${branch.id} ran out of message credits`);
    }
  }

  /**
   * Sucursal dueña del número que recibió el mensaje, solo si ella y su
   * restaurante están activos.
   */
  private async findServingBranch(
    assistantPhone: string,
  ): Promise<Branch | null> {
    let branch: Branch;
    try {
      ({ branch } = await this.branchService.findByTerm(assistantPhone, 'es'));
    } catch {
      this.logger.warn(
        'Message received for a number that is not assigned to any branch',
      );
      return null;
    }

    if (!branch.isActive || branch.restaurant?.isActive === false) {
      this.logger.warn(
        `Message received for inactive branch ${branch.id}; ignoring`,
      );
      return null;
    }

    return branch;
  }

  /**
   * Devuelve el cliente, creándolo la primera vez. Un cliente desactivado
   * (bloqueado desde el panel) no recibe respuesta.
   */
  private async getOrCreateCustomer(
    phone: string,
    profileName: string,
  ): Promise<Customer | null> {
    const existing = await this.customerRepository.findOne({
      where: { phone },
    });

    if (existing) {
      if (!existing.isActive) {
        this.logger.warn(
          `Ignoring message from blocked customer ${existing.id}`,
        );
        return null;
      }

      if (existing.name !== profileName) {
        await this.customerRepository.update(
          { id: existing.id },
          { name: profileName },
        );
        existing.name = profileName;
      }

      return existing;
    }

    await this.customerRepository
      .createQueryBuilder()
      .insert()
      .into(Customer)
      .values({ phone, name: profileName })
      .orIgnore()
      .execute();

    return this.customerRepository.findOne({ where: { phone } });
  }

  private async terminateConversation(
    from: string,
    message: string,
    branch: Branch,
    customer: Customer,
  ) {
    const conversation = await this.conversationService.getOrCreateConversation(
      from,
      branch.id,
    );

    await this.notifyCashierAboutInappropriateBehaviorUseCase.execute(
      from,
      message,
      conversation.location ?? '',
      branch,
      customer,
    );

    await this.sendMessageUseCase.execute(
      from,
      TERMINATED_MESSAGE,
      branch.phoneNumberAssistant,
    );

    this.logger.warn(
      `Deleting conversation ${conversation.conversationId} due to inappropriate behavior`,
    );
    await this.conversationService.deleteConversation(
      conversation.conversationId,
    );
  }
}
