import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class MarketplaceListing {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  businessId!: number;

  @Column()
  category!: string;

  @Column('boolean')
  isActive!: boolean;
}
