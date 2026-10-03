import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderTemplates1771557255500 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const templates = [
      {
        key: 'order.items_added',
        name: 'Items Agregados al Pedido',
        description: 'Confirma items agregados con formato estructurado',
        content: {
          es: '✅ He agregado a tu pedido:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Nota: {{notes}}\n{{/if}}{{/each}}\n💰 Subtotal actual: ${{currentTotal}}\n\n¿Deseas agregar algo más o confirmar el pedido?',
          en: '✅ I have added to your order:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Note: {{notes}}\n{{/if}}{{/each}}\n💰 Current subtotal: ${{currentTotal}}\n\nWould you like to add something else or confirm the order?',
        },
        variables: ['items', 'currentTotal'],
        category: 'order',
        isActive: true,
      },
      {
        key: 'order.request_bill',
        name: 'Solicitud de Cuenta',
        description: 'Muestra resumen de cuenta solicitada',
        content: {
          es: '🧾 Aquí está tu cuenta:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Cómo te gustaría pagar?',
          en: '🧾 Here is your bill:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nHow would you like to pay?',
        },
        variables: ['items', 'total'],
        category: 'order',
        isActive: true,
      },
      {
        key: 'order.separate_bills_detailed',
        name: 'Cuentas Separadas Detalladas',
        description: 'Muestra cuentas separadas con formato estructurado',
        content: {
          es: '✅ He dividido las cuentas:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   [{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Total general: ${{grandTotal}}',
          en: '✅ I have split the bills:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   [{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Grand total: ${{grandTotal}}',
        },
        variables: ['bills', 'grandTotal'],
        category: 'order',
        isActive: true,
      },
      {
        key: 'order.modify_item',
        name: 'Modificar Item del Pedido',
        description: 'Confirma modificación de un item',
        content: {
          es: '✏️ He modificado tu pedido:\n\n{{#if removed}}❌ Eliminado: [{{item.id}}] {{item.name}}\n{{/if}}{{#if updated}}🔄 Actualizado: [{{item.id}}] {{item.name}}\n   Cantidad: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 Nuevo total: ${{currentTotal}}',
          en: '✏️ I have modified your order:\n\n{{#if removed}}❌ Removed: [{{item.id}}] {{item.name}}\n{{/if}}{{#if updated}}🔄 Updated: [{{item.id}}] {{item.name}}\n   Quantity: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 New total: ${{currentTotal}}',
        },
        variables: [
          'removed',
          'updated',
          'item',
          'oldQuantity',
          'newQuantity',
          'oldTotal',
          'newTotal',
          'currentTotal',
        ],
        category: 'order',
        isActive: true,
      },
      {
        key: 'order.empty_cart',
        name: 'Carrito Vacío',
        description: 'Indica que no hay items en el pedido',
        content: {
          es: '🛒 Tu pedido está vacío.\n\n¿Te gustaría ver el menú o que te recomiende algo?',
          en: '🛒 Your order is empty.\n\nWould you like to see the menu or get some recommendations?',
        },
        variables: [],
        category: 'order',
        isActive: true,
      },
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

    console.log('Order templates added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN ('order.items_added', 'order.request_bill', 'order.separate_bills_detailed', 'order.modify_item', 'order.empty_cart')`,
    );
  }
}
