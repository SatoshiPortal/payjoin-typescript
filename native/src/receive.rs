use crate::request::PayjoinRequest;
use crate::uri::PayjoinUriBuilder;
use napi::bindgen_prelude::*;
use napi::bindgen_prelude::{BigInt, Uint8Array};
use napi::Result;
use napi_derive::napi;
use ohttp::ClientResponse;
use payjoin::{
    bitcoin::{
        consensus::Decodable, psbt::Input, psbt::Psbt, Address, Amount, FeeRate, OutPoint, Script,
        ScriptBuf, Sequence, Transaction, TxIn, TxOut, Witness,
    },
    receive::v2::{
        MaybeInputsOwned, MaybeInputsSeen, OutputsUnknown, PayjoinProposal, ProvisionalProposal,
        Receiver, UncheckedProposal, WantsInputs, WantsOutputs,
    },
    receive::InputPair,
    OhttpKeys,
};
use std::{str::FromStr, time::Duration};
use url::Url;

#[napi]
pub struct OhttpContext {
    inner: ClientResponse,
}

impl OhttpContext {
    pub fn into_inner(self) -> ClientResponse {
        self.inner
    }
}

#[napi]
pub struct PayjoinReceiver {
    inner: Receiver,
}

#[napi]
impl PayjoinReceiver {
    #[napi(constructor)]
    pub fn new(
        address: String,
        directory: String,
        ohttp_keys: Uint8Array,
        ohttp_relay: String,
        expiry_seconds: Option<BigInt>,
    ) -> napi::Result<Self> {
        let address = Address::from_str(&address)
            .map_err(|e| napi::Error::from_reason(format!("Invalid address: {}", e)))?;

        let directory = Url::parse(&directory)
            .map_err(|e| napi::Error::from_reason(format!("Invalid directory URL: {}", e)))?;

        let ohttp_relay = Url::parse(&ohttp_relay)
            .map_err(|e| napi::Error::from_reason(format!("Invalid relay URL: {}", e)))?;

        let ohttp_keys = OhttpKeys::decode(ohttp_keys.as_ref())
            .map_err(|e| napi::Error::from_reason(format!("Invalid OHTTP keys: {}", e)))?;

        let expire_after = expiry_seconds.map(|seconds| {
            let (_sign, value, _overflow) = seconds.get_u64();
            Duration::from_secs(value)
        });

        Ok(Self {
            inner: Receiver::new(
                address.assume_checked(),
                directory,
                ohttp_keys,
                ohttp_relay,
                expire_after,
            ),
        })
    }

    #[napi]
    pub fn to_json(&self) -> napi::Result<String> {
        // Serialize the internal state to JSON
        serde_json::to_string(&self.inner)
            .map_err(|e| napi::Error::from_reason(format!("Failed to serialize receiver: {}", e)))
    }

    #[napi(factory)]
    pub fn from_json(json_str: String) -> napi::Result<Self> {
        // Deserialize from JSON to create a new receiver
        let inner: Receiver = serde_json::from_str(&json_str).map_err(|e| {
            napi::Error::from_reason(format!("Failed to deserialize receiver: {}", e))
        })?;

        Ok(Self { inner })
    }

    #[napi]
    pub fn pj_url(&self) -> String {
        self.inner.pj_url().to_string()
    }

    #[napi]
    pub fn pj_uri_builder(&self) -> napi::Result<PayjoinUriBuilder> {
        let uri = self.inner.pj_uri_builder();
        Ok(PayjoinUriBuilder::from(uri))
    }

    #[napi]
    pub fn extract_request(&mut self) -> napi::Result<PayjoinRequest> {
        let (request, ohttp_ctx) = self
            .inner
            .extract_req()
            .map_err(|e| napi::Error::from_reason(format!("Failed to extract request: {}", e)))?;

        Ok(PayjoinRequest::new(
            request.url.to_string(),
            request.body.to_vec(),
            Some(ohttp_ctx),
            None,
        ))
    }

