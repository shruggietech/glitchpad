//! Passive SVG admission before the pinned converter, with no resource resolution.
use crate::images::ImageFailure;
use quick_xml::{Reader, events::Event};
use roxmltree::{Document, Node};
use std::{collections::HashMap, sync::atomic::AtomicBool, time::Instant};

const SVG: &str = "http://www.w3.org/2000/svg";
const XLINK: &str = "http://www.w3.org/1999/xlink";
const XML: &str = "http://www.w3.org/XML/1998/namespace";

fn budget(cancel: &AtomicBool, deadline: Instant) -> Result<(), ImageFailure> {
    super::check(cancel)?;
    if Instant::now() > deadline {
        return Err(ImageFailure::Deadline);
    }
    Ok(())
}

// Bound selector relations before either our matcher or usvg can recurse across
// siblings. Quotes/comments are skipped by css_syntax; attribute and pseudo-class
// interiors do not introduce traversal relations. A comma starts a new selector.
#[derive(Default)]
struct SelectorBound {
    declarations: bool,
    components: u16,
    seen: bool,
    space: bool,
    brackets: u32,
    parentheses: u32,
}
impl SelectorBound {
    fn component(&mut self) -> Result<(), ImageFailure> {
        if !self.seen || self.space {
            self.components += 1;
        }
        self.seen = true;
        self.space = false;
        if self.components > 128 {
            return Err(ImageFailure::Oversized);
        }
        Ok(())
    }
    fn comment(&mut self) {
        if !self.declarations && self.brackets == 0 && self.parentheses == 0 {
            self.space |= self.seen;
        }
    }
    fn advance(&mut self, byte: u8) -> Result<(), ImageFailure> {
        if self.declarations {
            if byte == b'}' {
                *self = Self::default();
            }
            return Ok(());
        }
        if self.brackets > 0 {
            if byte == b']' {
                self.brackets -= 1;
            }
            return Ok(());
        }
        if self.parentheses > 0 {
            if byte == b'(' {
                self.parentheses += 1;
            } else if byte == b')' {
                self.parentheses -= 1;
            }
            return Ok(());
        }
        match byte {
            b'{' => self.declarations = true,
            b',' => *self = Self::default(),
            b'[' => {
                self.component()?;
                self.brackets = 1;
            }
            b'(' => self.parentheses = 1,
            b'+' | b'>' => {
                self.seen = false;
                self.space = false;
            }
            b if b.is_ascii_whitespace() => self.space |= self.seen,
            _ => self.component()?,
        }
        Ok(())
    }
}

// CSS lexical boundaries matter: @ inside quoted font names/comments is not an import.
// Escape identifiers/at-rules are outside the pinned simplecss presentation subset.
fn css_syntax(text: &str, stylesheet: bool) -> Result<(), ImageFailure> {
    let mut selector = stylesheet.then(SelectorBound::default);
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'/' if bytes.get(i + 1) == Some(&b'*') => {
                let Some(end) = text[i + 2..].find("*/") else {
                    return Err(ImageFailure::SvgUnsupported);
                };
                i += end + 4;
                if let Some(bound) = selector.as_mut() {
                    bound.comment();
                }
            }
            b'\'' | b'"' => {
                let quote = bytes[i];
                i += 1;
                while i < bytes.len() && bytes[i] != quote {
                    if bytes[i] == b'\\' {
                        return Err(ImageFailure::SvgUnsupported);
                    }
                    i += 1;
                }
                if i == bytes.len() {
                    return Err(ImageFailure::SvgUnsupported);
                }
                i += 1;
            }
            b'@' => {
                let start = i + 1;
                let mut end = start;
                while end < bytes.len()
                    && (bytes[end].is_ascii_alphanumeric() || bytes[end] == b'-')
                {
                    end += 1;
                }
                if &text[start..end] == "font-face" {
                    reference_value(&text[end..])?;
                    return Err(ImageFailure::SvgUnsupported);
                }
                return Err(if &text[start..end] == "import" {
                    ImageFailure::SvgExternalReference
                } else {
                    ImageFailure::SvgUnsupported
                });
            }
            b'\\' => return Err(ImageFailure::SvgUnsupported),
            byte => {
                if let Some(bound) = selector.as_mut() {
                    bound.advance(byte)?;
                }
                i += 1;
            }
        }
    }
    Ok(())
}

