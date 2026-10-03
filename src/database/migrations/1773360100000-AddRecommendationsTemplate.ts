import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationsTemplate1773360100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const content = JSON.stringify({
      es: '👨‍🍳 *Nuestras Recomendaciones Especiales:*\n\n{{#each items}}{{add @index 1}}. 🌟 *{{name}}*\n   {{description}}\n   💰 ${{price}}\n\n{{/each}}¿Te gustaría ordenar alguna de estas opciones?',
      en: '👨‍🍳 *Our Special Recommendations:*\n\n{{#each items}}{{add @index 1}}. 🌟 *{{name}}*\n   {{description}}\n   💰 ${{price}}\n\n{{/each}}Would you like to order any of these options?',
      fr: "👨‍🍳 *Nos Recommandations Spéciales:*\n\n{{#each items}}{{add @index 1}}. 🌟 *{{name}}*\n   {{description}}\n   💰 ${{price}}\n\n{{/each}}Souhaitez-vous commander l'une de ces options?",
      ko: '👨‍🍳 *특별 추천 메뉴:*\n\n{{#each items}}{{add @index 1}}. 🌟 *{{name}}*\n   {{description}}\n   💰 ${{price}}\n\n{{/each}}이 중 하나를 주문하시겠습니까?',
    });

    // Insertar plantilla de recomendaciones
    await queryRunner.query(
      `INSERT INTO templates (key, name, description, content, variables, category, "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        'menu.recommendations',
        'Recomendaciones del Menú',
        'Muestra productos recomendados cuando el cliente pregunta qué recomienda',
        content,
        JSON.stringify(['items']),
        'menu',
        true,
      ],
    );

    console.log('✅ Template menu.recommendations created successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM templates WHERE key = $1`, [
      'menu.recommendations',
    ]);
  }
}