    #[napi]
    pub fn process_response(
        &mut self,
        response: Uint8Array,
        request: &mut PayjoinRequest,
    ) -> napi::Result<Option<UncheckedProposalWrapper>> {
        let ohttp_ctx = request
            .get_ohttp_ctx()
            .ok_or_else(|| napi::Error::from_reason("Missing OHTTP context"))?;

        let response_vec = response.as_ref();

        self.inner
            .process_res(response_vec, ohttp_ctx)
            .map(|proposal| proposal.map(|p| UncheckedProposalWrapper { inner: p }))
            .map_err(|e| napi::Error::from_reason(format!("Failed to process response: {}", e)))
    }
}

fn log_debug(message: &str) {
    use std::fs::OpenOptions;
    use std::io::Write;

    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open("/tmp/payjoin-debug.log")
        .unwrap();
    writeln!(file, "{}", message).unwrap();
}

#[napi]
pub struct UncheckedProposalWrapper {
    inner: UncheckedProposal,
}

#[napi]
impl UncheckedProposalWrapper {
    #[napi]
    pub fn original_tx(&self) -> String {
        let tx = self.inner.extract_tx_to_schedule_broadcast();
        payjoin::bitcoin::consensus::encode::serialize_hex(&tx)
    }

    #[napi]
    pub fn check_broadcast_suitability(
        &mut self,
        min_fee_rate: Option<f64>,
        can_broadcast: Function<String, bool>,
    ) -> napi::Result<MaybeInputsOwnedWrapper> {
        log_debug("check_broadcast_suitability: Entered function");

        // Parse the minimum fee rate
        let min_fee_rate = min_fee_rate
            .map(|rate| {
                FeeRate::from_sat_per_vb(rate as u64)
                    .ok_or_else(|| napi::Error::from_reason("Invalid fee rate"))
            })
            .transpose()?;

        log_debug(&format!(
            "check_broadcast_suitability: Parsed min_fee_rate: {:?}",
            min_fee_rate
        ));

        let result = self
            .inner
            .clone()
            .check_broadcast_suitability(min_fee_rate, |tx| {
                let tx_hex = payjoin::bitcoin::consensus::encode::serialize_hex(tx);
                log_debug(&format!(
                    "check_broadcast_suitability: Checking broadcast suitability for tx: {}",
                    tx_hex
                ));

                let result = can_broadcast.call(tx_hex);

                result.map_err(|e| {
                    log_debug(&format!("check_broadcast_suitability: Error: {}", e));
                    payjoin::Error::Server(format!("Failed to check broadcast: {}", e).into())
                })
            })
            .map(|m| MaybeInputsOwnedWrapper { inner: m })
            .map_err(|e| {
                log_debug(&format!(
                    "check_broadcast_suitability: Error in check_broadcast_suitability: {}",
                    e
                ));
                napi::Error::from_reason(format!("Failed checking broadcast: {}", e))
            });

        log_debug("check_broadcast_suitability: Exiting function");
        result
    }

    #[napi]
    pub fn assume_interactive_receiver(&mut self) -> MaybeInputsOwnedWrapper {
        MaybeInputsOwnedWrapper {
            inner: self.inner.clone().assume_interactive_receiver(),
        }
    }
}

#[napi]
pub struct MaybeInputsOwnedWrapper {
    inner: MaybeInputsOwned,
}

#[napi]
impl MaybeInputsOwnedWrapper {
    #[napi]
    pub fn check_inputs_not_owned(
        &mut self,
        is_owned: Function<String, bool>,
    ) -> napi::Result<MaybeInputsSeenWrapper> {
        self.inner
            .clone()
            .check_inputs_not_owned(|script| {
                log_debug("check_inputs_not_owned: Checking inputs not owned");

                let script_hex = script.to_hex_string();

                let result = is_owned.call(script_hex);

                result.map_err(|e| {
                    log_debug(&format!("check_inputs_not_owned: Error: {}", e));
                    payjoin::Error::Server(format!("Failed to check inputs: {}", e).into())
                })
            })
            .map(|m| MaybeInputsSeenWrapper { inner: m })
            .map_err(|e| napi::Error::from_reason(format!("Failed to check inputs: {}", e)))
    }
}

