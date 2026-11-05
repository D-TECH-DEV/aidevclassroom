import { IsInt, IsPositive } from 'class-validator';

export class InitializePaymentDto {
  @IsInt({ message: 'Le montant doit etre un entier en XOF.' })
  @IsPositive({ message: 'Le montant doit etre strictement positif.' })
  amountXof!: number;
}
