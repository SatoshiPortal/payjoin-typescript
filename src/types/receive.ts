import { UriBuilder } from "..";
import { IPayjoinRequest } from "./index";

export interface IPayjoinReceiver {
  pjUrl(): string;
  pjUriBuilder(): UriBuilder;
  extractRequest(): IPayjoinRequest;
  processResponse(
    response: Uint8Array, 
    request: IPayjoinRequest
  ): Promise<IUncheckedProposal | null>;
}

export interface IUncheckedProposal {
  originalTx(): string;
  checkBroadcastSuitability(
    minFeeRate: number | null,
    canBoradcast?: (txhex: string) => boolean
  ): Promise<IMaybeInputsOwned>;
  assumeInteractiveReceiver(): IMaybeInputsOwned;
}

export interface IMaybeInputsOwned {
  checkInputsNotOwned(
    isOwned: (script: string) => boolean
  ): Promise<IMaybeInputsSeen>;
}

export interface IMaybeInputsSeen {
  checkNoInputsSeenBefore(
    isKnown: (outpoint: string) => boolean
  ): Promise<IOutputsUnknown>;
}

export interface IOutputsUnknown {
  identifyReceiverOutputs(
    isReceiverOutput: (script: string) => boolean
  ): Promise<IWantsOutputs>;
}

export interface IReplacementOutput {
  script: Uint8Array;
  value: bigint;
}

export interface IWantsOutputs {
  isOutputSubstitutionDisabled(): boolean;
  substituteReceiverScript(outputScript: Uint8Array): Promise<IWantsOutputs>;
  replaceReceiverOutputs(
    replacementOutputs: Array<[Uint8Array, number]>,
    drainScript: Uint8Array
  ): Promise<IWantsOutputs>;
  commitOutputs(): IWantsInputs;
}

export interface IPartialSigData {
  pubkey: Uint8Array;
  signature: Uint8Array;
}

export interface IBip32DerivationData {
  pubkey: Uint8Array;
  fingerprint_path: Uint8Array;
  child: number;
}

export interface IWitnessUtxoData {
  amount: number;
  script_pub_key: string;
}

export interface IPsbtInputData {
  non_witness_utxo?: Uint8Array;
  witness_utxo?: IWitnessUtxoData;
  partial_sigs?: IPartialSigData[];
  sighash_type?: number;
  redeem_script?: Uint8Array;
  witness_script?: Uint8Array;
  bip32_derivation?: IBip32DerivationData[];
  final_script_sig?: Uint8Array;
  final_script_witness?: Uint8Array[];
}

export interface ITxOutpoint {
  txid: string;
  vout: number;
}

export interface IInputPairRequest {
  prevout: ITxOutpoint;
  script_sig: Uint8Array;
  witness: Uint8Array[];
  sequence: number;
  psbt_data: IPsbtInputData;
}

export interface IWantsInputs {
  tryContributeInputs(
    candidateInputs: IInputPairRequest[]
  ): Promise<IProvisionalProposal>;
}

export interface IProvisionalProposal {
  finalizeProposal(
    minFeerateSatPerVb: number | null,
    maxFeerateSatPerVb: number,
    walletProcessPsbt: (psbt: string) => string
  ): Promise<IPayjoinProposal>;
}

export interface IPayjoinProposal {
  utxosToBeLocked(): string[];
  isOutputSubstitutionDisabled(): boolean;
  psbt(): string;
  getTxid(): string;
  extractV2Req(): Promise<IPayjoinRequest>;
  processRes(response: Uint8Array, ohttpCtx: any): Promise<IPayjoinProposal>;
}