#[napi]
pub struct MaybeInputsSeenWrapper {
    inner: MaybeInputsSeen,
}

#[napi]
impl MaybeInputsSeenWrapper {
    #[napi]
    pub fn check_no_inputs_seen_before(
        &mut self,
        is_known: Function<String, bool>,
    ) -> napi::Result<OutputsUnknownWrapper> {
        self.inner
            .clone()
            .check_no_inputs_seen_before(|outpoint| {
                let outpoint_str = outpoint.to_string();

                let result = is_known.call(outpoint_str);

                result.map_err(|e| {
                    log_debug(&format!("check_no_inputs_seen_before: Error: {}", e));
                    payjoin::Error::Server(format!("Failed to check inputs: {}", e).into())
                })
            })
            .map(|o| OutputsUnknownWrapper { inner: o })
            .map_err(|e| napi::Error::from_reason(format!("Failed to check inputs: {}", e)))
    }
}

#[napi]
pub struct OutputsUnknownWrapper {
    inner: OutputsUnknown,
}

#[napi]
impl OutputsUnknownWrapper {
    #[napi]
    pub fn identify_receiver_outputs(
        &mut self,
        is_receiver_output: Function<String, bool>,
    ) -> napi::Result<WantsOutputsWrapper> {
        self.inner
            .clone()
            .identify_receiver_outputs(|script| {
                let script_hex = script.to_hex_string();

                let result = is_receiver_output.call(script_hex);

                result.map_err(|e| {
                    log_debug(&format!("identify_receiver_outputs: Error: {}", e));
                    payjoin::Error::Server(format!("Failed to identify outputs: {}", e).into())
                })
            })
            .map(|w| WantsOutputsWrapper { inner: w })
            .map_err(|e| napi::Error::from_reason(format!("Failed to identify outputs: {}", e)))
    }
}

#[napi(object)]
pub struct ReplacementOutput {
    pub script: Vec<u8>,
    pub value: BigInt,
}

#[napi]
pub struct WantsOutputsWrapper {
    inner: WantsOutputs,
}

#[napi]
impl WantsOutputsWrapper {
    #[napi]
    pub fn is_output_substitution_disabled(&self) -> bool {
        self.inner.is_output_substitution_disabled()
    }

    #[napi]
    pub fn substitute_receiver_script(
        &mut self,
        output_script: Vec<u8>,
    ) -> napi::Result<WantsOutputsWrapper> {
        self.inner
            .clone()
            .substitute_receiver_script(Script::from_bytes(&output_script))
            .map(|w| WantsOutputsWrapper { inner: w })
            .map_err(|e| napi::Error::from_reason(format!("Failed to substitute script: {}", e)))
    }

    #[napi]
    pub fn replace_receiver_outputs(
        &mut self,
        replacement_outputs: Vec<ReplacementOutput>,
        drain_script: Vec<u8>,
    ) -> napi::Result<WantsOutputsWrapper> {
        let outputs = replacement_outputs
            .into_iter()
            .map(|output| {
                let (_, value, _) = output.value.get_u64();
                TxOut {
                    script_pubkey: ScriptBuf::from_bytes(output.script),
                    value: Amount::from_sat(value),
                }
            })
            .collect();

        self.inner
            .clone()
            .replace_receiver_outputs(outputs, Script::from_bytes(&drain_script))
            .map(|w| WantsOutputsWrapper { inner: w })
            .map_err(|e| napi::Error::from_reason(format!("Failed to replace outputs: {}", e)))
    }

    #[napi]
    pub fn commit_outputs(&mut self) -> WantsInputsWrapper {
        WantsInputsWrapper {
            inner: self.inner.clone().commit_outputs(),
        }
    }
}

#[napi(object)]
pub struct PartialSigData {
    pub pubkey: Vec<u8>,
    pub signature: Vec<u8>,
}

#[napi(object)]
pub struct Bip32DerivationData {
    pub pubkey: Vec<u8>,
    pub fingerprint_path: Vec<u8>,
    pub child: u32,
}

