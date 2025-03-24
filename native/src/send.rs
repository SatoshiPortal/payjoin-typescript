use crate::request::PayjoinRequest;
use napi_derive::napi;
use payjoin::{
    bitcoin::{psbt::Psbt, Amount, FeeRate},
    send::{Sender, SenderBuilder},
    Uri, UriExt,
};
use std::str::FromStr;
use url::Url;

#[napi]
pub struct PayjoinSenderBuilder {
    inner: SenderBuilder<'static>,
}

#[napi]
impl PayjoinSenderBuilder {
    #[napi(constructor)]
    pub fn from_psbt_and_uri(psbt: String, uri: String) -> napi::Result<Self> {
        let psbt = Psbt::from_str(&psbt)
            .map_err(|e| napi::Error::from_reason(format!("Invalid PSBT: {}", e)))?;

        let uri = Uri::from_str(&uri)
            .map_err(|e| napi::Error::from_reason(format!("Invalid URI: {}", e)))?
            .assume_checked()
            .check_pj_supported()
            .map_err(|e| napi::Error::from_reason(format!("Invalid Payjoin URI: {}", e)))?;

        SenderBuilder::from_psbt_and_uri(psbt, uri)
            .map(|builder| Self { inner: builder })
            .map_err(|e| napi::Error::from_reason(format!("Failed to create sender: {}", e)))
    }

    #[napi]
    pub fn disable_output_substitution(&mut self, disable: bool) -> &Self {
        self.inner = self
            .inner
            .clone()
            .always_disable_output_substitution(disable);
        self
    }

    #[napi]
    pub fn build_recommended(&self, min_fee_rate_sat_per_vb: f64) -> napi::Result<PayjoinSender> {
        let fee_rate = FeeRate::from_sat_per_vb(min_fee_rate_sat_per_vb as u64)
            .ok_or_else(|| napi::Error::from_reason("Invalid fee rate"))?;

        self.inner
            .clone()
            .build_recommended(fee_rate)
            .map(|sender| PayjoinSender { inner: sender })
            .map_err(|e| napi::Error::from_reason(format!("Failed to build sender: {}", e)))
    }

    #[napi]
    pub fn build_with_additional_fee(
        &self,
        max_fee_contribution_sats: f64,
        change_index: Option<u32>,
        min_fee_rate_sat_per_vb: f64,
        clamp_fee_contribution: bool,
    ) -> napi::Result<PayjoinSender> {
        let fee = Amount::from_sat(max_fee_contribution_sats as u64);
        let fee_rate = FeeRate::from_sat_per_vb(min_fee_rate_sat_per_vb as u64)
            .ok_or_else(|| napi::Error::from_reason("Invalid fee rate"))?;

        self.inner
            .clone()
            .build_with_additional_fee(
                fee,
                change_index.map(|i| i as usize),
                fee_rate,
                clamp_fee_contribution,
            )
            .map(|sender| PayjoinSender { inner: sender })
            .map_err(|e| napi::Error::from_reason(format!("Failed to build sender: {}", e)))
    }
}

#[napi]
pub struct PayjoinSender {
    inner: Sender,
}

#[napi]
impl PayjoinSender {
    // #[napi]
    // pub fn extract_v1(&self) -> napi::Result<PayjoinRequest> {
    //     self.inner
    //         .extract_v1()
    //         .map(|(request, context)| PayjoinRequest {
    //             url: request.url().to_string(),
    //             body: request.body().to_vec(),
    //             context: Some(context),
    //             #[cfg(feature = "v2")]
    //             v2_context: None,
    //             #[cfg(feature = "v2")]
    //             ohttp_ctx: None,
    //         })
    //         .map_err(|e| napi::Error::from_reason(format!("Failed to extract v1 request: {}", e)))
    // }

    // #[cfg(feature = "v2")]
    #[napi(ts_return_type = "Promise<PayjoinRequest>")]
    pub fn extract_v2(&self, ohttp_relay: String) -> napi::Result<PayjoinRequest> {
        let relay_url = Url::parse(&ohttp_relay)
            .map_err(|e| napi::Error::from_reason(format!("Invalid relay URL: {}", e)))?;

        self.inner
            .extract_v2(relay_url)
            .map(|(request, context)| {
                PayjoinRequest::new(
                    request.url.to_string(),
                    request.body.to_vec(),
                    None,
                    Some(context),
                )
            })
            .map_err(|e| napi::Error::from_reason(format!("Failed to extract v2 request: {}", e)))
    }

    #[napi]
    pub fn to_json(&self) -> napi::Result<String> {
        // Serialize the inner Sender to JSON
        serde_json::to_string(&self.inner)
            .map_err(|e| napi::Error::from_reason(format!("Failed to serialize sender: {}", e)))
    }

    #[napi]
    pub fn from_json(json: String) -> napi::Result<Self> {
        // Deserialize from JSON string to Sender
        let inner: Sender = serde_json::from_str(&json).map_err(|e| {
            napi::Error::from_reason(format!("Failed to deserialize sender: {}", e))
        })?;

        // Return a new PayjoinSender instance
        Ok(PayjoinSender { inner })
    }
}
