import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddViewCurrentOrderTemplate1772908000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Template para ver pedido actual con productos
    const viewCurrentOrderTemplate = {
      key: 'order.view_current',
      name: 'Ver Pedido Actual',
      description:
        'Muestra el pedido actual del cliente con todos los productos',
      content: {
        es: '📋 Tu pedido actual:\n\n{{#each items}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Nota: {{this.notes}}]{{/if}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Deseas agregar algo más?',
        en: '📋 Your current order:\n\n{{#each items}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nWould you like to add something else?',
        fr: '📋 Votre commande actuelle:\n\n{{#each items}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nSouhaitez-vous ajouter autre chose?',
        ko: '📋 현재 주문:\n\n{{#each items}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [메모: {{this.notes}}]{{/if}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 합계: ${{total}}\n\n다른 것을 추가하시겠습니까?',
      },
      variables: ['items', 'total'],
      category: 'order',
      isActive: true,
    };

    // Template para respuesta negativa genérica
    const declineOfferTemplate = {
      key: 'conversation.decline_offer',
      name: 'Respuesta Negativa a Oferta',
      description: 'Respuesta cuando el cliente declina una oferta',
      content: {
        es: 'Entendido. ¿En qué más puedo ayudarte?',
        en: 'Understood. What else can I help you with?',
        fr: "Compris. En quoi d'autre puis-je vous aider?",
        ko: '알겠습니다. 다른 도움이 필요하신가요?',
      },
      variables: [],
      category: 'conversation',
      isActive: true,
    };

    // Template para continuar navegando el menú
    const continueBrowsingTemplate = {
      key: 'conversation.continue_browsing',
      name: 'Continuar Navegando',
      description:
        'Invita al cliente a continuar viendo el menú o hacer preguntas',
      content: {
        es: '¿Te gustaría ver otras opciones del menú o tienes alguna pregunta sobre algún platillo?',
        en: 'Would you like to see other menu options or do you have any questions about any dish?',
        fr: "Souhaitez-vous voir d'autres options du menu ou avez-vous des questions sur un plat?",
        ko: '다른 메뉴 옵션을 보시겠습니까, 아니면 요리에 대한 질문이 있으신가요?',
      },
      variables: [],
      category: 'conversation',
      isActive: true,
    };

    // Insertar templates en la base de datos
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        viewCurrentOrderTemplate.key,
        viewCurrentOrderTemplate.name,
        viewCurrentOrderTemplate.description,
        JSON.stringify(viewCurrentOrderTemplate.content),
        JSON.stringify(viewCurrentOrderTemplate.variables),
        viewCurrentOrderTemplate.category,
        viewCurrentOrderTemplate.isActive,
      ],
    );

    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        declineOfferTemplate.key,
        declineOfferTemplate.name,
        declineOfferTemplate.description,
        JSON.stringify(declineOfferTemplate.content),
        JSON.stringify(declineOfferTemplate.variables),
        declineOfferTemplate.category,
        declineOfferTemplate.isActive,
      ],
    );

    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        continueBrowsingTemplate.key,
        continueBrowsingTemplate.name,
        continueBrowsingTemplate.description,
        JSON.stringify(continueBrowsingTemplate.content),
        JSON.stringify(continueBrowsingTemplate.variables),
        continueBrowsingTemplate.category,
        continueBrowsingTemplate.isActive,
      ],
    );

    console.log(
      'View current order and conversation templates created successfully',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN ('order.view_current', 'conversation.decline_offer', 'conversation.continue_browsing')`,
    );
  }
}