fn reference_value(value: &str) -> Result<Vec<String>, ImageFailure> {
    // Parse functional references with the same pinned grammar as usvg. This scan
    // recognizes token boundaries, comments and strings, rather than substring policy.
    let mut refs = Vec::new();
    let bytes = value.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'/' && bytes.get(i + 1) == Some(&b'*') {
            let Some(end) = value[i + 2..].find("*/") else {
                return Err(ImageFailure::SvgUnsupported);
            };
            i += end + 4;
        } else if matches!(bytes[i], b'\'' | b'"') {
            let quote = bytes[i];
            i += 1;
            while i < bytes.len() && bytes[i] != quote {
                i += 1;
            }
            i += 1;
        } else if bytes[i].is_ascii_alphabetic() || bytes[i] == b'_' {
            let start = i;
            while i < bytes.len()
                && (bytes[i].is_ascii_alphanumeric() || matches!(bytes[i], b'-' | b'_'))
            {
                i += 1;
            }
            if value[start..i].eq_ignore_ascii_case("url") && bytes.get(i) == Some(&b'(') {
                let Some(end) = value[i..].find(')') else {
                    return Err(ImageFailure::SvgUnsupported);
                };
                let function = &value[start..=i + end];
                let parsed = svgtypes::FuncIRI::from_str(function)
                    .map_err(|_| ImageFailure::SvgExternalReference)?;
                refs.push(parsed.0.to_owned());
                i += end + 1;
            }
        } else {
            i += 1;
        }
    }
    Ok(refs)
}

fn presentation(name: &str) -> bool {
    matches!(
        name,
        "fill"
            | "fill-opacity"
            | "fill-rule"
            | "stroke"
            | "stroke-width"
            | "stroke-opacity"
            | "stroke-linecap"
            | "stroke-linejoin"
            | "stroke-miterlimit"
            | "stroke-dasharray"
            | "stroke-dashoffset"
            | "opacity"
            | "color"
            | "display"
            | "visibility"
            | "font-family"
            | "font-size"
            | "font-style"
            | "font-weight"
            | "font-stretch"
            | "font-variant"
            | "font-kerning"
            | "text-anchor"
            | "dominant-baseline"
            | "alignment-baseline"
            | "baseline-shift"
            | "letter-spacing"
            | "word-spacing"
            | "text-decoration"
            | "writing-mode"
            | "shape-rendering"
            | "text-rendering"
            | "image-rendering"
            | "color-interpolation"
            | "color-rendering"
            | "clip-rule"
            | "clip-path"
            | "stop-color"
            | "stop-opacity"
            | "overflow"
            | "paint-order"
            | "vector-effect"
            | "direction"
            | "unicode-bidi"
            | "white-space"
            | "transform"
    )
}
fn declaration(name: &str, value: &str) -> Result<Vec<String>, ImageFailure> {
    let refs = reference_value(value)?;
    if !presentation(name) {
        return Err(ImageFailure::SvgUnsupported);
    }
    Ok(refs)
}

struct Element<'a, 'input>(Node<'a, 'input>);
impl simplecss::Element for Element<'_, '_> {
    fn parent_element(&self) -> Option<Self> {
        self.0.parent_element().map(Self)
    }
    fn prev_sibling_element(&self) -> Option<Self> {
        self.0.prev_sibling_element().map(Self)
    }
    fn has_local_name(&self, name: &str) -> bool {
        self.0.tag_name().name() == name
    }
    fn attribute_matches(&self, name: &str, op: simplecss::AttributeOperator<'_>) -> bool {
        self.0.attribute(name).is_some_and(|v| op.matches(v))
    }
    fn pseudo_class_matches(&self, class: simplecss::PseudoClass<'_>) -> bool {
        matches!(class, simplecss::PseudoClass::FirstChild)
            && self.0.prev_sibling_element().is_none()
    }
}

