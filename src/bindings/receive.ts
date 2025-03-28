import {
  IPayjoinReceiver,
  IUncheckedProposal,
  IMaybeInputsOwned,
  IMaybeInputsSeen,
  IOutputsUnknown,
  IWantsOutputs,
  IWantsInputs,
  IProvisionalProposal,
  IPayjoinProposal,
  IInputPairRequest,
  IReplacementOutput,
} from '../types';
import { PayjoinRequest } from './request';
import { PayjoinOhttpKeys } from './io';
import native from '../native';
import { UriBuilder } from './uri';

export class PayjoinReceiver implements IPayjoinReceiver {
  private readonly internal: any;

  constructor(
    address: string,
    directory: string,
    ohttpKeys: Uint8Array, // PayjoinOhttpKeys.toBytes()
    ohttpRelay: string,
    expirySeconds?: bigint
  ) {
    try {
      this.internal = new native.PayjoinReceiver(
        address,
        directory,
        ohttpKeys,
        ohttpRelay,
        expirySeconds
      );
    } catch (error) {
      throw new Error(`Failed to create PayjoinReceiver: ${error}`);
    }
  }

  toJson(): string {
    try {
      return this.internal.toJson();
    } catch (error) {
      throw new Error(`Failed to serialize receiver: ${error}`);
    }
  }

  static fromJson(json: string): PayjoinReceiver {
    try {
      const internal = native.PayjoinReceiver.fromJson(json);
      const receiver = Object.create(PayjoinReceiver.prototype);
      receiver.internal = internal;

      return receiver;
    } catch (error) {
      throw new Error(`Failed to deserialize receiver: ${error}`);
    }
  }

  pjUrl(): string {
    return this.internal.pjUrl();
  }

  pjUriBuilder(): UriBuilder {
    const uri = this.internal.pjUriBuilder();
    return uri;
}

  extractRequest(): PayjoinRequest {
    try {
      const request = this.internal.extractRequest();
      return new PayjoinRequest(request);
    } catch (error) {
      throw new Error(`Failed to extract request: ${error}`);
    }
  }

  async processResponse(
    response: Uint8Array,
    request: PayjoinRequest
  ): Promise<UncheckedProposal | null> {
    try {
      console.error('request', request);
      const result = await this.internal.processResponse(response, request.nativeHandle);
      console.error('processResponse result', result);
      return result ? new UncheckedProposal(result) : null;
    } catch (error) {
      console.error("error", error);
      throw new Error(`Failed to process response: ${error}`);
    }
  }
}

export class UncheckedProposal implements IUncheckedProposal {
  constructor(private readonly internal: any) {}

  originalTx(): string {
    try {
      return this.internal.originalTx();
    } catch (error) {
      throw new Error(`Failed to get original transaction: ${error}`);
    }
  }

  async checkBroadcastSuitability(
    minFeeRate: number | null,
    canBroadcast: (tx: string) => Promise<boolean>
  ): Promise<MaybeInputsOwned> {
    try {
      const result = await this.internal.checkBroadcastSuitability(
        minFeeRate,
        canBroadcast
      );
      return new MaybeInputsOwned(result);
    } catch (error) {
      throw new Error(`Failed to check broadcast suitability: ${error}`);
    }
  }

  assumeInteractiveReceiver(): MaybeInputsOwned {
    try {
      return new MaybeInputsOwned(this.internal.assumeInteractiveReceiver());
    } catch (error) {
      throw new Error(`Failed to assume interactive receiver: ${error}`);
    }
  }
}

export class MaybeInputsOwned implements IMaybeInputsOwned {
  constructor(private readonly internal: any) {}

  async checkInputsNotOwned(
    isOwned: (script: Uint8Array) => Promise<boolean>
  ): Promise<MaybeInputsSeen> {
    try {
      const result = await this.internal.checkInputsNotOwned(isOwned);
      return new MaybeInputsSeen(result);
    } catch (error) {
      throw new Error(`Failed to check inputs not owned: ${error}`);
    }
  }
}

export class MaybeInputsSeen implements IMaybeInputsSeen {
  constructor(private readonly internal: any) {}

