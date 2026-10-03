import { CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * MessageSid de los webhooks de Twilio ya recibidos. Twilio reintenta el
 * webhook si no responde a tiempo; este registro evita procesar (y cobrar,
 * y notificar a caja) el mismo mensaje dos veces.
 */
@Entity({ name: 'processed_messages' })
export class ProcessedMessage {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  messageSid: string;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