pub(super) fn preflight<'a>(
    text: &'a str,
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<Document<'a>, ImageFailure> {
    admit_xml_events(text, cancel, deadline)?;
    let doc = Document::parse_with_options(
        text,
        roxmltree::ParsingOptions {
            allow_dtd: false,
            nodes_limit: 50_000,
            ..Default::default()
        },
    )
    .map_err(|e| {
        if matches!(e, roxmltree::Error::NodesLimitReached) {
            ImageFailure::Oversized
        } else {
            ImageFailure::Malformed
        }
    })?;
    if !doc.root_element().has_tag_name((SVG, "svg")) {
        return Err(ImageFailure::SvgUnsupported);
    }
    let elements: Vec<_> = doc.descendants().filter(Node::is_element).collect();
    let indexes: HashMap<_, _> = elements
        .iter()
        .enumerate()
        .map(|(i, n)| (n.id(), i))
        .collect();
    let mut ids = HashMap::new();
    for (i, n) in elements.iter().enumerate() {
        if n.ancestors().take(130).count() > 128 {
            return Err(ImageFailure::Oversized);
        }
        if let Some(id) = n.attribute("id") {
            ids.entry(id).or_insert(i);
        }
    }
    let sheet = style_sheet(&elements, cancel, deadline)?;
    let graph = reference_graph(&elements, &indexes, &ids, &sheet, cancel, deadline)?;
    let mut memo = vec![None; graph.len()];
    let mut visiting = vec![false; graph.len()];
    for i in 0..graph.len() {
        expanded(i, &graph, &mut memo, &mut visiting, 0, cancel, deadline)?;
    }
    Ok(doc)
}

