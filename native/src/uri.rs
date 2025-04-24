#![deny(clippy::all)]

use napi_derive::napi;
use payjoin::bitcoin::address::{NetworkChecked, NetworkUnchecked};
use payjoin::bitcoin::bech32;
use payjoin::bitcoin::consensus::Decodable;
use payjoin::bitcoin::{Address, Amount};
use payjoin::{PjUri, PjUriBuilder, Uri, UriExt};
use std::str::FromStr;
use url::Url;

/**
 * Payjoin URI builder
 **/

#[napi]
pub struct PayjoinUriBuilder {
    inner: PjUriBuilder,
}

#[napi]
impl PayjoinUriBuilder {
    #[napi(constructor)]
    pub fn new(address: String, endpoint: String) -> napi::Result<Self> {
        let bitcoin_address = Address::from_str(&address)
            .map_err(|e| napi::Error::from_reason(format!("Invalid address: {}", e)))?;

        let endpoint_url = url::Url::parse(&endpoint)
            .map_err(|e| napi::Error::from_reason(format!("Invalid endpoint URL: {}", e)))?;

        Ok(Self {
            inner: PjUriBuilder::new(
                bitcoin_address.assume_checked(),
                endpoint_url,
                None,
                None,
                None,
            ),
        })
    }

    #[napi]
    pub fn amount(&self, amount_sat: f64) -> napi::Result<Self> {
        Ok(Self {
            inner: self
                .inner
                .clone()
                .amount(Amount::from_sat(amount_sat as u64)),
        })
    }

    #[napi]
    pub fn message(&self, message: String) -> napi::Result<Self> {
        Ok(Self {
            inner: self.inner.clone().message(message),
        })
    }

    #[napi]
    pub fn label(&self, label: String) -> napi::Result<Self> {
        Ok(Self {
            inner: self.inner.clone().label(label),
        })
    }

    #[napi]
    pub fn disable_output_substitution(&self) -> napi::Result<Self> {
        Ok(Self {
            inner: self.inner.clone().pjos(true),
        })
    }

    #[napi]
    pub fn build(&self) -> String {
        self.inner.clone().build().to_string()
    }
}

impl From<PjUriBuilder> for PayjoinUriBuilder {
    fn from(builder: PjUriBuilder) -> Self {
        Self { inner: builder }
    }
}

/**
 * Payjoin URI parser
 **/

#[napi]
pub struct BtcUri {
    inner: Uri<'static, NetworkUnchecked>,
}

#[napi]
impl BtcUri {
    #[napi]
    pub fn try_from(bip21: String) -> napi::Result<Self> {
        Uri::try_from(bip21)
            .map(|uri| Self { inner: uri })
            .map_err(|e| {
                napi::Error::from_reason(format!("Failed to create URI from BIP21: {}", e))
            })
    }

    #[napi]
    pub fn assume_checked(&self) -> napi::Result<CheckedBtcUri> {
        Ok(CheckedBtcUri {
            inner: self.inner.clone().assume_checked(),
        })
    }
}

#[napi]
pub struct CheckedBtcUri {
    inner: Uri<'static, NetworkChecked>,
}

#[napi]
impl CheckedBtcUri {
    #[napi]
    pub fn check_pj_supported(&self) -> napi::Result<PayjoinUri> {
        let checked_uri = self.inner.clone();
        checked_uri
            .check_pj_supported()
            .map(|uri| PayjoinUri { inner: uri })
            .map_err(|_| napi::Error::from_reason("URI does not support Payjoin"))
    }
}

#[napi]
pub struct PayjoinUri {
    inner: PjUri<'static>,
}

#[napi]
impl PayjoinUri {
    #[napi]
    pub fn endpoint(&self) -> PayjoinUrl {
        PayjoinUrl {
            inner: self.inner.extras.endpoint().clone(),
        }
    }

    #[napi]
    pub fn exp(&self) -> Option<u64> {
        let endpoint = self.inner.extras.endpoint();

        let value = get_param(endpoint, "EX1", |v| Some(v.to_owned()))?;

        let hrp_string =
            bech32::primitives::decode::CheckedHrpstring::new::<bech32::NoChecksum>(&value)
                .map_err(|_| napi::Error::from_reason("Invalid EX1 value"))
                .ok()?;

        let hrp = hrp_string.hrp();
        let bytes = hrp_string.byte_iter().collect::<Vec<u8>>();

        let ex_hrp: bech32::Hrp = bech32::Hrp::parse("EX").unwrap();
        if hrp != ex_hrp {
            return None;
        }

        match u32::consensus_decode(&mut &bytes[..]) {
            Ok(timestamp) => Some(timestamp as u64),
            Err(_) => None,
        }
    }

    #[napi]
    pub fn amount(&self) -> Option<f64> {
        self.inner.amount.map(|amt| amt.to_sat() as f64)
    }

    #[napi]
    pub fn address(&self) -> Option<String> {
        Some(self.inner.address.to_string())
    }
}

#[napi]
pub struct PayjoinUrl {
    inner: Url,
}

#[napi]
impl PayjoinUrl {
    #[napi]
    pub fn to_string(&self) -> String {
        self.inner.to_string()
    }
}

fn get_param<F, T>(url: &Url, prefix: &str, parse: F) -> Option<T>
where
    F: Fn(&str) -> Option<T>,
{
    if let Some(fragment) = url.fragment() {
        for param in fragment.split('+') {
            if param.starts_with(prefix) {
                return parse(param);
            }
        }
    }
    None
}
