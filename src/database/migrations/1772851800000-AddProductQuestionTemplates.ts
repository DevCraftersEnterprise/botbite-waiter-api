import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductQuestionTemplates1772851800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const templates = [
      {
        key: 'product.ask_with_photo',
        name: 'Pregunta sobre Producto con Foto',
        description:
          'Respuesta cuando el cliente pregunta por un producto que tiene foto disponible',
        content: {
          es: 'Los *{{productName}}* son {{description}}.\n\n¿Te gustaría ver una foto de los *{{productName}}*?',
          en: 'The *{{productName}}* are {{description}}.\n\nWould you like to see a photo of the *{{productName}}*?',
          fr: 'Les *{{productName}}* sont {{description}}.\n\nSouhaitez-vous voir une photo des *{{productName}}*?',
          ko: '*{{productName}}*는(은) {{description}}입니다.\n\n*{{productName}}*의 사진을 보시겠습니까?',
        },
        variables: ['productName', 'description'],
        category: 'product',
        isActive: true,
      },
      {
        key: 'product.ask_without_photo',
        name: 'Pregunta sobre Producto sin Foto',
        description:
          'Respuesta cuando el cliente pregunta por un producto que NO tiene foto',
        content: {
          es: 'Los *{{productName}}* son {{description}}.\n\n¿Deseas agregar los *{{productName}}* a tu pedido?',
          en: 'The *{{productName}}* are {{description}}.\n\nWould you like to add *{{productName}}* to your order?',
          fr: 'Les *{{productName}}* sont {{description}}.\n\nSouhaitez-vous ajouter *{{productName}}* à votre commande?',
          ko: '*{{productName}}*는(은) {{description}}입니다.\n\n*{{productName}}*를(을) 주문에 추가하시겠습니까?',
        },
        variables: ['productName', 'description'],
        category: 'product',
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

    console.log('Product question templates added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key IN ('product.ask_with_photo', 'product.ask_without_photo')`,
    );
  }
}