#[napi(object)]
pub struct WitnessUtxoData {
    pub amount: f64,            // Amount in BTC
    pub script_pub_key: String, // Script in hex format
}

#[napi(object)]
pub struct PsbtInputData {
    pub non_witness_utxo: Option<Vec<u8>>,
    pub witness_utxo: Option<WitnessUtxoData>,
    pub partial_sigs: Option<Vec<PartialSigData>>,
    pub sighash_type: Option<u32>,
    pub redeem_script: Option<Vec<u8>>,
    pub witness_script: Option<Vec<u8>>,
    pub bip32_derivation: Option<Vec<Bip32DerivationData>>,
    pub final_script_sig: Option<Vec<u8>>,
    pub final_script_witness: Option<Vec<Vec<u8>>>,
    //pub proprietary: Vec<(Vec<u8>, Vec<u8>)>, // (identifier, value)
}

#[napi(object)]
pub struct TxOutpoint {
    pub txid: String, // Transaction ID as hex string
    pub vout: u32,    // Output index
}

#[napi(object)]
pub struct InputPairRequest {
    pub prevout: TxOutpoint,
    pub script_sig: Option<Vec<u8>>,   // script sig
    pub witness: Option<Vec<Vec<u8>>>, // witness data
    pub sequence: Option<u32>,         // sequence number
    pub psbt_data: PsbtInputData,      // PSBT input data
}

