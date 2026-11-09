import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Matches,
} from 'class-validator';

/** Canaux Charge mobile money (aucune carte : decision produit). */
export enum MobileMoneyProvider {
  MTN = 'mtn',
  ORANGE = 'orange',
  WAVE = 'wave',
}

export class InitializePaymentDto {
  @IsInt({ message: 'Le montant doit etre un entier en XOF.' })
  @IsPositive({ message: 'Le montant doit etre strictement positif.' })
  amountXof!: number;

  /**
   * Canal Charge mobile money (optionnel). Sans provider, l'ancien flux
   * transaction/initialize + checkout est conserve.
   */
  @IsOptional()
  @IsEnum(MobileMoneyProvider, {
    message: "Le fournisseur doit etre l'un de : mtn, orange, wave.",
  })
  provider?: MobileMoneyProvider;

  /**
   * Numero mobile au format E.164 ivoirien strict : 225 suivi de 10
   * chiffres. Requis quand provider est fourni (canal Charge).
   */
  @IsOptional()
  @Matches(/^225\d{10}$/, {
    message:
      'Le numero mobile doit etre au format E.164 ivoirien : 225 suivi de 10 chiffres.',
  })
  phone?: string;
}
