use glitchpad_core::image_family::{decode_family, image_signature};
use glitchpad_core::images::{ImageContainer, ImageFailure, ImageFamilyState, ImageLimits};
use sha2::{Digest, Sha256};
use std::fmt::Write as _;
use std::sync::atomic::AtomicBool;

fn decode(
    bytes: &[u8],
    selection: u32,
) -> Result<glitchpad_core::image_family::FamilyPreview, ImageFailure> {
    decode_family(
        bytes,
        selection,
        &ImageLimits::desktop(),
        &AtomicBool::new(false),
    )
}

#[test]
fn svg_is_signature_identified_and_rendered_to_inert_pixels() {
    let svg = br##"<?xml version="1.0"?><!-- local --><svg xmlns="http://www.w3.org/2000/svg" width="2" height="1"><rect width="1" height="1" fill="#ff0000"/></svg>"##;
    assert_eq!(image_signature(svg), Some(ImageContainer::Svg));
    assert_eq!(image_signature(b"<document/>"), None);
    let result = decode(svg, 0).unwrap();
    let image = image::load_from_memory(&result.preview.png_bytes)
        .unwrap()
        .into_rgba8();
    assert_eq!(image.get_pixel(0, 0).0, [255, 0, 0, 255]);
    assert_eq!(image.get_pixel(1, 0).0, [0, 0, 0, 0]);
    assert!(matches!(
        result.state,
        ImageFamilyState::Svg {
            external_resources: false,
            scripts: false,
            ..
        }
    ));
}