impl InputPairRequest {
    pub fn into_input_pair(self) -> napi::Result<InputPair> {
        // Create txid directly from the hex string
        let txid = payjoin::bitcoin::Txid::from_str(&self.prevout.txid)
            .map_err(|e| napi::Error::from_reason(format!("Invalid txid hex: {}", e)))?;

        let outpoint = OutPoint {
            txid,
            vout: self.prevout.vout,
        };
        log_debug(&format!(
            "InputPairRequest::into_input_pair: outpoint: {:?}",
            outpoint
        ));

        let txin = TxIn {
            previous_output: outpoint,
            script_sig: ScriptBuf::from_bytes(self.script_sig.unwrap_or_default()),
            sequence: Sequence::from_consensus(self.sequence.unwrap_or(0xffffffff)),
            witness: Witness::from(self.witness.unwrap_or_default()),
        };
        log_debug(&format!(
            "InputPairRequest::into_input_pair: txin: {:?}",
            txin
        ));

        let mut psbtin = Input::default();

        // Handle non-witness UTXO
        if let Some(utxo) = self.psbt_data.non_witness_utxo {
            psbtin.non_witness_utxo =
                Some(Transaction::consensus_decode(&mut &utxo[..]).map_err(|e| {
                    napi::Error::from_reason(format!("Invalid non-witness UTXO: {}", e))
                })?);
        }

        if let Some(witness_utxo) = &self.psbt_data.witness_utxo {
            log_debug(&format!(
                "InputPairRequest::into_input_pair: psbt_data_witness_utxo.amount: {:?}",
                witness_utxo.amount
            ));
            log_debug(&format!(
                "InputPairRequest::into_input_pair: psbt_data_witness_utxo.script_pub_key: {:?}",
                witness_utxo.script_pub_key
            ));
        } else {
            log_debug("InputPairRequest::into_input_pair: No witness_utxo provided");
        }

        // Handle witness UTXO
        if let Some(utxo) = self.psbt_data.witness_utxo {
            // Convert amount from BTC to satoshis
            let amount_sat = (utxo.amount * 100_000_000.0) as u64;
            log_debug(&format!(
                "InputPairRequest::into_input_pair: amount_sat: {:?}",
                amount_sat
            ));
            log_debug(&format!(
                "InputPairRequest::into_input_pair: script_pub_key: {:?}",
                utxo.script_pub_key
            ));
            // Create TxOut with the amount and script
            psbtin.witness_utxo = Some(TxOut {
                value: Amount::from_sat(amount_sat),
                script_pubkey: ScriptBuf::from_hex(&utxo.script_pub_key)
                    .map_err(|e| napi::Error::from_reason(format!("Invalid script hex: {}", e)))?,
            });
        }

        // Handle partial signatures
        // if let Some(sigs) = self.psbt_data.partial_sigs {
        //     for sig_data in sigs {
        //         psbtin.partial_sigs.insert(
        //             PublicKey::from_slice(&sig_data.pubkey)
        //                 .map_err(|e| napi::Error::from_reason(format!("Invalid pubkey: {}", e)))?,
        //             Signature::from_slice(&sig_data.signature).map_err(|e| {
        //                 napi::Error::from_reason(format!("Invalid signature: {}", e))
        //             })?,
        //         );
        //     }
        // }

        // Handle sighash type
        // if let Some(sighash) = self.psbt_data.sighash_type {
        //     psbtin.sighash_type = Some(PsbtSighashType::from_u32(sighash));
        // }

        // Handle redeem script
        // if let Some(script) = self.psbt_data.redeem_script {
        //     psbtin.redeem_script = Some(ScriptBuf::from_bytes(script));
        // }

        // Handle witness script
        // if let Some(script) = self.psbt_data.witness_script {
        //     psbtin.witness_script = Some(ScriptBuf::from_bytes(script));
        // }

        // Handle BIP32 derivation paths
        // if let Some(derivation_data) = self.psbt_data.bip32_derivation {
        //     for data in derivation_data {
        //         let pubkey = Secp256k1PublicKey::from_slice(&data.pubkey)
        //             .map_err(|e| napi::Error::from_reason(format!("Invalid pubkey: {}", e)))?;

        //         // Convert the first 4 bytes to a fingerprint
        //         let mut fingerprint_bytes = [0u8; 4];
        //         fingerprint_bytes.copy_from_slice(&data.fingerprint_path[0..4]);
        //         let fingerprint = Fingerprint::from(fingerprint_bytes);

        //         // Convert child number to a derivation path
        //         let child_number = ChildNumber::from_normal_idx(data.child).map_err(|e| {
        //             napi::Error::from_reason(format!("Invalid child number: {}", e))
        //         })?;
        //         let path = DerivationPath::from(vec![child_number]);

        //         psbtin.bip32_derivation.insert(pubkey, (fingerprint, path));
        //     }
        // }

        // Handle final scriptSig
        // if let Some(script_sig) = self.psbt_data.final_script_sig {
        //     psbtin.final_script_sig = Some(ScriptBuf::from_bytes(script_sig));
        // }

        // Handle final scriptWitness
        // if let Some(witness_stack) = self.psbt_data.final_script_witness {
        //     psbtin.final_script_witness = Some(Witness::from_slice(&witness_stack));
        // }

        log_debug(&format!(
            "InputPairRequest::into_input_pair: psbtin: {:?}",
            psbtin
        ));
        InputPair::new(txin, psbtin)
            .map_err(|e| napi::Error::from_reason(format!("Failed to create InputPair: {}", e)))
    }
}

#[napi]
pub struct WantsInputsWrapper {
    inner: WantsInputs,
}

#[napi]
impl WantsInputsWrapper {
    #[napi]
    pub fn try_contribute_inputs(
        &mut self,
        candidate_inputs: Vec<InputPairRequest>,
    ) -> napi::Result<ProvisionalProposalWrapper> {
        // Convert inputs
        let inputs = candidate_inputs
            .into_iter()
            .map(|input| input.into_input_pair())
            .collect::<Result<Vec<_>, _>>()?;

        // First try to select a privacy preserving input
        let selected_input = self.inner.try_preserving_privacy(inputs).map_err(|e| {
            napi::Error::from_reason(format!(
                "Failed to make privacy preserving selection: {}",
                e
            ))
        })?;

        // Then contribute the selected input and immediately commit
        let result = self
            .inner
            .clone()
            .contribute_inputs(vec![selected_input])
            .map_err(|e| napi::Error::from_reason(format!("Failed to contribute inputs: {}", e)))?
            .commit_inputs();

        // Return the proposal
        Ok(ProvisionalProposalWrapper { inner: result })
    }
}

