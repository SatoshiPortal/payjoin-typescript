import { 
    IPayjoinSenderBuilder,
    IPayjoinSender,
} from '../types';
import { PayjoinRequest } from './request';
import native from '../native';

  
  export class PayjoinSenderBuilder implements IPayjoinSenderBuilder {
    private readonly internal: any;

    constructor(psbt: string, uri: string) {
      try {
        this.internal = new native.PayjoinSenderBuilder(psbt, uri);
      } catch (error) {
        throw new Error(`Failed to create PayjoinReceiver: ${error}`);
      }
    }
  
    static fromPsbtAndUri(psbt: string, uri: string): PayjoinSenderBuilder {
      try {
        const internal = native.PayjoinSenderBuilder.fromPsbtAndUri(psbt, uri);
        const builder = Object.create(PayjoinSenderBuilder.prototype);
        builder.internal = internal;
  
        return builder;
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

    toJson(): string {
      return this.internal.toJson();
    }

    static fromJson(json: string): PayjoinSender {
      try {
        const internal = native.PayjoinSender.fromJson(json);
        const sender = Object.create(PayjoinSender.prototype);
        sender.internal = internal;

        return sender;
      } catch (error) {
        throw new Error(`Failed to deserialize sender: ${error}`);
      }
    }
  }
