import { 
    IPayjoinSenderBuilder,
    IPayjoinSender,
} from '../types';
import { PayjoinRequest } from './request';
import native from '../native';

  
  export class PayjoinSenderBuilder implements IPayjoinSenderBuilder {
    private readonly internal: any;

    constructor(internal: any) {
        this.internal = internal;
    }
  
    static fromPsbtAndUri(psbt: string, uri: string): PayjoinSenderBuilder {
      try {
        const internal = new native.PayjoinSenderBuilder(psbt, uri);
        return new PayjoinSenderBuilder(internal);
      } catch (error) {
        throw new Error(`Failed to create PayjoinSenderBuilder: ${error}`);
      }
    }
  
    disableOutputSubstitution(disable: boolean): PayjoinSenderBuilder {
      try {
        this.internal.disableOutputSubstitution(disable);
        return this;
      } catch (error) {
        throw new Error(`Failed to disable output substitution: ${error}`);
      }
    }
  
    async buildRecommended(minFeeRateSatPerVb: number): Promise<PayjoinSender> {
      try {
        const sender = await this.internal.buildRecommended(minFeeRateSatPerVb);
        return new PayjoinSender(sender);
      } catch (error) {
        throw new Error(`Failed to build recommended sender: ${error}`);
      }
    }
  
    async buildWithAdditionalFee(
      maxFeeContributionSats: number,
      changeIndex: number | null,
      minFeeRateSatPerVb: number,
      clampFeeContribution: boolean
    ): Promise<PayjoinSender> {
      try {
        const sender = await this.internal.buildWithAdditionalFee(
          maxFeeContributionSats,
          changeIndex,
          minFeeRateSatPerVb,
          clampFeeContribution
        );
        return new PayjoinSender(sender);
      } catch (error) {
        throw new Error(`Failed to build sender with additional fee: ${error}`);
      }
    }
  }
  
  export class PayjoinSender implements IPayjoinSender {
    private readonly internal: any;

    constructor(internal: any) {
        this.internal = internal;
    }
  
    async extractV2(ohttpRelay: string): Promise<PayjoinRequest> {
      try {
        const request = await this.internal.extractV2(ohttpRelay);
        return new PayjoinRequest(request);
      } catch (error) {
        throw new Error(`Failed to extract v2 request: ${error}`);
      }
    }
  }