#[napi]
pub struct ProvisionalProposalWrapper {
    inner: ProvisionalProposal,
}

#[napi]
impl ProvisionalProposalWrapper {
    #[napi]
    pub fn finalize_proposal(
        &mut self,
        min_feerate_sat_per_vb: Option<f64>,
        max_feerate_sat_per_vb: Option<f64>,
        wallet_process_psbt: Function<String, String>,
    ) -> napi::Result<PayjoinProposalWrapper> {
        let min_fee_rate = min_feerate_sat_per_vb
            .map(|rate| {
                FeeRate::from_sat_per_vb(rate as u64)
                    .ok_or_else(|| napi::Error::from_reason("Invalid min fee rate"))
            })
            .transpose()?;

        let max_fee_rate = max_feerate_sat_per_vb
            .map(|rate| {
                FeeRate::from_sat_per_vb(rate as u64)
                    .ok_or_else(|| napi::Error::from_reason("Invalid max fee rate"))
            })
            .transpose()?;

        self.inner
            .clone()
            .finalize_proposal(
                |psbt| {
                    let psbt_string = psbt.to_string();
                    log_debug(&format!(
                        "finalize_proposal: Finalizing PSBT: {}",
                        psbt_string
                    ));
                    let result = wallet_process_psbt.call(psbt_string).map_err(|e| {
                        payjoin::Error::Server(
                            format!("Failed to call wallet_process_psbt: {}", e).into(),
                        )
                    })?;

                    Psbt::from_str(&result).map_err(|e| {
                        payjoin::Error::Server(
                            format!("Failed to parse finalized PSBT: {}", e).into(),
                        )
                    })
                },
                min_fee_rate,
                max_fee_rate.unwrap_or(FeeRate::ZERO),
            )
            .map(|p| PayjoinProposalWrapper { inner: p })
            .map_err(|e| napi::Error::from_reason(format!("Failed to finalize proposal: {}", e)))
    }
}

#[napi]
pub struct PayjoinProposalWrapper {
    inner: PayjoinProposal,
}

#[napi]
impl PayjoinProposalWrapper {
    #[napi]
    pub fn utxos_to_be_locked(&self) -> Vec<String> {
        self.inner
            .utxos_to_be_locked()
            .map(|outpoint| outpoint.to_string())
            .collect()
    }

    #[napi]
    pub fn is_output_substitution_disabled(&self) -> bool {
        self.inner.is_output_substitution_disabled()
    }

    #[napi]
    pub fn psbt(&self) -> String {
        self.inner.psbt().to_string()
    }

    #[napi]
    pub fn get_txid(&self) -> String {
        let payjoin_psbt = self.inner.psbt().clone();
        payjoin_psbt
            .extract_tx_unchecked_fee_rate()
            .compute_txid()
            .to_string()
    }

    #[napi]
    pub fn extract_v2_req(&mut self) -> napi::Result<PayjoinRequest> {
        let (request, ohttp_ctx) = self.inner.extract_v2_req().map_err(|e| {
            napi::Error::from_reason(format!("Failed to extract v2 request: {}", e))
        })?;

        Ok(PayjoinRequest::new(
            request.url.to_string(),
            request.body.to_vec(),
            Some(ohttp_ctx),
            None,
        ))
    }

    #[napi]
    pub fn process_res(
        &self,
        response: Uint8Array,
        request: &mut PayjoinRequest,
    ) -> napi::Result<&Self> {
        let ohttp_ctx = request
            .get_ohttp_ctx()
            .ok_or_else(|| napi::Error::from_reason("Missing OHTTP context"))?;

        let response_vec = response.as_ref();

        match self.inner.process_res(response_vec, ohttp_ctx) {
            Ok(_) => {
                log_debug("PayjoinProposalWrapper::process_res: Successfully processed response");
                Ok(self)
            }
            Err(e) => {
                let error_msg = format!("Failed to process response: {}", e);
                log_debug(&format!(
                    "PayjoinProposalWrapper::process_res: Error: {}",
                    error_msg
                ));
                Err(napi::Error::from_reason(error_msg))
            }
        }
    }
}
