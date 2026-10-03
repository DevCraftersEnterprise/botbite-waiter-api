import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Bug Fix Templates
 * Fixes:
 *  - Bug #1: menu.pdf_link template for menus with PDF
 *  - Bug #3/7: order.request_bill now includes tableLocation variable
 *  - Bug #8: product.not_available template for products not in menu
 */
export class AddBugFixTemplates1773500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Template: product.not_available
    const productNotAvailableTemplate = {
      key: 'product.not_available',
      name: 'Producto No Disponible',
      description: 'Informa que el producto solicitado no está en el menú',
      content: {
        es: 'Lo siento, *{{productName}}* no está disponible en nuestro menú en este momento.\n\n¿Te gustaría ver otras opciones o puedo recomendarte algo similar?',
        en: 'Sorry, *{{productName}}* is not available on our menu at this time.\n\nWould you like to see other options or can I recommend something similar?',
        fr: "Désolé, *{{productName}}* n'est pas disponible sur notre menu en ce moment.\n\nSouhaitez-vous voir d'autres options ou puis-je vous recommander quelque chose de similaire?",
        ko: '죄송합니다, *{{productName}}*은(는) 현재 저희 메뉴에서 제공되지 않습니다.\n\n다른 옵션을 보시겠습니까, 아니면 비슷한 것을 추천해드릴까요?',
      },
      variables: ['productName'],
      category: 'product',
      isActive: true,
    };

    // 2. Template: menu.pdf_link (for menus that have a PDF)
    const menuPdfLinkTemplate = {
      key: 'menu.pdf_link',
      name: 'Menú en PDF',
      description: 'Envía el enlace del menú en PDF cuando está disponible',
      content: {
        es: '[SEND_IMAGE:{{pdfLink}}]\nAquí tienes nuestro menú completo.\n\n¿Ya sabes qué quieres ordenar? 📝\nSi necesitas información sobre algún platillo, no dudes en preguntar.',
        en: '[SEND_IMAGE:{{pdfLink}}]\nHere is our complete menu.\n\nDo you already know what you want to order? 📝\nIf you need information about any dish, feel free to ask.',
        fr: "[SEND_IMAGE:{{pdfLink}}]\nVoici notre menu complet.\n\nSavez-vous déjà ce que vous voulez commander? 📝\nSi vous avez besoin d'informations sur un plat, n'hésitez pas à demander.",
        ko: '[SEND_IMAGE:{{pdfLink}}]\n전체 메뉴입니다.\n\n주문하실 것을 이미 알고 계신가요? 📝\n특정 요리에 대한 정보가 필요하시면 편하게 물어보세요.',
      },
      variables: ['pdfLink'],
      category: 'menu',
      isActive: true,
    };

    // 3. Update order.request_bill: remove [id] format, add tableLocation
    const updatedBillContent = {
      es: '🧾 Aquí está tu cuenta para {{tableLocation}}:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Cómo te gustaría pagar?\n\n• Efectivo\n• Tarjeta\n• Transferencia',
      en: '🧾 Here is your bill for {{tableLocation}}:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nHow would you like to pay?\n\n• Cash\n• Card\n• Transfer',
      fr: '🧾 Voici votre addition pour {{tableLocation}}:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nComment souhaitez-vous payer?\n\n• Espèces\n• Carte\n• Virement',
      ko: '🧾 {{tableLocation}} 계산서입니다:\n\n{{#each items}}• {{this.name}} - {{this.quantity}}x ${{this.unitPrice}} = ${{this.subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 총액: ${{total}}\n\n어떻게 결제하시겠습니까?\n\n• 현금\n• 카드\n• 이체',
    };

    // Insert product.not_available
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET
         content = EXCLUDED.content,
         variables = EXCLUDED.variables,
         "updatedAt" = NOW()`,
      [
        productNotAvailableTemplate.key,
        productNotAvailableTemplate.name,
        productNotAvailableTemplate.description,
        JSON.stringify(productNotAvailableTemplate.content),
        JSON.stringify(productNotAvailableTemplate.variables),
        productNotAvailableTemplate.category,
        productNotAvailableTemplate.isActive,
      ],
    );

    // Insert menu.pdf_link
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET
         content = EXCLUDED.content,
         variables = EXCLUDED.variables,
         "updatedAt" = NOW()`,
      [
        menuPdfLinkTemplate.key,
        menuPdfLinkTemplate.name,
        menuPdfLinkTemplate.description,
        JSON.stringify(menuPdfLinkTemplate.content),
        JSON.stringify(menuPdfLinkTemplate.variables),
        menuPdfLinkTemplate.category,
        menuPdfLinkTemplate.isActive,
      ],
    );

    // Update order.request_bill to include tableLocation and fix item format
    await queryRunner.query(
      `UPDATE templates
       SET content = $1, variables = $2, "updatedAt" = NOW()
       WHERE key = 'order.request_bill'`,
      [
        JSON.stringify(updatedBillContent),
        JSON.stringify(['items', 'total', 'tableLocation']),
      ],
    );

    console.log('Bug fix templates applied successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN ('product.not_available', 'menu.pdf_link')`,
    );

    // Restore original order.request_bill
    const originalBillContent = {
      es: '🧾 Aquí está tu cuenta:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Cómo te gustaría pagar?',
      en: '🧾 Here is your bill:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nHow would you like to pay?',
    };

    await queryRunner.query(
      `UPDATE templates SET content = $1, variables = $2, "updatedAt" = NOW() WHERE key = 'order.request_bill'`,
      [JSON.stringify(originalBillContent), JSON.stringify(['items', 'total'])],
    );
  }
}
