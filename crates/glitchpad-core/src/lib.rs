//! Platform-independent domain primitives for Glitchpad.

pub mod contracts;
pub mod detection;
pub mod editor;
pub mod metadata;
pub mod recovery;
pub mod session;
pub mod source;

/// The user-facing product name.
pub const PRODUCT_NAME: &str = "Glitchpad";

/// The product version shared by the native workspace.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Immutable information required by every host shell.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProductInfo {
    /// User-facing product name.
    pub name: &'static str,
    /// Semantic product version.
    pub version: &'static str,
}

/// Returns the product identity exposed by host shells.
pub const fn product_info() -> ProductInfo {
    ProductInfo {
        name: PRODUCT_NAME,
        version: VERSION,
    }
}

#[cfg(test)]
mod tests {
    use super::{PRODUCT_NAME, VERSION, product_info};

    #[test]
    fn product_identity_matches_package_authority() {
        let product = product_info();

        assert_eq!(product.name, PRODUCT_NAME);
        assert_eq!(product.version, VERSION);
        assert_eq!(product.version, "0.0.0");
    }
}