  async checkNoInputsSeenBefore(
    isKnown: (outpoint: string) => Promise<boolean>
  ): Promise<OutputsUnknown> {
    try {
      const result = await this.internal.checkNoInputsSeenBefore(isKnown);
      return new OutputsUnknown(result);
    } catch (error) {
      throw new Error(`Failed to check inputs seen before: ${error}`);
    }
  }
}

export class OutputsUnknown implements IOutputsUnknown {
  constructor(private readonly internal: any) {}

  async identifyReceiverOutputs(
    isReceiverOutput: (script: Uint8Array) => Promise<boolean>
  ): Promise<WantsOutputs> {
    try {
      const result = await this.internal.identifyReceiverOutputs(isReceiverOutput);
      return new WantsOutputs(result);
    } catch (error) {
      throw new Error(`Failed to identify receiver outputs: ${error}`);
    }
  }
}

export class WantsOutputs implements IWantsOutputs {
  constructor(private readonly internal: any) {}

  isOutputSubstitutionDisabled(): boolean {
    return this.internal.isOutputSubstitutionDisabled();
  }

  async substituteReceiverScript(outputScript: Uint8Array): Promise<WantsOutputs> {
    try {
      const result = await this.internal.substituteReceiverScript(outputScript);
      return new WantsOutputs(result);
    } catch (error) {
      throw new Error(`Failed to substitute receiver script: ${error}`);
    }
  }

  async replaceReceiverOutputs(
    replacementOutputs: [Uint8Array, number][],
    drainScript: Uint8Array
  ): Promise<WantsOutputs> {
    try {
      const result = await this.internal.replaceReceiverOutputs(
        replacementOutputs,
        drainScript
      );
      return new WantsOutputs(result);
    } catch (error) {
      throw new Error(`Failed to replace receiver outputs: ${error}`);
    }
  }

  commitOutputs(): WantsInputs {
    try {
      return new WantsInputs(this.internal.commitOutputs());
    } catch (error) {
      throw new Error(`Failed to commit outputs: ${error}`);
    }
  }
}

export class WantsInputs implements IWantsInputs {
  constructor(private readonly internal: any) {}

  async tryContributeInputs(
    candidateInputs: IInputPairRequest[]
  ): Promise<ProvisionalProposal> {
    try {
      const result = await this.internal.tryContributeInputs(candidateInputs);
      return new ProvisionalProposal(result);
    } catch (error) {
      throw new Error(`Failed to contribute inputs: ${error}`);
    }
  }
}

export class ProvisionalProposal implements IProvisionalProposal {
  constructor(private readonly internal: any) {}

  async finalizeProposal(
    walletProcessPsbt: (psbt: string) => Promise<string>,
    minFeerateSatPerVb: number | null,
    maxFeerateSatPerVb: number
  ): Promise<PayjoinProposal> {
    try {
      const result = await this.internal.finalizeProposal(
        walletProcessPsbt,
        minFeerateSatPerVb,
        maxFeerateSatPerVb
      );
      return new PayjoinProposal(result);
    } catch (error) {
      throw new Error(`Failed to finalize proposal: ${error}`);
    }
  }
}

export class PayjoinProposal implements IPayjoinProposal {
  constructor(private readonly internal: any) {}

  utxosToLocked(): string[] {
    return this.internal.utxosToLocked();
  }

  isOutputSubstitutionDisabled(): boolean {
    return this.internal.isOutputSubstitutionDisabled();
  }

  psbt(): string {
    return this.internal.psbt();
  }

  async extractV2Req(): Promise<PayjoinRequest> {
    try {
      const result = await this.internal.extractV2Req();
      return new PayjoinRequest(result);
    } catch (error) {
      throw new Error(`Failed to extract v2 request: ${error}`);
    }
  }

  async processRes(response: Uint8Array, request: PayjoinRequest): Promise<PayjoinProposal> {
    try {
      await this.internal.processRes(response, request.nativeHandle);
      return this;
    } catch (error) {
      throw new Error(`Failed to process response: ${error}`);
    }
  }
}