fn expanded(
    i: usize,
    graph: &[Vec<usize>],
    memo: &mut [Option<(u32, u32)>],
    visiting: &mut [bool],
    level: u32,
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<(u32, u32), ImageFailure> {
    budget(cancel, deadline)?;
    if visiting[i] {
        return Err(ImageFailure::SvgCyclicReference);
    }
    if level > 128 {
        return Err(ImageFailure::Oversized);
    }
    if let Some(cost) = memo[i] {
        return Ok(cost);
    }
    visiting[i] = true;
    let (mut count, mut depth) = (1_u32, 1_u32);
    for &child in &graph[i] {
        let (nodes, levels) = expanded(child, graph, memo, visiting, level + 1, cancel, deadline)?;
        count = count.saturating_add(nodes);
        depth = depth.max(levels + 1);
        if count > 50_000 || depth > 128 {
            return Err(ImageFailure::Oversized);
        }
    }
    visiting[i] = false;
    memo[i] = Some((count, depth));
    Ok((count, depth))
}

fn admit_xml_events(
    text: &str,
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<(), ImageFailure> {
    let mut reader = Reader::from_str(text);
    let (mut depth, mut nodes, mut paths, mut chars) = (0_u32, 0_u32, 0_usize, 0_usize);
    loop {
        budget(cancel, deadline)?;
        let event = reader.read_event().map_err(|_| ImageFailure::Malformed)?;
        if matches!(event, Event::Start(_)) {
            depth += 1;
        }
        if depth > 128 {
            return Err(ImageFailure::Oversized);
        }
        match event {
            Event::Start(e) | Event::Empty(e) => {
                nodes += 1;
                if nodes > 50_000 {
                    return Err(ImageFailure::Oversized);
                }
                for (i, attribute) in e.attributes().enumerate() {
                    if i >= 64 {
                        return Err(ImageFailure::Oversized);
                    }
                    let a = attribute.map_err(|_| ImageFailure::Malformed)?;
                    let value = a
                        .normalized_value(quick_xml::XmlVersion::Implicit1_0)
                        .map_err(|_| ImageFailure::Malformed)?;
                    if value.len() > 65536 {
                        return Err(ImageFailure::Oversized);
                    }
                    if matches!(a.key.local_name().as_ref(), "d" | "points") {
                        paths += value
                            .chars()
                            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.'))
                            .count();
                        if paths > 250_000 {
                            return Err(ImageFailure::Oversized);
                        }
                    }
                }
            }
            Event::Text(e) => chars += e.len(),
            Event::CData(e) => chars += e.len(),
            Event::DocType(_) => return Err(ImageFailure::SvgExternalReference),
            Event::PI(_) => return Err(ImageFailure::SvgUnsupported),
            Event::End(_) => depth = depth.checked_sub(1).ok_or(ImageFailure::Malformed)?,
            Event::Eof => break,
            _ => {}
        }
        if chars > 65536 {
            return Err(ImageFailure::Oversized);
        }
    }
    Ok(())
}

fn style_sheet<'a, 'input: 'a>(
    elements: &[Node<'a, 'input>],
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<simplecss::StyleSheet<'a>, ImageFailure> {
    let mut sheet = simplecss::StyleSheet::new();
    for n in elements {
        budget(cancel, deadline)?;
        let metadata = n.ancestors().any(|n| n.has_tag_name((SVG, "metadata")));
        if metadata && n.tag_name().namespace() != Some(SVG) {
            continue;
        }
        let name = n.tag_name().name();
        if n.tag_name().namespace() != Some(SVG) {
            return Err(ImageFailure::SvgUnsupported);
        }
        if !matches!(
            name,
            "svg"
                | "g"
                | "defs"
                | "symbol"
                | "use"
                | "path"
                | "rect"
                | "circle"
                | "ellipse"
                | "line"
                | "polyline"
                | "polygon"
                | "text"
                | "tspan"
                | "textPath"
                | "title"
                | "desc"
                | "metadata"
                | "style"
                | "linearGradient"
                | "radialGradient"
                | "stop"
                | "clipPath"
        ) {
            if name == "image" {
                return Err(ImageFailure::SvgExternalReference);
            }
            return Err(ImageFailure::SvgUnsupported);
        }
        if name == "style" {
            if n.attribute("type").is_some_and(|t| t != "text/css") {
                return Err(ImageFailure::SvgUnsupported);
            }
            let css = n.text().unwrap_or("");
            css_syntax(css, true)?;
            let parsed = simplecss::StyleSheet::parse(css);
            if !css.trim().is_empty() && parsed.rules.is_empty() {
                return Err(ImageFailure::SvgUnsupported);
            }
            for rule in &parsed.rules {
                for d in &rule.declarations {
                    declaration(d.name, d.value)?;
                }
            }
            sheet.parse_more(css);
        }
    }
    Ok(sheet)
}

fn reference_graph(
    elements: &[Node<'_, '_>],
    indexes: &HashMap<roxmltree::NodeId, usize>,
    ids: &HashMap<&str, usize>,
    sheet: &simplecss::StyleSheet<'_>,
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<Vec<Vec<usize>>, ImageFailure> {
    let mut graph = vec![Vec::new(); elements.len()];
    let mut matching = 0_u32;
    for (i, n) in elements.iter().enumerate() {
        budget(cancel, deadline)?;
        graph[i].extend(
            n.children()
                .filter(Node::is_element)
                .map(|c| indexes[&c.id()]),
        );
        if n.ancestors().any(|n| n.has_tag_name((SVG, "metadata"))) {
            continue;
        }
        let mut refs = Vec::new();
        for a in n.attributes() {
            if !matches!(a.namespace(), None | Some(SVG | XLINK | XML)) {
                continue;
            }
            if a.name().to_ascii_lowercase().starts_with("on") {
                return Err(ImageFailure::SvgUnsupported);
            }
            if a.name() == "href" {
                continue;
            }
            if a.name() == "style" {
                css_syntax(a.value(), false)?;
                let declarations: Vec<_> =
                    simplecss::DeclarationTokenizer::from(a.value()).collect();
                if declarations.is_empty() && !a.value().trim().is_empty() {
                    return Err(ImageFailure::SvgUnsupported);
                }
                for d in declarations {
                    refs.extend(declaration(d.name, d.value)?);
                }
            } else if presentation(a.name())
                || matches!(
                    a.name(),
                    "filter" | "mask" | "marker-start" | "marker-mid" | "marker-end" | "cursor"
                )
            {
                refs.extend(reference_value(a.value())?);
                if matches!(
                    a.name(),
                    "filter" | "mask" | "marker-start" | "marker-mid" | "marker-end" | "cursor"
                ) && a.value() != "none"
                {
                    return Err(ImageFailure::SvgUnsupported);
                }
            }
        }
        if let Some(href) = n.attribute("href").or_else(|| n.attribute((XLINK, "href"))) {
            let id =
                svgtypes::IRI::from_str(href).map_err(|_| ImageFailure::SvgExternalReference)?;
            refs.push(id.0.to_owned());
        }
        for rule in &sheet.rules {
            matching += 1;
            if matching > 250_000 {
                return Err(ImageFailure::Oversized);
            }
            if rule.selector.matches(&Element(*n)) {
                for d in &rule.declarations {
                    refs.extend(declaration(d.name, d.value)?);
                }
            }
        }
        for id in refs {
            graph[i].push(
                *ids.get(id.as_str())
                    .ok_or(ImageFailure::SvgMissingReference)?,
            );
        }
    }
    Ok(graph)
}