#[test]
fn svg_refuses_active_external_and_unbounded_scratch_constructs() {
    for body in [
        "<script>alert(1)</script>",
        "<foreignObject/>",
        "<image href=\"https://invalid.example/pixel\"/>",
        "<image href=\"data:image/png;base64,AA==\"/>",
        "<use href=\"#recursive\"/>",
        "<filter/>",
        "<mask/>",
        "<style>@import url(https://invalid.example/style);</style>",
        "<rect onclick=\"alert(1)\"/>",
        "<rect fill=\"url(https://invalid.example/paint)\"/>",
    ] {
        let svg = format!(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"2\" height=\"2\">{body}</svg>"
        );
        assert!(decode(svg.as_bytes(), 0).is_err(), "accepted {body}");
    }
    assert!(decode(br#"<!DOCTYPE svg [<!ENTITY x "expanded">]><svg xmlns="http://www.w3.org/2000/svg" width="1" height="1">&x;</svg>"#, 0).is_err());
    assert_eq!(
        decode(
            br#"<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="100000"/>"#,
            0
        )
        .unwrap_err(),
        ImageFailure::Oversized
    );
}

fn icon(payloads: &[Vec<u8>]) -> Vec<u8> {
    let mut bytes = vec![0, 0, 1, 0];
    bytes.extend_from_slice(&(u16::try_from(payloads.len()).unwrap()).to_le_bytes());
    let mut offset = 6 + 16 * payloads.len();
    for payload in payloads {
        bytes.extend_from_slice(&[1, 1, 0, 0, 1, 0, 32, 0]);
        bytes.extend_from_slice(&(u32::try_from(payload.len()).unwrap()).to_le_bytes());
        bytes.extend_from_slice(&(u32::try_from(offset).unwrap()).to_le_bytes());
        offset += payload.len();
    }
    for payload in payloads {
        bytes.extend_from_slice(payload);
    }
    bytes
}

#[test]
fn animation_admits_encoded_metadata_coexistence_before_sanitizing() {
    let mut bytes = include_bytes!("../../../fixtures/images/original.gif").to_vec();
    assert_eq!(bytes.pop(), Some(0x3b));
    bytes.extend_from_slice(&[0x21, 0xfe]);
    for _ in 0..16_384 {
        bytes.push(255);
        bytes.extend_from_slice(&[42; 255]);
    }
    bytes.extend_from_slice(&[0, 0x3b]);
    let mut limits = ImageLimits::desktop();
    limits.peak_bytes = 75 * 1024 * 1024;
    assert!(matches!(
        glitchpad_core::image_family::AnimationContext::new(
            &bytes,
            &limits,
            &AtomicBool::new(false)
        ),
        Err(ImageFailure::Allocation)
    ));
}

#[test]
fn ico_corrupt_entries_do_not_hide_valid_entries_or_export_source_metadata() {
    use image::ImageEncoder;
    let mut png = Vec::new();
    image::codecs::png::PngEncoder::new(&mut png)
        .write_image(&[255, 0, 0, 128], 1, 1, image::ExtendedColorType::Rgba8)
        .unwrap();
    let bytes = icon(&[vec![0; 16], png.clone(), png]);
    let result = decode(&bytes, 1).unwrap();
    let ImageFamilyState::Ico {
        entries,
        selected_entry,
        ..
    } = result.state
    else {
        panic!("wrong family")
    };
    assert_eq!(entries.len(), 3);
    assert!(entries[0].failure.is_some());
    assert_eq!(entries[2].duplicate_of, Some(1));
    assert_eq!(selected_entry, Some(1));
    assert_eq!(
        image::load_from_memory(&result.preview.png_bytes)
            .unwrap()
            .into_rgba8()
            .get_pixel(0, 0)
            .0,
        [255, 0, 0, 128]
    );
    assert!(decode(&bytes, 0).is_err());
    let mut malicious = bytes.clone();
    malicious[18..22].copy_from_slice(&u32::MAX.to_le_bytes());
    let neighbor = decode(&malicious, 1).unwrap();
    let ImageFamilyState::Ico { entries, .. } = neighbor.state else {
        panic!("wrong family")
    };
    assert_eq!(entries[0].failure, Some(ImageFailure::Truncated));
    assert_eq!(entries[0].encoding, "unknown");
    assert_eq!(entries.len(), 3);
    malicious[14..18].copy_from_slice(&u32::MAX.to_le_bytes());
    assert!(decode(&malicious, 1).is_ok());
    malicious[18..22].copy_from_slice(&0_u32.to_le_bytes());
    assert!(decode(&malicious, 1).is_ok());
    assert!(decode(&malicious, 0).is_err());
}

fn animation_gif() -> Vec<u8> {
    let mut bytes = Vec::new();
    {
        let mut encoder = gif::Encoder::new(
            &mut bytes,
            3,
            1,
            &[255, 0, 0, 0, 0, 255, 0, 255, 0, 0, 0, 0],
        )
        .unwrap();
        encoder.set_repeat(gif::Repeat::Finite(2)).unwrap();
        for (left, pixels, dispose) in [
            (0, vec![0, 0, 0], gif::DisposalMethod::Keep),
            (1, vec![1], gif::DisposalMethod::Previous),
            (2, vec![2], gif::DisposalMethod::Background),
            (0, vec![3], gif::DisposalMethod::Keep),
        ] {
            let frame = gif::Frame {
                left,
                width: u16::try_from(pixels.len()).unwrap(),
                height: 1,
                delay: 4,
                dispose,
                transparent: Some(3),
                buffer: pixels.into(),
                ..Default::default()
            };
            encoder.write_frame(&frame).unwrap();
        }
    }
    bytes
}

fn pixels(result: &glitchpad_core::image_family::FamilyPreview) -> Vec<u8> {
    image::load_from_memory(&result.preview.png_bytes)
        .unwrap()
        .into_rgba8()
        .into_raw()
}

#[test]
fn gif_incrementally_composes_previous_background_transparency_and_backward_seek() {
    use glitchpad_core::image_family::AnimationContext;
    let bytes = animation_gif();
    let cancel = AtomicBool::new(false);
    let mut context = AnimationContext::new(&bytes, &ImageLimits::desktop(), &cancel).unwrap();
    let red = [255, 0, 0, 255];
    let blue = [0, 0, 255, 255];
    let green = [0, 255, 0, 255];
    let clear = [0, 0, 0, 0];
    assert_eq!(
        pixels(&context.frame(0, &cancel).unwrap()),
        [red, red, red].concat()
    );
    assert_eq!(
        pixels(&context.frame(1, &cancel).unwrap()),
        [red, blue, red].concat()
    );
    assert_eq!(
        pixels(&context.frame(2, &cancel).unwrap()),
        [red, red, green].concat()
    );
    assert_eq!(
        pixels(&context.frame(3, &cancel).unwrap()),
        [red, red, clear].concat()
    );
    let again = context.frame(0, &cancel).unwrap();
    assert_eq!(pixels(&again), [red, red, red].concat());
    assert!(matches!(
        again.state,
        ImageFamilyState::Animation {
            selected_frame: 0,
            frame_count: Some(4),
            loop_count: Some(2),
            frame_duration_ms: Some(40),
            paused: true,
            ..
        }
    ));
    assert!(context.frame(4, &cancel).is_err());
    cancel.store(true, std::sync::atomic::Ordering::Release);
    assert_eq!(
        context.frame(1, &cancel).unwrap_err(),
        ImageFailure::Cancelled
    );
    assert!(decode(&bytes[..bytes.len() - 1], 0).is_err());
}

fn chunk(tag: [u8; 4], payload: &[u8]) -> Vec<u8> {
    let mut bytes = tag.to_vec();
    bytes.extend_from_slice(&(u32::try_from(payload.len()).unwrap()).to_le_bytes());
    bytes.extend_from_slice(payload);
    if payload.len() % 2 == 1 {
        bytes.push(0);
    }
    bytes
}

fn animation_webp() -> Vec<u8> {
    let mut chunks = chunk(*b"VP8X", &[0x12, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
    chunks.extend(chunk(*b"ANIM", &[0, 0, 0, 0, 0, 0]));
    for (color, duration) in [([255, 0, 0, 255], 40), ([0, 0, 255, 128], 60)] {
        let mut still = Vec::new();
        image_webp::WebPEncoder::new(&mut still)
            .encode(&[color, color].concat(), 2, 1, image_webp::ColorType::Rgba8)
            .unwrap();
        let mut frame = vec![0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, duration, 0, 0, 2];
        frame.extend_from_slice(&still[12..]);
        chunks.extend(chunk(*b"ANMF", &frame));
    }
    let mut bytes = b"RIFF".to_vec();
    bytes.extend_from_slice(&(u32::try_from(chunks.len() + 4).unwrap()).to_le_bytes());
    bytes.extend_from_slice(b"WEBP");
    bytes.extend(chunks);
    bytes
}

#[test]
fn webp_nested_dimensions_are_refused_before_decoder_creation() {
    let cancel = AtomicBool::new(false);
    let mut bytes = animation_webp();
    let at = bytes.windows(4).position(|n| n == b"VP8L").unwrap() + 9;
    bytes[at..at + 4].copy_from_slice(&(0x3fff_u32 | (0x3fff_u32 << 14)).to_le_bytes());
    assert!(matches!(
        glitchpad_core::image_family::AnimationContext::new(
            &bytes,
            &ImageLimits::desktop(),
            &cancel
        ),
        Err(ImageFailure::Malformed)
    ));
    for alpha in [false, true] {
        let mut chunks = chunk(*b"VP8X", &[0x12, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
        chunks.extend(chunk(*b"ANIM", &[0; 6]));
        let mut frame = vec![0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 40, 0, 0, 2];
        if alpha {
            frame.extend(chunk(*b"ALPH", &[0, 255, 255]));
        }
        frame.extend(chunk(
            *b"VP8 ",
            &[0x10, 0, 0, 0x9d, 1, 0x2a, 0xff, 0x3f, 0xff, 0x3f],
        ));
        chunks.extend(chunk(*b"ANMF", &frame));
        let mut bytes = b"RIFF".to_vec();
        bytes.extend_from_slice(&(u32::try_from(chunks.len() + 4).unwrap()).to_le_bytes());
        bytes.extend_from_slice(b"WEBP");
        bytes.extend(chunks);
        assert!(matches!(
            glitchpad_core::image_family::AnimationContext::new(
                &bytes,
                &ImageLimits::desktop(),
                &cancel
            ),
            Err(ImageFailure::Malformed)
        ));
    }
}

#[test]
fn animated_webp_composes_selected_frames_and_reconstructs_on_loop_restart() {
    let bytes = animation_webp();
    let cancel = AtomicBool::new(false);
    let mut context = glitchpad_core::image_family::AnimationContext::new(
        &bytes,
        &ImageLimits::desktop(),
        &cancel,
    )
    .unwrap();
    assert_eq!(
        pixels(&context.frame(0, &cancel).unwrap()),
        [[255, 0, 0, 255]; 2].concat()
    );
    let second = context.frame(1, &cancel).unwrap();
    assert_eq!(pixels(&second), [[0, 0, 255, 128]; 2].concat());
    assert!(matches!(
        second.state,
        ImageFamilyState::Animation {
            frame_count: Some(2),
            loop_count: Some(0),
            frame_duration_ms: Some(60),
            ..
        }
    ));
    assert_eq!(
        pixels(&context.frame(0, &cancel).unwrap()),
        [[255, 0, 0, 255]; 2].concat()
    );
    let mut huge = bytes.clone();
    huge[24..30].copy_from_slice(&[255; 6]);
    assert!(decode(&huge, 0).is_err());
}

#[test]
fn original_family_corpus_preserves_dimensions_and_independent_dib_entries() {
    for name in [
        "original.gif",
        "animated.webp",
        "original.svg",
        "entries.ico",
    ] {
        let bytes = std::fs::read(format!("../../fixtures/images/{name}")).unwrap();
        let result = decode(&bytes, 0).unwrap();
        assert_eq!(
            (
                result.preview.descriptor.width,
                result.preview.descriptor.height
            ),
            (4, 3)
        );
        if name == "entries.ico" {
            let dib = decode(&bytes, 1).unwrap();
            assert_eq!(dib.preview.descriptor.display_width, 4);
            assert_eq!(pixels(&dib), pixels(&result));
            assert!(decode(&bytes, 3).is_err());
            let ImageFamilyState::Ico { entries, .. } = result.state else {
                panic!("wrong family")
            };
            assert_eq!(entries.len(), 4);
            assert_eq!(entries[1].encoding, "dib");
            assert_eq!(entries[2].duplicate_of, Some(0));
        }
    }
    let font = include_bytes!("../../../brand/fonts/ttf/Geist-Regular.ttf");
    assert_eq!(
        format!("{:x}", Sha256::digest(font)),
        "43065e72260288e84672cd1f27e1a8f8889b636a74f5f9252649365c41e8eca8"
    );
}

#[test]
fn svg_node_depth_text_and_cancellation_limits_fail_before_pixels() {
    let root = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1\" height=\"1\">";
    let nodes = format!("{root}{}</svg>", "<rect/>".repeat(50000));
    assert_eq!(
        decode(nodes.as_bytes(), 0).unwrap_err(),
        ImageFailure::Oversized
    );
    let deep = format!("{root}{}{}</svg>", "<g>".repeat(129), "</g>".repeat(129));
    assert_eq!(
        decode(deep.as_bytes(), 0).unwrap_err(),
        ImageFailure::Oversized
    );
    let text = format!("{root}<text>{}</text></svg>", "x".repeat(65537));
    assert_eq!(
        decode(text.as_bytes(), 0).unwrap_err(),
        ImageFailure::Oversized
    );
    let svg = format!("{root}</svg>");
    assert_eq!(
        decode_family(
            svg.as_bytes(),
            0,
            &ImageLimits::desktop(),
            &AtomicBool::new(true)
        )
        .unwrap_err(),
        ImageFailure::Cancelled
    );
}

#[test]
fn gif_frame_inventory_limit_is_enforced_before_codec_surface_construction() {
    let mut bytes = Vec::new();
    {
        let mut encoder = gif::Encoder::new(&mut bytes, 1, 1, &[255, 0, 0, 0, 0, 0]).unwrap();
        let frame = gif::Frame {
            width: 1,
            height: 1,
            delay: 1,
            buffer: vec![0].into(),
            ..Default::default()
        };
        for _ in 0..1025 {
            encoder.write_frame(&frame).unwrap();
        }
    }
    assert_eq!(decode(&bytes, 0).unwrap_err(), ImageFailure::Oversized);
}

#[test]
fn practical_svg_exports_render_expected_pixels_without_changing_sources() {
    for name in [
        "svg-presentation.svg",
        "svg-namespaced.svg",
        "svg-reuse.svg",
    ] {
        let bytes = std::fs::read(format!("../../fixtures/images/{name}")).unwrap();
        let before = Sha256::digest(&bytes);
        assert_eq!(image_signature(&bytes), Some(ImageContainer::Svg), "{name}");
        let decoded = decode(&bytes, 0).unwrap_or_else(|e| panic!("{name}: {e:?}"));
        let pixels = image::load_from_memory(&decoded.preview.png_bytes)
            .unwrap()
            .into_rgba8();
        assert_eq!(pixels.dimensions(), (4, 3), "{name}");
        assert!(pixels.pixels().all(|p| p.0 == [18, 52, 86, 255]), "{name}");
        assert_eq!(
            Sha256::digest(std::fs::read(format!("../../fixtures/images/{name}")).unwrap()),
            before
        );
    }
}

#[test]
fn svg_refusals_are_stable_and_distinguish_references_profile_and_syntax() {
    for (body, expected) in [
        ("<script/>", "svg_unsupported"),
        ("<filter/>", "svg_unsupported"),
        ("<rect onclick='run()'/>", "svg_unsupported"),
        (
            "<image href='data:image/png;base64,AA=='/>",
            "svg_external_reference",
        ),
        (
            "<use href='https://invalid.example/a#x'/>",
            "svg_external_reference",
        ),
        (
            "<rect style='fill:url(https://invalid.example/paint)'/>",
            "svg_external_reference",
        ),
        (
            "<style>@import url(https://invalid.example/style);</style>",
            "svg_external_reference",
        ),
        ("<use href='#absent'/>", "svg_missing_reference"),
        (
            "<g id='a'><use href='#b'/></g><g id='b'><use href='#a'/></g>",
            "svg_cyclic_reference",
        ),
        ("<rect></path>", "malformed"),
    ] {
        let svg =
            format!("<svg xmlns='http://www.w3.org/2000/svg' width='4' height='3'>{body}</svg>");
        assert_eq!(
            serde_json::to_value(decode(svg.as_bytes(), 0).unwrap_err()).unwrap(),
            expected,
            "{body}"
        );
    }
}

#[test]
fn svg_local_reference_precedence_and_expanded_budget_match_the_renderer() {
    let valid = br##"<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="4" height="3"><defs><rect id="r" width="4" height="3" fill="#123456"/><rect id="r" width="4" height="3" fill="red"/></defs><use href="#r" xlink:href="https://invalid.example/ignored"/></svg>"##;
    let result = decode(valid, 0).unwrap();
    assert!(
        pixels(&result)
            .chunks_exact(4)
            .all(|p| p == [18, 52, 86, 255])
    );
    let mut definitions = String::from("<g id='n0'><rect width='1' height='1'/></g>");
    for i in 1..17 {
        write!(
            definitions,
            "<g id='n{i}'><use href='#n{}'/><use href='#n{}'/></g>",
            i - 1,
            i - 1
        )
        .unwrap();
    }
    let bomb = format!(
        "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'><defs>{definitions}</defs><use href='#n16'/></svg>"
    );
    assert_eq!(
        decode(bomb.as_bytes(), 0).unwrap_err(),
        ImageFailure::Oversized
    );
}

#[test]
fn local_presentation_paint_and_clip_references_render_and_cycles_refuse() {
    let svg = br##"<s:svg xmlns:s="http://www.w3.org/2000/svg" xmlns:rdf="urn:fixture-metadata" width="4" height="3"><s:metadata><rdf:description>literal @ and backslash \ are metadata</rdf:description></s:metadata><s:style>/* @import is only a comment */ .ink {fill:url('#paint');font-family:'local@name';}</s:style><s:defs><s:linearGradient id="paint"><s:stop stop-color="#123456"/><s:stop offset="1" stop-color="#123456"/></s:linearGradient><s:clipPath id="clip"><s:rect width="2" height="3"/></s:clipPath></s:defs><s:rect width="4" height="3" class="ink" clip-path="url(#clip)"/></s:svg>"##;
    let image = image::load_from_memory(&decode(svg, 0).unwrap().preview.png_bytes)
        .unwrap()
        .into_rgba8();
    assert_eq!(image.get_pixel(0, 0).0, [18, 52, 86, 255]);
    assert_eq!(image.get_pixel(3, 0).0, [0, 0, 0, 0]);
    let cyclic=br#"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><defs><clipPath id="c"><rect width="4" height="3" clip-path="url(#c)"/></clipPath></defs><rect width="4" height="3" clip-path="url(#c)"/></svg>"#;
    assert_eq!(
        decode(cyclic, 0).unwrap_err(),
        ImageFailure::SvgCyclicReference
    );
    for (name, reason) in [
        ("svg-external.svg", ImageFailure::SvgExternalReference),
        ("svg-cycle.svg", ImageFailure::SvgCyclicReference),
        ("svg-missing.svg", ImageFailure::SvgMissingReference),
        ("svg-malformed.svg", ImageFailure::Malformed),
        ("svg-unsupported.svg", ImageFailure::SvgUnsupported),
        ("svg-resource.svg", ImageFailure::Oversized),
    ] {
        assert_eq!(
            decode(
                &std::fs::read(format!("../../fixtures/images/{name}")).unwrap(),
                0
            )
            .unwrap_err(),
            reason,
            "{name}"
        );
    }
}

#[test]
fn font_and_entity_declarations_report_the_actual_refusal_group() {
    for (style, reason) in [
        (
            "@font-face { font-family: Fixture; src: local('Geist'); }",
            ImageFailure::SvgUnsupported,
        ),
        (
            "@font-face { font-family: Fixture; src: url('https://invalid.example/font'); }",
            ImageFailure::SvgExternalReference,
        ),
    ] {
        let svg = format!(
            "<svg xmlns='http://www.w3.org/2000/svg' width='4' height='3'><style>{style}</style><rect width='4' height='3'/></svg>"
        );
        assert_eq!(decode(svg.as_bytes(), 0).unwrap_err(), reason);
    }
    let internal=br#"<!DOCTYPE svg [<!ENTITY x "local">]><svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><text>&x;</text></svg>"#;
    assert_eq!(
        decode(internal, 0).unwrap_err(),
        ImageFailure::SvgExternalReference
    );
}

#[test]
fn css_selector_traversal_is_bounded_before_pinned_recursive_matching() {
    for components in [128, 129] {
        let selector = format!("{}#target", "g + ".repeat(components - 1));
        let svg = format!(
            "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'><style>{selector} {{fill:#123456}}</style>{}<g id='target'><rect width='1' height='1'/></g></svg>",
            "<g/>".repeat(components - 1)
        );
        if components == 128 {
            assert_eq!(
                pixels(&decode(svg.as_bytes(), 0).unwrap()),
                [18, 52, 86, 255]
            );
        } else {
            assert_eq!(
                decode(svg.as_bytes(), 0).unwrap_err(),
                ImageFailure::Oversized
            );
        }
    }
    let value = "+ > , ".repeat(160);
    let svg = format!(
        "<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'><style>/* {} */ rect[data-note='{value}'] {{fill:#123456}}</style><rect data-note='{value}' width='1' height='1'/></svg>",
        "g + ".repeat(160)
    );
    assert_eq!(
        pixels(&decode(svg.as_bytes(), 0).unwrap()),
        [18, 52, 86, 255]
    );
}
