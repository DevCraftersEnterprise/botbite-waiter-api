import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixOrderItemsAddedTemplate1772849500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Actualizar order.items_added: Ocultar ID, cambiar "Subtotal actual" a "Total", simplificar pregunta
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✅ He agregado a tu pedido:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Nota: {{notes}}\n{{/if}}{{/each}}\n💰 Total: ${{currentTotal}}\n\n¿Deseas agregar algo más?',
          en: '✅ I have added to your order:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Note: {{notes}}\n{{/if}}{{/each}}\n💰 Total: ${{currentTotal}}\n\nWould you like to add something else?',
          fr: "✅ J'ai ajouté à votre commande:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Note: {{notes}}\n{{/if}}{{/each}}\n💰 Total: ${{currentTotal}}\n\nSouhaitez-vous ajouter autre chose?",
          ko: '✅ 주문에 추가했습니다:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 메모: {{notes}}\n{{/if}}{{/each}}\n💰 총액: ${{currentTotal}}\n\n다른 것을 추가하시겠습니까?',
        }),
        'order.items_added',
      ],
    );

    // 2. Actualizar order.request_bill: Ocultar ID del menuItem
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '🧾 Aquí está tu cuenta:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Cómo te gustaría pagar?',
          en: '🧾 Here is your bill:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nHow would you like to pay?',
          fr: '🧾 Voici votre addition:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nComment souhaitez-vous payer?',
          ko: '🧾 계산서입니다:\n\n{{#each items}}{{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 총액: ${{total}}\n\n어떻게 결제하시겠습니까?',
        }),
        'order.request_bill',
      ],
    );

    // 3. Actualizar order.separate_bills_detailed: Ocultar ID del menuItem
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✅ He dividido las cuentas:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Total general: ${{grandTotal}}',
          en: '✅ I have split the bills:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Grand total: ${{grandTotal}}',
          fr: "✅ J'ai divisé les additions:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Sous-total: ${{subtotal}}\n\n{{/each}}💵 Total général: ${{grandTotal}}",
          ko: '✅ 계산서를 나눴습니다:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 소계: ${{subtotal}}\n\n{{/each}}💵 총액: ${{grandTotal}}',
        }),
        'order.separate_bills_detailed',
      ],
    );

    // 4. Actualizar order.modify_item: Ocultar ID del menuItem
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✏️ He modificado tu pedido:\n\n{{#if removed}}❌ Eliminado: {{item.name}}\n{{/if}}{{#if updated}}🔄 Actualizado: {{item.name}}\n   Cantidad: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 Nuevo total: ${{currentTotal}}',
          en: '✏️ I have modified your order:\n\n{{#if removed}}❌ Removed: {{item.name}}\n{{/if}}{{#if updated}}🔄 Updated: {{item.name}}\n   Quantity: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 New total: ${{currentTotal}}',
          fr: "✏️ J'ai modifié votre commande:\n\n{{#if removed}}❌ Supprimé: {{item.name}}\n{{/if}}{{#if updated}}🔄 Mis à jour: {{item.name}}\n   Quantité: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 Nouveau total: ${{currentTotal}}",
          ko: '✏️ 주문을 수정했습니다:\n\n{{#if removed}}❌ 삭제됨: {{item.name}}\n{{/if}}{{#if updated}}🔄 업데이트됨: {{item.name}}\n   수량: {{oldQuantity}} → {{newQuantity}}\n   총액: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 새 총액: ${{currentTotal}}',
        }),
        'order.modify_item',
      ],
    );

    console.log('All order templates updated successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir order.items_added
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✅ He agregado a tu pedido:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Nota: {{notes}}\n{{/if}}{{/each}}\n💰 Subtotal actual: ${{currentTotal}}\n\n¿Deseas agregar algo más o confirmar el pedido?',
          en: '✅ I have added to your order:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{#if notes}}   📝 Note: {{notes}}\n{{/if}}{{/each}}\n💰 Current subtotal: ${{currentTotal}}\n\nWould you like to add something else or confirm the order?',
        }),
        'order.items_added',
      ],
    );

    // Revertir order.request_bill
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '🧾 Aquí está tu cuenta:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\n¿Cómo te gustaría pagar?',
          en: '🧾 Here is your bill:\n\n{{#each items}}[{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}\n━━━━━━━━━━━━━━━━\n💰 Total: ${{total}}\n\nHow would you like to pay?',
        }),
        'order.request_bill',
      ],
    );

    // Revertir order.separate_bills_detailed
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✅ He dividido las cuentas:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   [{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Total general: ${{grandTotal}}',
          en: '✅ I have split the bills:\n\n{{#each bills}}👤 {{customerName}}:\n{{#each items}}   [{{id}}] {{name}} - {{quantity}}x ${{unitPrice}} = ${{subtotal}}\n{{/each}}   ━━━━━━━━━━━━━━━━\n   💰 Subtotal: ${{subtotal}}\n\n{{/each}}💵 Grand total: ${{grandTotal}}',
        }),
        'order.separate_bills_detailed',
      ],
    );

    // Revertir order.modify_item
    await queryRunner.query(
      `UPDATE templates 
       SET content = $1, 
           "updatedAt" = NOW()
       WHERE key = $2`,
      [
        JSON.stringify({
          es: '✏️ He modificado tu pedido:\n\n{{#if removed}}❌ Eliminado: [{{item.id}}] {{item.name}}\n{{/if}}{{#if updated}}🔄 Actualizado: [{{item.id}}] {{item.name}}\n   Cantidad: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 Nuevo total: ${{currentTotal}}',
          en: '✏️ I have modified your order:\n\n{{#if removed}}❌ Removed: [{{item.id}}] {{item.name}}\n{{/if}}{{#if updated}}🔄 Updated: [{{item.id}}] {{item.name}}\n   Quantity: {{oldQuantity}} → {{newQuantity}}\n   Total: ${{oldTotal}} → ${{newTotal}}\n{{/if}}\n💰 New total: ${{currentTotal}}',
        }),
        'order.modify_item',
      ],
    );
  }
}
