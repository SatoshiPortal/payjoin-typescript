use napi::{Result};
use napi_derive::napi;
use napi::bindgen_prelude::Uint8Array;
use payjoin::{OhttpKeys, Url};
use std::str::FromStr;

#[napi]
pub struct PayjoinOhttpKeys {
    inner: OhttpKeys,
}

#[napi]
impl PayjoinOhttpKeys {
    #[napi(constructor)]
    pub fn constructor(bytes: Uint8Array) -> Result<Self> {
        Self::from_bytes(bytes)
    }

    #[napi]
    pub async fn fetch(
        ohttp_relay: String,
        payjoin_directory: String,
    ) -> napi::Result<PayjoinOhttpKeys> {
        let relay_url = Url::from_str(&ohttp_relay)
            .map_err(|e| napi::Error::from_reason(format!("Invalid relay URL: {}", e)))?;

        let directory_url = Url::from_str(&payjoin_directory)
            .map_err(|e| napi::Error::from_reason(format!("Invalid directory URL: {}", e)))?;

        payjoin::io::fetch_ohttp_keys(relay_url, directory_url)
            .await
            .map(|keys| PayjoinOhttpKeys { inner: keys })
            .map_err(|e| napi::Error::from_reason(format!("Failed to fetch OHTTP keys: {}", e)))
    }

    #[napi(ts_return_type = "Uint8Array")]
    pub fn to_bytes(&self) -> napi::Result<Uint8Array> {
        let bytes = self.inner.encode()
            .map_err(|e| napi::Error::from_reason(format!("Failed to encode OHTTP keys: {}", e)))?;
        Ok(Uint8Array::new(bytes))
    }
    // pub fn to_bytes(&self) -> napi::Result<Vec<u8>> {
    //     self.inner.encode()
    //         .map_err(|e| napi::Error::from_reason(format!("Failed to encode OHTTP keys: {}", e)))
    // }

    #[napi]
    pub fn from_bytes(bytes: Uint8Array) -> napi::Result<PayjoinOhttpKeys> {
        let vec_bytes: Vec<u8> = bytes.to_vec();
        OhttpKeys::decode(&vec_bytes)
            .map(|keys| PayjoinOhttpKeys { inner: keys })
            .map_err(|e| napi::Error::from_reason(format!("Invalid OHTTP keys: {}", e)))
    }
}
