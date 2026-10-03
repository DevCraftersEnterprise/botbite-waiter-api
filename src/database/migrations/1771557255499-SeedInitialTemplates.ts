import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedInitialTemplates1771557255499 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar si ya existen plantillas
    const existingTemplates = await queryRunner.query(
      'SELECT COUNT(*) as count FROM templates',
    );

    if (existingTemplates[0].count > 0) {
      console.log('Templates already exist, skipping seed...');
      return;
    }

    // Insertar plantillas iniciales usando parámetros
    const templates = [
      {
        key: 'product.single',
        name: 'Información de Producto Individual',
        description: 'Muestra información de un solo producto',
        content: {
          es: '🍽️ {{productName}}\n\n{{description}}\n\n💰 Precio: ${{price}}\n\n{{#if available}}✅ Disponible{{else}}❌ No disponible{{/if}}',
          en: '🍽️ {{productName}}\n\n{{description}}\n\n💰 Price: ${{price}}\n\n{{#if available}}✅ Available{{else}}❌ Not available{{/if}}',
        },
        variables: ['productName', 'description', 'price', 'available'],
        category: 'product',
      },
      {
        key: 'product.multiple',
        name: 'Lista de Productos',
        description: 'Muestra múltiples productos',
        content: {
          es: 'Aquí están los productos que buscas:\n\n{{#each products}}{{@index}}. 🍽️ {{name}}\n   💰 ${{price}}\n   {{description}}\n\n{{/each}}¿Te gustaría ordenar alguno?',
          en: 'Here are the products you are looking for:\n\n{{#each products}}{{@index}}. 🍽️ {{name}}\n   💰 ${{price}}\n   {{description}}\n\n{{/each}}Would you like to order any?',
        },
        variables: ['products'],
        category: 'product',
      },
      {
        key: 'order.separate_bills',
        name: 'Confirmación de Cuentas Separadas',
        description: 'Confirma orden con cuentas separadas',
        content: {
          es: '✅ Perfecto, {{customerName}}. He registrado tu pedido con cuentas separadas:\n\n{{#each items}}👤 {{customerName}}:\n{{#each products}}  • {{name}} x{{quantity}} - ${{price}}\n{{/each}}  Subtotal: ${{subtotal}}\n\n{{/each}}Total general: ${{total}}\n\n¿Confirmas el pedido?',
          en: '✅ Perfect, {{customerName}}. I have registered your order with separate bills:\n\n{{#each items}}👤 {{customerName}}:\n{{#each products}}  • {{name}} x{{quantity}} - ${{price}}\n{{/each}}  Subtotal: ${{subtotal}}\n\n{{/each}}Grand total: ${{total}}\n\nDo you confirm the order?',
        },
        variables: ['customerName', 'items', 'total'],
        category: 'order',
      },
      {
        key: 'order.confirmation',
        name: 'Confirmación de Orden',
        description: 'Confirma una orden completa',
        content: {
          es: '✅ ¡Pedido confirmado!\n\n📋 Orden #{{orderNumber}}\n{{#each items}}• {{name}} x{{quantity}} - ${{price}}\n{{/each}}\n💰 Total: ${{total}}\n\n⏱️ Tiempo estimado: {{estimatedTime}} minutos\n\n¡Gracias por tu pedido!',
          en: '✅ Order confirmed!\n\n📋 Order #{{orderNumber}}\n{{#each items}}• {{name}} x{{quantity}} - ${{price}}\n{{/each}}\n💰 Total: ${{total}}\n\n⏱️ Estimated time: {{estimatedTime}} minutes\n\nThank you for your order!',
        },
        variables: ['orderNumber', 'items', 'total', 'estimatedTime'],
        category: 'order',
      },
      {
        key: 'greeting.initial',
        name: 'Saludo Inicial',
        description: 'Saludo para nuevos clientes',
        content: {
          es: '👋 ¡Hola! Bienvenido a {{restaurantName}}.\n\nSoy tu asistente virtual y estoy aquí para ayudarte. Puedes:\n• Ver el menú\n• Hacer un pedido\n• Consultar promociones\n• Pedir recomendaciones\n\n¿En qué puedo ayudarte hoy?',
          en: '👋 Hello! Welcome to {{restaurantName}}.\n\nI am your virtual assistant and I am here to help you. You can:\n• View the menu\n• Place an order\n• Check promotions\n• Ask for recommendations\n\nHow can I help you today?',
        },
        variables: ['restaurantName'],
        category: 'greeting',
      },
      {
        key: 'greeting.returning',
        name: 'Saludo Cliente Frecuente',
        description: 'Saludo para clientes que regresan',
        content: {
          es: '👋 ¡Hola de nuevo, {{customerName}}! 😊\n\n¿Te gustaría ordenar {{lastOrder}} como la última vez, o prefieres ver otras opciones del menú?',
          en: '👋 Hello again, {{customerName}}! 😊\n\nWould you like to order {{lastOrder}} like last time, or do you prefer to see other menu options?',
        },
        variables: ['customerName', 'lastOrder'],
        category: 'greeting',
      },
      {
        key: 'error.general',
        name: 'Error General',
        description: 'Mensaje de error genérico',
        content: {
          es: 'Lo siento, ha ocurrido un error. 😔\n\nPor favor, intenta de nuevo o contacta con nuestro personal si el problema persiste.',
          en: 'Sorry, an error has occurred. 😔\n\nPlease try again or contact our staff if the problem persists.',
        },
        variables: [],
        category: 'error',
      },
      {
        key: 'payment.methods',
        name: 'Métodos de Pago',
        description: 'Muestra métodos de pago disponibles',
        content: {
          es: '💳 Métodos de pago disponibles:\n\n{{#each methods}}• {{name}}{{#if description}} - {{description}}{{/if}}\n{{/each}}\n¿Cómo te gustaría pagar?',
          en: '💳 Available payment methods:\n\n{{#each methods}}• {{name}}{{#if description}} - {{description}}{{/if}}\n{{/each}}\nHow would you like to pay?',
        },
        variables: ['methods'],
        category: 'payment',
      },
      {
        key: 'menu.categories',
        name: 'Categorías del Menú',
        description: 'Muestra las categorías disponibles del menú',
        content: {
          es: '📋 Nuestras categorías de menú:\n\n{{#each categories}}{{@index}}. {{name}}\n{{/each}}\n¿Qué categoría te gustaría explorar?',
          en: '📋 Our menu categories:\n\n{{#each categories}}{{@index}}. {{name}}\n{{/each}}\nWhich category would you like to explore?',
        },
        variables: ['categories'],
        category: 'menu',
      },
      {
        key: 'order.add_item',
        name: 'Agregar Item a la Orden',
        description: 'Confirma que se agregó un item a la orden',
        content: {
          es: '✅ {{productName}} agregado a tu orden\n\nCantidad: {{quantity}}\nPrecio unitario: ${{price}}\nSubtotal: ${{subtotal}}\n\n¿Deseas agregar algo más?',
          en: '✅ {{productName}} added to your order\n\nQuantity: {{quantity}}\nUnit price: ${{price}}\nSubtotal: ${{subtotal}}\n\nWould you like to add something else?',
        },
        variables: ['productName', 'quantity', 'price', 'subtotal'],
        category: 'order',
      },
      {
        key: 'help.general',
        name: 'Ayuda General',
        description: 'Mensaje de ayuda general',
        content: {
          es: '🤖 ¡Estoy aquí para ayudarte!\n\nPuedes preguntarme sobre:\n• Ver el menú y categorías\n• Información de productos\n• Hacer un pedido\n• Estado de tu orden\n• Métodos de pago\n• Promociones disponibles\n\n¿Qué necesitas?',
          en: '🤖 I am here to help you!\n\nYou can ask me about:\n• View menu and categories\n• Product information\n• Place an order\n• Order status\n• Payment methods\n• Available promotions\n\nWhat do you need?',
        },
        variables: [],
        category: 'help',
      },
    ];

    for (const template of templates) {
      await queryRunner.query(
        'INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())',
        [
          template.key,
          template.name,
          template.description,
          JSON.stringify(template.content),
          JSON.stringify(template.variables),
          template.category,
          true,
        ],
      );
    }

    console.log('Initial templates seeded successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE category IN ('product', 'order', 'greeting', 'error', 'payment', 'menu', 'help')`,
    );
  }
}
