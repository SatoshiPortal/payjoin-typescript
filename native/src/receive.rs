use crate::request::PayjoinRequest;
use crate::uri::PayjoinUriBuilder;
use napi::bindgen_prelude::{BigInt, Uint8Array};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, Result};
use napi_derive::napi;
use ohttp::ClientResponse;
use payjoin::{
    bitcoin::{
        bip32::{ChildNumber, DerivationPath, Fingerprint},
        consensus::Decodable,
        ecdsa::Signature,
        psbt::Input,
        psbt::Psbt,
        psbt::PsbtSighashType,
        secp256k1::PublicKey as Secp256k1PublicKey,
        Address, Amount, FeeRate, OutPoint, PublicKey, Script, ScriptBuf, Sequence, Transaction,
        TxIn, TxOut, Witness,
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

        let ohttp_keys = OhttpKeys::decode(&ohttp_keys.to_vec())
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

    // Replace the existing check_broadcast_suitability implementation
    #[napi]
    pub fn check_broadcast_suitability(
        &mut self,
        env: Env,
        min_fee_rate: Option<f64>,
        can_broadcast: napi::JsFunction,
    ) -> napi::Result<MaybeInputsOwnedWrapper> {
        use std::fs::OpenOptions;
        use std::io::Write;

        fn log_debug(message: &str) {
            let mut file = OpenOptions::new()
                .create(true)
                .append(true)
                .open("/tmp/payjoin-debug.log")
                .unwrap();
            writeln!(file, "{}", message).unwrap();
        }

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

        // Use the threadsafe function in the Rust logic
        let result = self
            .inner
            .clone()
            .check_broadcast_suitability(min_fee_rate, |tx| {
                let tx_hex = payjoin::bitcoin::consensus::encode::serialize_hex(&tx);

                log_debug(&format!(
                    "check_broadcast_suitability: Serialized transaction to hex: {}",
                    tx_hex
                ));

                // Create a JS string from the tx_hex
                let tx_hex_js = env.create_string(&tx_hex).map_err(|e| {
                    log_debug(&format!(
                        "check_broadcast_suitability: Error creating string: {}",
                        e
                    ));
                    payjoin::Error::Server(format!("Error creating string: {}", e).into())
                })?;

                // Call the JavaScript function directly
                log_debug("check_broadcast_suitability: About to call can_broadcast directly");
                let result = can_broadcast.call(None, &[tx_hex_js]).map_err(|e| {
                    log_debug(&format!(
                        "check_broadcast_suitability: Error calling function: {}",
                        e
                    ));
                    payjoin::Error::Server(format!("Error calling function: {}", e).into())
                })?;

                // Convert the result to a boolean
                let is_broadcastable = result
                    .coerce_to_bool()
                    .map_err(|e| {
                        log_debug(&format!(
                            "check_broadcast_suitability: Error coercing to boolean: {}",
                            e
                        ));
                        payjoin::Error::Server(format!("Error coercing to boolean: {}", e).into())
                    })?
                    .get_value()
                    .map_err(|e| {
                        log_debug(&format!(
                            "check_broadcast_suitability: Error getting boolean value: {}",
                            e
                        ));
                        payjoin::Error::Server(format!("Error getting boolean value: {}", e).into())
                    })?;

                log_debug(&format!(
                    "check_broadcast_suitability: JavaScript returned: {}",
                    is_broadcastable
                ));

                if is_broadcastable {
                    Ok(true)
                } else {
                    Err(payjoin::Error::Server(
                        "Broadcast not allowed by JavaScript".into(),
                    ))
                }
            })
            .map(|m| MaybeInputsOwnedWrapper { inner: m })
            .map_err(|e| {
                log_debug(&format!(
                    "check_broadcast_suitability: Error in check_broadcast_suitability: {}",
                    e
                ));
                napi::Error::from_reason(format!("Failed to check broadcast: {}", e))
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
        is_owned: napi::JsFunction,
    ) -> napi::Result<MaybeInputsSeenWrapper> {
        // Create a threadsafe reference to the callback
        let is_owned: ThreadsafeFunction<Vec<u8>> =
            is_owned.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        self.inner
            .clone()
            .check_inputs_not_owned(|script| {
                match is_owned.call(
                    Ok(script.as_bytes().to_vec()),
                    ThreadsafeFunctionCallMode::Blocking,
                ) {
                    napi::Status::Ok => Ok(true),
                    status => Err(payjoin::Error::Server(
                        format!("Failed to call is_owned callback: {:?}", status).into(),
                    )),
                }
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
        is_known: napi::JsFunction,
    ) -> napi::Result<OutputsUnknownWrapper> {
        let is_known: ThreadsafeFunction<String> =
            is_known.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        self.inner
            .clone()
            .check_no_inputs_seen_before(|outpoint| {
                let outpoint_str = outpoint.to_string();
                match is_known.call(Ok(outpoint_str), ThreadsafeFunctionCallMode::Blocking) {
                    napi::Status::Ok => Ok(true),
                    status => Err(payjoin::Error::Server(
                        format!("Failed to call is_known callback: {:?}", status).into(),
                    )),
                }
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
        is_receiver_output: napi::JsFunction,
    ) -> napi::Result<WantsOutputsWrapper> {
        let is_receiver_output: ThreadsafeFunction<Vec<u8>> =
            is_receiver_output.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        self.inner
            .clone()
            .identify_receiver_outputs(|script| {
                match is_receiver_output.call(
                    Ok(script.as_bytes().to_vec()),
                    ThreadsafeFunctionCallMode::Blocking,
                ) {
                    napi::Status::Ok => Ok(true),
                    status => Err(payjoin::Error::Server(
                        format!("Failed to call is_receiver_output callback: {:?}", status).into(),
                    )),
                }
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
            .substitute_receiver_script(&Script::from_bytes(&output_script))
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
            .replace_receiver_outputs(outputs, &Script::from_bytes(&drain_script))
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
pub struct PsbtInputData {
    pub non_witness_utxo: Option<Vec<u8>>,
    pub witness_utxo: Option<Vec<u8>>,
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
pub struct InputPairRequest {
    pub prevout: Vec<u8>,         // serialized outpoint
    pub script_sig: Vec<u8>,      // script sig
    pub witness: Vec<Vec<u8>>,    // witness data
    pub sequence: u32,            // sequence number
    pub psbt_data: PsbtInputData, // PSBT input data
}

impl InputPairRequest {
    pub fn into_input_pair(self) -> napi::Result<InputPair> {
        let outpoint = OutPoint::consensus_decode(&mut &self.prevout[..])
            .map_err(|e| napi::Error::from_reason(format!("Invalid outpoint: {}", e)))?;

        let txin = TxIn {
            previous_output: outpoint,
            script_sig: ScriptBuf::from_bytes(self.script_sig),
            sequence: Sequence::from_consensus(self.sequence),
            witness: Witness::from(self.witness),
        };

        let mut psbtin = Input::default();

        // Handle non-witness UTXO
        if let Some(utxo) = self.psbt_data.non_witness_utxo {
            psbtin.non_witness_utxo =
                Some(Transaction::consensus_decode(&mut &utxo[..]).map_err(|e| {
                    napi::Error::from_reason(format!("Invalid non-witness UTXO: {}", e))
                })?);
        }

        // Handle witness UTXO
        if let Some(utxo) = self.psbt_data.witness_utxo {
            psbtin.witness_utxo =
                Some(TxOut::consensus_decode(&mut &utxo[..]).map_err(|e| {
                    napi::Error::from_reason(format!("Invalid witness UTXO: {}", e))
                })?);
        }

        // Handle partial signatures
        if let Some(sigs) = self.psbt_data.partial_sigs {
            for sig_data in sigs {
                psbtin.partial_sigs.insert(
                    PublicKey::from_slice(&sig_data.pubkey)
                        .map_err(|e| napi::Error::from_reason(format!("Invalid pubkey: {}", e)))?,
                    Signature::from_slice(&sig_data.signature).map_err(|e| {
                        napi::Error::from_reason(format!("Invalid signature: {}", e))
                    })?,
                );
            }
        }

        // Handle sighash type
        if let Some(sighash) = self.psbt_data.sighash_type {
            psbtin.sighash_type = Some(PsbtSighashType::from_u32(sighash));
        }

        // Handle redeem script
        if let Some(script) = self.psbt_data.redeem_script {
            psbtin.redeem_script = Some(ScriptBuf::from_bytes(script));
        }

        // Handle witness script
        if let Some(script) = self.psbt_data.witness_script {
            psbtin.witness_script = Some(ScriptBuf::from_bytes(script));
        }

        // Handle BIP32 derivation paths
        if let Some(derivation_data) = self.psbt_data.bip32_derivation {
            for data in derivation_data {
                let pubkey = Secp256k1PublicKey::from_slice(&data.pubkey)
                    .map_err(|e| napi::Error::from_reason(format!("Invalid pubkey: {}", e)))?;

                // Convert the first 4 bytes to a fingerprint
                let mut fingerprint_bytes = [0u8; 4];
                fingerprint_bytes.copy_from_slice(&data.fingerprint_path[0..4]);
                let fingerprint = Fingerprint::from(fingerprint_bytes);

                // Convert child number to a derivation path
                let child_number = ChildNumber::from_normal_idx(data.child).map_err(|e| {
                    napi::Error::from_reason(format!("Invalid child number: {}", e))
                })?;
                let path = DerivationPath::from(vec![child_number]);

                psbtin.bip32_derivation.insert(pubkey, (fingerprint, path));
            }
        }

        // Handle final scriptSig
        if let Some(script_sig) = self.psbt_data.final_script_sig {
            psbtin.final_script_sig = Some(ScriptBuf::from_bytes(script_sig));
        }

        // Handle final scriptWitness
        if let Some(witness_stack) = self.psbt_data.final_script_witness {
            psbtin.final_script_witness = Some(Witness::from_slice(&witness_stack));
        }

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
        wallet_process_psbt: napi::JsFunction,
        min_feerate_sat_per_vb: Option<f64>,
        max_feerate_sat_per_vb: f64,
    ) -> napi::Result<PayjoinProposalWrapper> {
        let min_fee_rate = min_feerate_sat_per_vb
            .map(|rate| {
                FeeRate::from_sat_per_vb(rate as u64)
                    .ok_or_else(|| napi::Error::from_reason("Invalid min fee rate"))
            })
            .transpose()?;

        let max_fee_rate = FeeRate::from_sat_per_vb(max_feerate_sat_per_vb as u64)
            .ok_or_else(|| napi::Error::from_reason("Invalid max fee rate"))?;

        let wallet_process_psbt: ThreadsafeFunction<String> =
            wallet_process_psbt.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        self.inner
            .clone()
            .finalize_proposal(
                |psbt| {
                    let psbt_str = psbt.to_string();
                    match wallet_process_psbt
                        .call(Ok(psbt_str.clone()), ThreadsafeFunctionCallMode::Blocking)
                    {
                        napi::Status::Ok => Psbt::from_str(&psbt_str).map_err(|e| {
                            payjoin::Error::Server(format!("Failed to parse PSBT: {}", e).into())
                        }),
                        status => Err(payjoin::Error::Server(
                            format!("Failed to call wallet_process_psbt callback: {:?}", status)
                                .into(),
                        )),
                    }
                },
                min_fee_rate,
                max_fee_rate,
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

        self.inner
            .process_res(response_vec, ohttp_ctx)
            .map(|_| self)
            .map_err(|e| napi::Error::from_reason(format!("Failed to process response: {}", e)))
    }
}
