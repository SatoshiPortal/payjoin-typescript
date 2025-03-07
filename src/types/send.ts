import { IPayjoinRequest } from "./index";

export interface IPayjoinSenderBuilder {
  disableOutputSubstitution(disable: boolean): IPayjoinSenderBuilder;
  buildRecommended(minFeeRateSatPerVb: number): Promise<IPayjoinSender>;
  buildWithAdditionalFee(
    maxFeeContributionSats: number,
    changeIndex: number | null,
    minFeeRateSatPerVb: number,
    clampFeeContribution: boolean
  ): Promise<IPayjoinSender>;
}

export interface IPayjoinSender {
  extractV2(ohttpRelay: string): Promise<IPayjoinRequest>;
}