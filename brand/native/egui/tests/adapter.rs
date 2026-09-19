use egui_kittest::{Harness, kittest::Queryable as _};
use shruggie_glitchpad_egui::components::{app_frame, apply_capabilities, apply_style, button, card, checkbox, dialog, empty_state, field, icon_button, list_row, menu, split_pane, status_badge, tabs, toast, toolbar, ButtonIntent};
use shruggie_glitchpad_egui::{Density, Insets, PointerPrecision, RuntimeCapabilities, ThemeMode};
use shruggie_glitchpad_egui::tokens::{logical_points, Tokens, UnitTransformError};

fn capabilities(text_scale: f32) -> RuntimeCapabilities {
    RuntimeCapabilities {
        viewport_points: egui::vec2(1280.0, 720.0),
        safe_area: Insets { top: 0.0, right: 0.0, bottom: 0.0, left: 0.0 },
        window_class: "expanded",
        pointer_precision: PointerPrecision::Fine,
        hover: true,
        hardware_keyboard: true,
        touch: false,
        text_scale,
        reduced_motion: false,
        forced_colors: false,
        ime_obstruction: None,
        titlebar_regions: Vec::new(),
        theme: ThemeMode::System,
        density: Density::Compact,
    }
}

#[test]
fn button_input_and_accessible_name_are_rendered() {
    let mut harness = Harness::new_ui_state(|ui, count: &mut usize| {
        if button(ui, "Save", ButtonIntent::Primary, false).clicked() { *count += 1; }
        icon_button(ui, "Close", "x", false);
    }, 0usize);
    harness.get_by_label("Close");
    harness.get_by_label("Save").click();
    harness.run();
    assert_eq!(*harness.state(), 1);
}

#[test]
fn selection_and_error_state_are_rendered() {
    #[derive(Default)] struct State { selected: usize, value: String }
    let mut harness = Harness::new_ui_state(|ui, state: &mut State| {
        tabs(ui, &mut state.selected, &["One", "Two"]);
        field(ui, "Name", &mut state.value, Some("Required"));
    }, State::default());
    harness.get_by_label("Two").click();
    harness.run();
    assert_eq!(harness.state().selected, 1);
    harness.get_by_label("Name");
    harness.get_by_label("Required");
}

#[test]
fn complete_recipe_grammar_renders_in_egui() {
    #[derive(Default)] struct State { selected: usize, value: String, checked: bool, row: bool, dialog_open: bool }
    let mut harness = Harness::new_ui_state(|ui, state: &mut State| {
        state.dialog_open = true;
        let runtime = capabilities(1.0);
        app_frame(ui, &runtime, |ui| {
            toolbar(ui, false, |ui| {
                button(ui, "Primary", ButtonIntent::Primary, false);
                icon_button(ui, "Settings", "*", false);
            });
            tabs(ui, &mut state.selected, &["Alpha", "Beta"]);
            menu(ui, "Actions", |ui| ui.button("Run"));
            field(ui, "Project", &mut state.value, None);
            checkbox(ui, &mut state.checked, "Enabled");
            list_row(ui, &mut state.row, "Row");
            split_pane(ui, |ui| ui.label("Primary pane"), |ui| ui.label("Secondary pane"));
            toast(ui, "Saved", false);
            status_badge(ui, "Ready", false);
            card(ui, |ui| ui.label("Card content"));
            empty_state(ui, "Nothing here", "Create the first item");
        }).unwrap();
        let context = ui.ctx().clone();
        dialog(&context, &mut state.dialog_open, "Confirm", |ui| ui.label("Dialog content"));
    }, State::default());
    harness.run();
    for label in ["Primary", "Settings", "Alpha", "Actions", "Project", "Enabled", "Row", "Saved", "Ready", "Nothing here", "Confirm"] {
        harness.get_by_label(label);
    }
}

#[test]
fn density_and_pixels_per_point_remain_independent() {
    let comfortable = Tokens::for_theme(ThemeMode::Dark, Density::Comfortable);
    let compact = Tokens::for_theme(ThemeMode::Dark, Density::Compact);
    assert!(compact.spacing_component < comfortable.spacing_component);
    assert_eq!(compact.target_minimum, comfortable.target_minimum);
    let mut harness = Harness::new_ui(|ui| { ui.label("Scaled"); });
    harness.set_pixels_per_point(2.0);
    harness.run();
    assert_eq!(harness.ctx.pixels_per_point(), 2.0);
}

#[test]
fn invalid_units_and_runtime_scaling_fail_closed() {
    assert_eq!(logical_points(f32::NAN), Err(UnitTransformError::NonFinite));
    assert_eq!(logical_points(0.0), Err(UnitTransformError::NonPositive));
    assert_eq!(logical_points(2.0).unwrap(), 2.0);
    let mut capabilities = capabilities(1.5);
    let context = egui::Context::default();
    apply_capabilities(&context, &capabilities).unwrap();
    assert_eq!(context.options(|options| options.theme_preference), egui::ThemePreference::System);
    capabilities.text_scale = 0.0;
    assert!(apply_capabilities(&context, &capabilities).is_err());
}

#[test]
fn generated_style_applies_focus_selection_tokens() {
    let mut harness = Harness::new_ui(|ui| { apply_style(ui.ctx(), ThemeMode::Light, Density::Comfortable); ui.button("Focus target"); });
    harness.run();
    let expected = Tokens::for_theme(ThemeMode::Light, Density::Comfortable).action;
    assert_eq!(harness.ctx.style_of(egui::Theme::Light).visuals.selection.bg_fill, expected);
}
