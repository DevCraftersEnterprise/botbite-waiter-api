import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductPhotoTemplate1772849000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const template = {
      key: 'product.send_photo',
      name: 'Enviar Foto de Producto',
      description: 'Envía la foto de un producto y pregunta si desea agregarlo',
      content: {
        es: '[SEND_IMAGE:{{imageUrl}}]\nAquí tienes la foto.\n\n¿Deseas agregar los *{{productName}}* a tu pedido?',
        en: '[SEND_IMAGE:{{imageUrl}}]\nHere is the photo.\n\nWould you like to add *{{productName}}* to your order?',
        fr: '[SEND_IMAGE:{{imageUrl}}]\nVoici la photo.\n\nSouhaitez-vous ajouter *{{productName}}* à votre commande?',
        ko: '[SEND_IMAGE:{{imageUrl}}]\n사진입니다.\n\n*{{productName}}*를(을) 주문에 추가하시겠습니까?',
      },
      variables: ['imageUrl', 'productName'],
      category: 'product',
      isActive: true,
    };

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

    console.log('Product photo template added successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM templates WHERE key = 'product.send_photo'`,
    );
  }
}
