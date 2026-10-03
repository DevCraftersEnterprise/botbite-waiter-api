import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemAddedTemplates1772905000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Template para agregar producto SIN notas
    const itemAddedTemplate = {
      key: 'order.item_added',
      name: 'Producto Agregado al Pedido',
      description:
        'Confirma que se agregó un producto y muestra el pedido completo actualizado',
      content: {
        es: 'He agregado:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}}\n\nTu pedido completo actualizado:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Nota: {{this.notes}}]{{/if}}\n{{/each}}\n¿Deseas agregar algo más?\n\nSí, para continuar ordenando\nNo, para confirmar la orden',
        en: 'I added:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}}\n\nYour complete updated order:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\nWould you like to add something else?\n\nYes, to continue ordering\nNo, to confirm the order',
        fr: "J'ai ajouté:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}}\n\nVotre commande complète mise à jour:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\nSouhaitez-vous ajouter autre chose?\n\nOui, pour continuer à commander\nNon, pour confirmer la commande",
        ko: '추가했습니다:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}}\n\n업데이트된 전체 주문:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [메모: {{this.notes}}]{{/if}}\n{{/each}}\n다른 것을 추가하시겠습니까?\n\n예, 계속 주문하기\n아니오, 주문 확인',
      },
      variables: ['addedProduct', 'completeOrder'],
      category: 'order',
      isActive: true,
    };

    // Template para agregar producto CON notas
    const itemAddedWithNoteTemplate = {
      key: 'order.item_added_with_note',
      name: 'Producto con Nota Agregado al Pedido',
      description:
        'Confirma que se agregó un producto con notas especiales y muestra el pedido completo',
      content: {
        es: 'He agregado:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}} [Nota: {{addedProduct.notes}}]\n\nTu pedido completo actualizado:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Nota: {{this.notes}}]{{/if}}\n{{/each}}\n¿Deseas agregar algo más?\n\nSí, para continuar ordenando\nNo, para confirmar la orden',
        en: 'I added:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}} [Note: {{addedProduct.notes}}]\n\nYour complete updated order:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\nWould you like to add something else?\n\nYes, to continue ordering\nNo, to confirm the order',
        fr: "J'ai ajouté:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}} [Note: {{addedProduct.notes}}]\n\nVotre commande complète mise à jour:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [Note: {{this.notes}}]{{/if}}\n{{/each}}\nSouhaitez-vous ajouter autre chose?\n\nOui, pour continuer à commander\nNon, pour confirmer la commande",
        ko: '추가했습니다:\n• [ID:{{addedProduct.menuItemId}}] {{addedProduct.name}} ({{addedProduct.category}}): ${{addedProduct.price}} x {{addedProduct.quantity}} = ${{addedProduct.subtotal}} [메모: {{addedProduct.notes}}]\n\n업데이트된 전체 주문:\n{{#each completeOrder}}• [ID:{{this.menuItemId}}] {{this.name}} ({{this.category}}): ${{this.price}} x {{this.quantity}} = ${{this.subtotal}}{{#if this.notes}} [메모: {{this.notes}}]{{/if}}\n{{/each}}\n다른 것을 추가하시겠습니까?\n\n예, 계속 주문하기\n아니오, 주문 확인',
      },
      variables: ['addedProduct', 'completeOrder'],
      category: 'order',
      isActive: true,
    };

    // Insertar template sin notas
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        itemAddedTemplate.key,
        itemAddedTemplate.name,
        itemAddedTemplate.description,
        JSON.stringify(itemAddedTemplate.content),
        JSON.stringify(itemAddedTemplate.variables),
        itemAddedTemplate.category,
        itemAddedTemplate.isActive,
      ],
    );

    // Insertar template con notas
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt") 
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        itemAddedWithNoteTemplate.key,
        itemAddedWithNoteTemplate.name,
        itemAddedWithNoteTemplate.description,
        JSON.stringify(itemAddedWithNoteTemplate.content),
        JSON.stringify(itemAddedWithNoteTemplate.variables),
        itemAddedWithNoteTemplate.category,
        itemAddedWithNoteTemplate.isActive,
      ],
    );

    console.log('Order item added templates created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN ('order.item_added', 'order.item_added_with_note')`,
    );
  }
}
