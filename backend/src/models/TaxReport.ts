import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class TaxReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('decimal')
  amount!: number;

  @Column()
  currency!: string;

  @Column()
  taxPeriod!: string;

  @Column()
  status!: string;
}
