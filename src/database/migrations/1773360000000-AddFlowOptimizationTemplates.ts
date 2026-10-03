import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowOptimizationTemplates1773360000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Template 1: Confirmación de idioma + solicitud de ubicación
    const languageConfirmTemplate = {
      key: 'language.confirm',
      name: 'Confirmación de Idioma',
      description:
        'Confirma el idioma seleccionado y solicita la ubicación del cliente',
      content: {
        es: 'Perfecto. ¿Podrías decirme tu número de mesa o en qué parte te encuentras?',
        en: 'Perfect. Could you tell me your table number or where you are located?',
        fr: 'Parfait. Pourriez-vous me dire votre numéro de table ou où vous vous trouvez?',
        ko: '완벽합니다. 테이블 번호나 위치를 알려주시겠어요?',
      },
      variables: [],
      category: 'conversation',
      isActive: true,
    };

    // Template 2: Confirmación de ubicación + pregunta sobre pedido
    const locationConfirmTemplate = {
      key: 'location.confirm',
      name: 'Confirmación de Ubicación',
      description:
        'Confirma la ubicación y pregunta si el cliente sabe qué ordenar',
      content: {
        es: '¿Ya sabes qué quieres ordenar 📝?\nSi necesitas información sobre algún platillo específico, no dudes en preguntar.',
        en: 'Do you already know what you want to order 📝?\nIf you need information about any specific dish, feel free to ask.',
        fr: "Savez-vous déjà ce que vous voulez commander 📝?\nSi vous avez besoin d'informations sur un plat spécifique, n'hésitez pas à demander.",
        ko: '주문하실 것을 이미 알고 계신가요 📝?\n특정 요리에 대한 정보가 필요하시면 편하게 물어보세요.',
      },
      variables: [],
      category: 'conversation',
      isActive: true,
    };

    // Template 3: Pedido confirmado y enviado a cocina
    const orderConfirmedToKitchenTemplate = {
      key: 'order.confirmed_to_kitchen',
      name: 'Pedido Enviado a Cocina',
      description:
        'Confirma que el pedido fue enviado a cocina/caja y está en proceso',
      content: {
        es: '✅ ¡Perfecto! Tu pedido ha sido confirmado y enviado a la cocina.\n\n📋 Resumen de tu orden:\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n⏱️ Tiempo estimado: {{estimatedTime}} minutos\n\nSi necesitas agregar algo más, solo dímelo.',
        en: '✅ Perfect! Your order has been confirmed and sent to the kitchen.\n\n📋 Order Summary:\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n⏱️ Estimated time: {{estimatedTime}} minutes\n\nIf you need to add anything else, just let me know.',
        fr: '✅ Parfait! Votre commande a été confirmée et envoyée à la cuisine.\n\n📋 Résumé de la commande:\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n⏱️ Temps estimé: {{estimatedTime}} minutes\n\nSi vous souhaitez ajouter autre chose, dites-le moi.',
        ko: '✅ 완벽합니다! 주문이 확인되어 주방으로 전송되었습니다.\n\n📋 주문 요약:\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 총액: ${{total}}\n\n⏱️ 예상 시간: {{estimatedTime}}분\n\n추가로 필요하신 것이 있으면 말씀해주세요.',
      },
      variables: ['items', 'total', 'estimatedTime'],
      category: 'order',
      isActive: true,
    };

    // Template 4: Consulta del total sin pedir cuenta
    const checkTotalTemplate = {
      key: 'order.check_total',
      name: 'Consulta de Total',
      description:
        'Muestra el total actual del pedido sin generar la cuenta (el cliente solo pregunta cuánto lleva)',
      content: {
        es: '📊 Hasta el momento llevas:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Deseas agregar algo más o necesitas la cuenta?',
        en: '📊 So far you have:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nWould you like to add something else or do you need the bill?',
        fr: "📊 Jusqu'à présent vous avez:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nSouhaitez-vous ajouter autre chose ou avez-vous besoin de l'addition?",
        ko: '📊 현재까지 주문하신 내역:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 총액: ${{total}}\n\n추가로 주문하시거나 계산서가 필요하신가요?',
      },
      variables: ['items', 'total'],
      category: 'order',
      isActive: true,
    };

    // Template 5: Confirmación de solicitud de pago
    const paymentConfirmedTemplate = {
      key: 'payment.confirmed',
      name: 'Confirmación de Pago',
      description: 'Confirma que alguien se acercará para ayudar con el pago',
      content: {
        es: '✅ Perfecto, he notificado al equipo de {{restaurantName}}.\n\nAlguien se acercará en breve para ayudarte con el pago.\n\n¡Gracias por tu preferencia! 🙏',
        en: '✅ Perfect, I have notified the {{restaurantName}} team.\n\nSomeone will be with you shortly to help you with the payment.\n\nThank you for your preference! 🙏',
        fr: "✅ Parfait, j'ai informé l'équipe de {{restaurantName}}.\n\nQuelqu'un viendra vous voir rapidement pour vous aider avec le paiement.\n\nMerci de votre préférence! 🙏",
        ko: '✅ 완벽합니다, {{restaurantName}} 팀에 알렸습니다.\n\n곧 누군가 결제를 도와드리러 갈 것입니다.\n\n선택해 주셔서 감사합니다! 🙏',
      },
      variables: ['restaurantName'],
      category: 'payment',
      isActive: true,
    };

    // Insertar todos los templates
    const templates = [
      languageConfirmTemplate,
      locationConfirmTemplate,
      orderConfirmedToKitchenTemplate,
      checkTotalTemplate,
      paymentConfirmedTemplate,
    ];

    for (const template of templates) {
      await queryRunner.query(
        `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt") 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          template.key,
          template.name,
          template.description,
          JSON.stringify(template.content),
          JSON.stringify(template.variables),
          template.category,
          template.isActive,
        ],
      );
    }

    console.log('Flow optimization templates created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN (
                'language.confirm',
                'location.confirm',
                'order.confirmed_to_kitchen',
                'order.check_total',
                'payment.confirmed'
            )`,
    );
  }
}
