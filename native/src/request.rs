use env_logger;
use log::{debug, error, info};
use napi_derive::napi;
use napi::bindgen_prelude::Uint8Array;
use reqwest;
use ohttp::ClientResponse;
use payjoin::send::{V1Context, V2GetContext, V2PostContext};
use std::sync::RwLock;
use url::Url;

#[napi]
pub struct PayjoinRequest {
    url: String,
    body: Vec<u8>,
    context: Option<V1Context>,
    // #[cfg(feature = "v2")]
    v2_context: RwLock<Option<V2PostContext>>,
    /// The OHTTP client response context needed for v2 protocol processing.
    /// This is stored but not directly accessed as it's handled internally
    /// by the payjoin library during request processing.
    #[allow(dead_code)]
    // #[cfg(feature = "v2")]
    ohttp_ctx: Option<ClientResponse>,
}

#[napi]
impl PayjoinRequest {
    pub fn new(
        url: String,
        body: Vec<u8>,
        ohttp_ctx: Option<ClientResponse>,
        v2_context: Option<V2PostContext>,
    ) -> Self {
        Self {
            url,
            body,
            context: None,
            v2_context: RwLock::new(v2_context),
            ohttp_ctx,
        }
    }

    #[napi]
    pub fn url(&self) -> String {
        self.url.clone()
    }

    #[napi(ts_return_type = "Uint8Array")]
    pub fn body(&self) -> napi::Result<Uint8Array> {
        Ok(Uint8Array::new(self.body.clone()))
    }

    #[napi(ts_return_type = "Uint8Array")]
    pub async fn post(&self) -> napi::Result<Uint8Array> {
        let client = reqwest::Client::new();
        
        let response = client
            .post(&self.url)
            .header("Content-Type", "message/ohttp-req")
            .body(self.body.clone())
            .send()
            .await
            .map_err(|e| match e.status() {
                Some(status_code) => napi::Error::from_reason(
                    format!("HTTP request failed: {} {}", status_code, e)
                ),
                None => napi::Error::from_reason(
                    format!("No HTTP response: {}", e)
                ),
            })?;

        let bytes = response
            .bytes()
            .await
            .map_err(|e| napi::Error::from_reason(
                format!("Failed to read response body: {}", e)
            ))?;
    
        Ok(Uint8Array::new(bytes.to_vec()))
    }

    #[napi]
    pub fn process_response(&self, response: Uint8Array) -> napi::Result<PayjoinResponse> {
        let response_vec = response.to_vec();

        if let Some(ref context) = self.context {
            let mut response_slice = &response_vec[..];
            context
                .clone()
                .process_response(&mut response_slice)
                .map(|psbt| PayjoinResponse::new_v1(psbt.to_string()))
                .map_err(|e| {
                    napi::Error::from_reason(format!("Failed to process v1 response: {}", e))
                })
        } else if let Some(context) = self.v2_context.write().unwrap().take() {
            context
                .process_response(&response_vec)
                .map(|ctx| PayjoinResponse::new_v2(PayjoinV2Context { inner: ctx }))
                .map_err(|e| {
                    napi::Error::from_reason(format!("Failed to process v2 response: {}", e))
                })
        } else {
            Err(napi::Error::from_reason("No context available"))
        }
    }

    pub fn get_ohttp_ctx(&mut self) -> Option<ClientResponse> {
        self.ohttp_ctx.take()
    }
}

#[napi]
pub struct PayjoinResponse {
    version: String,
    #[cfg(feature = "v2")]
    v2_context: Option<PayjoinV2Context>,
    v1_psbt: Option<String>,
}

#[napi]
impl PayjoinResponse {
    fn new_v1(psbt: String) -> Self {
        Self {
            version: "v1".to_string(),
            #[cfg(feature = "v2")]
            v2_context: None,
            v1_psbt: Some(psbt),
        }
    }

    // #[cfg(feature = "v2")]
    fn new_v2(context: PayjoinV2Context) -> Self {
        Self {
            version: "v2".to_string(),
            v2_context: Some(context),
            v1_psbt: None,
        }
    }

    #[napi]
    pub fn version(&self) -> String {
        self.version.clone()
    }

    #[napi]
    pub fn psbt(&self) -> Option<String> {
        self.v1_psbt.clone()
    }

    // #[cfg(feature = "v2")]
    #[napi]
    pub fn v2_context(&self) -> Option<PayjoinV2Context> {
        self.v2_context.clone()
    }
}

// #[cfg(feature = "v2")]
#[derive(Clone, Debug)]
#[napi]
pub struct PayjoinV2Context {
    inner: V2GetContext,
}

// #[cfg(feature = "v2")]
#[napi]
impl PayjoinV2Context {
    #[napi]
    pub fn extract_request(&self, ohttp_relay: String) -> napi::Result<PayjoinRequest> {
        let relay_url = Url::parse(&ohttp_relay)
            .map_err(|e| napi::Error::from_reason(format!("Invalid relay URL: {}", e)))?;

        let (request, ohttp_ctx) = self
            .inner
            .extract_req(relay_url)
            .map_err(|e| napi::Error::from_reason(format!("Failed to extract request: {}", e)))?;

        Ok(PayjoinRequest {
            url: request.url.to_string(),
            body: request.body.to_vec(),
            context: None,
            v2_context: RwLock::new(None),
            ohttp_ctx: Some(ohttp_ctx),
        })
    }

    #[napi]
    pub fn process_response(
        &self,
        response: Uint8Array,
        request: &mut PayjoinRequest,
    ) -> napi::Result<Option<String>> {
        env_logger::init_from_env(env_logger::Env::default().default_filter_or("debug"));
        let response_vec = response.as_ref();
        debug!("Processing response of length: {}", response_vec.len());

        let ohttp_ctx = request
            .get_ohttp_ctx()
            .ok_or_else(|| napi::Error::from_reason("Missing OHTTP context"))?;

        match self.inner.process_response(response_vec, ohttp_ctx) {
            Ok(Some(psbt)) => {
                info!("Successfully processed PSBT");
                Ok(Some(base64::encode(psbt.serialize())))
            }
            Ok(None) => {
                info!("Received ACCEPTED status, no PSBT");
                Ok(None)
            }
            Err(e) => {
                error!("Error processing response: {}", e);
                Err(napi::Error::from_reason(format!("Failed to process response: {}", e)))
            }
        }
    }
}


