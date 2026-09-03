use std::env;
use std::ffi::OsStr;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn main() -> ExitCode {
    let command = env::args().nth(1).unwrap_or_else(|| "help".to_owned());
    let repository = repository_root();
    let result = match command.as_str() {
        "bootstrap" => bootstrap(&repository),
        "check" => check(&repository),
        "docs" => docs(&repository),
        "doctor" => doctor(&repository),
        "package" => package(&repository),
        "release-check" => release_check(&repository),
        "test" => test(&repository),
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        other => Err(format!("unknown xtask command: {other}")),
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("error: {message}");
            ExitCode::FAILURE
        }
    }
}

fn repository_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(Path::parent)
        .expect("xtask must remain under crates/xtask")
        .to_path_buf()
}

fn print_help() {
    println!("Glitchpad repository tasks");
    println!();
    println!("  cargo xtask bootstrap  install repository dependencies from locks");
    println!("  cargo xtask doctor  report pinned development prerequisites");
    println!("  cargo xtask docs    validate documentation and public metadata");
    println!("  cargo xtask check   run native, frontend, and documentation gates");
    println!("  cargo xtask test    run native and frontend unit tests");
    println!("  cargo xtask package build non-distributable development artifacts");
    println!("  cargo xtask release-check validate release-only state");
}

fn bootstrap(repository: &Path) -> Result<(), String> {
    run(
        repository,
        "corepack",
        ["prepare", "pnpm@10.28.2", "--activate"],
    )?;
    run(repository, "pnpm", ["install", "--frozen-lockfile"])?;
    run(
        repository,
        "cargo",
        ["install", "cargo-deny", "--version", "0.20.2", "--locked"],
    )
}

fn doctor(repository: &Path) -> Result<(), String> {
    println!("Glitchpad development environment");
    require_output(repository, "rustc", ["--version"], "rustc 1.96.0")?;
    require_output(repository, "cargo", ["--version"], "cargo 1.96.0")?;
    require_output(repository, "node", ["--version"], "v24.11.0")?;
    require_output(repository, "pnpm", ["--version"], "10.28.2")?;
    require_minimum_version(repository, "git", ["--version"], (2, 45, 0))?;
    require_output(
        repository,
        "cargo",
        ["deny", "--version"],
        "cargo-deny 0.20.2",
    )?;
    require_output(repository, "pwsh", ["--version"], "PowerShell 7.")?;
    require_output(repository, "rg", ["--version"], "ripgrep")?;

    report_environment("ANDROID_HOME");
    report_environment("ANDROID_SDK_ROOT");
    report_environment("JAVA_HOME");

    println!(
        "Doctor completed. Platform-specific SDK entries are informational until that platform is built."
    );
    Ok(())
}

fn require_output<I, S>(
    repository: &Path,
    program: &str,
    arguments: I,
    expected: &str,
) -> Result<(), String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let executable = platform_program(program);
    let output = headless_command(&executable)
        .args(arguments)
        .current_dir(repository)
        .output()
        .map_err(|error| {
            format!(
                "required tool {program} could not start: {error}. Install it as documented in CONTRIBUTING.md"
            )
        })?;
    let observed = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let observed = observed.trim();
    println!("[required] {program}: {observed}");

    if !output.status.success() {
        return Err(format!(
            "required tool {program} exited with {}. Repair the installation and rerun cargo xtask doctor",
            output.status
        ));
    }

    if !observed.contains(expected) {
        return Err(format!(
            "required tool {program} reported '{observed}', expected '{expected}'. Use cargo xtask bootstrap and the pinned setup in CONTRIBUTING.md"
        ));
    }

    Ok(())
}

fn require_minimum_version<I, S>(
    repository: &Path,
    program: &str,
    arguments: I,
    minimum: (u64, u64, u64),
) -> Result<(), String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let executable = platform_program(program);
    let output = headless_command(&executable)
        .args(arguments)
        .current_dir(repository)
        .output()
        .map_err(|error| {
            format!(
                "required tool {program} could not start: {error}. Install it as documented in CONTRIBUTING.md"
            )
        })?;
    let observed = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let observed = observed.trim();
    println!("[required] {program}: {observed}");

    let version = parse_version(observed).ok_or_else(|| {
        format!(
            "could not parse the {program} version from '{observed}'. Verify the tool installation"
        )
    })?;
    if !output.status.success() || version < minimum {
        return Err(format!(
            "required tool {program} reported version {}.{}.{}, but {}.{}.{} or newer is required. Update it as documented in CONTRIBUTING.md",
            version.0, version.1, version.2, minimum.0, minimum.1, minimum.2
        ));
    }

    Ok(())
}

fn parse_version(output: &str) -> Option<(u64, u64, u64)> {
    output.split_whitespace().find_map(|token| {
        let mut numbers = token.trim_start_matches('v').split('.');
        Some((
            numbers.next()?.parse().ok()?,
            numbers.next()?.parse().ok()?,
            numbers.next()?.parse().ok()?,
        ))
    })
}

fn report_environment(name: &str) {
    match env::var_os(name) {
        Some(value) => println!(
            "[optional platform] {name}={}",
            PathBuf::from(value).display()
        ),
        None => println!("[optional platform] {name}=not set"),
    }
}

fn docs(repository: &Path) -> Result<(), String> {
    run(repository, "pnpm", ["run", "check:brand"])?;
    run(repository, "pnpm", ["run", "check:site"])?;
    run(repository, "pnpm", ["run", "check:validation"])?;
    run(repository, "pnpm", ["run", "check:mermaid-runtime"])?;
    run(repository, "pnpm", ["run", "check:metadata"])?;
    run(repository, "pnpm", ["run", "check:persistence"])?;
    run(repository, "pnpm", ["run", "check:performance"])?;
    run(repository, "pnpm", ["run", "check:config"])?;
    run(repository, "pnpm", ["run", "docs:format"])?;
    run(repository, "pnpm", ["run", "docs:lint"])?;
    run(repository, "pnpm", ["run", "docs:links"])?;
    run(repository, "pnpm", ["run", "docs:mermaid"])?;
    run_powershell(repository, "scripts/check-version.ps1")?;
    run_powershell(repository, "scripts/check-encoding.ps1")?;
    run_powershell(repository, "scripts/check-public-surface.ps1")?;
    Ok(())
}

fn test(repository: &Path) -> Result<(), String> {
    run(repository, "cargo", ["test", "--workspace", "--locked"])?;
    run(repository, "pnpm", ["test"])
}

fn package(repository: &Path) -> Result<(), String> {
    run(repository, "pnpm", ["run", "build"])?;
    run(repository, "cargo", ["build", "--workspace", "--locked"])?;
    println!("Development artifacts built. Distribution bundling remains disabled at v0.0.0.");
    Ok(())
}

fn release_check(repository: &Path) -> Result<(), String> {
    check(repository)?;
    run_powershell(repository, "scripts/check-release-readiness.ps1")
}

fn check(repository: &Path) -> Result<(), String> {
    verify_android_source_layout(repository)?;
    run(repository, "cargo", ["fmt", "--all", "--", "--check"])?;
    run(
        repository,
        "cargo",
        [
            "clippy",
            "--workspace",
            "--all-targets",
            "--all-features",
            "--",
            "-D",
            "warnings",
        ],
    )?;
    run(repository, "cargo", ["test", "--workspace", "--locked"])?;
    run(repository, "cargo", ["deny", "check"])?;
    run(repository, "pnpm", ["run", "check:frontend"])?;
    docs(repository)?;
    Ok(())
}

fn verify_android_source_layout(repository: &Path) -> Result<(), String> {
    let required_files = [
        "crates/glitchpad-android-source/src/models.rs",
        "crates/glitchpad-android-source/android/src/main/java/com/shruggietech/glitchpad/source/DeliveryPolicy.kt",
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/FixtureDocumentsProvider.java",
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/AndroidSourceInstrumentedTest.kt",
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/source/RestorationInstrumentedTest.kt",
        "crates/glitchpad-host/gen/android/app/src/androidTest/java/com/shruggietech/glitchpad/performance/PerformanceInstrumentedTest.kt",
    ];
    for relative in required_files {
        if !repository.join(relative).is_file() {
            return Err(format!(
                "required Android source lifecycle file is missing: {relative}"
            ));
        }
    }

    let models_path = repository.join("crates/glitchpad-android-source/src/models.rs");
    let models = std::fs::read_to_string(&models_path)
        .map_err(|error| format!("could not read {}: {error}", models_path.display()))?;
    if models.contains("raw_uri") || models.contains("rawUri") || models.contains("pub uri:") {
        return Err("Android bridge models must not expose raw provider URIs".to_owned());
    }

    let workflow_path = repository.join(".github/workflows/ci.yml");
    let workflow = std::fs::read_to_string(&workflow_path)
        .map_err(|error| format!("could not read {}: {error}", workflow_path.display()))?;
    for required in [
        "api-level: [24, 36]",
        "x86_64-linux-android",
        "android-instrumentation",
    ] {
        if !workflow.contains(required) {
            return Err(format!(
                "Android CI matrix is missing required marker: {required}"
            ));
        }
    }
    if workflow.contains("ReactiveCircus/android-emulator-runner@v") {
        return Err("Android emulator actions must use an immutable commit SHA".to_owned());
    }

    println!("Android source lifecycle layout and CI policy verified.");
    Ok(())
}

fn run<I, S>(repository: &Path, program: &str, arguments: I) -> Result<(), String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    println!("\n> {program}");
    let executable = platform_program(program);
    let status = headless_command(&executable)
        .args(arguments)
        .current_dir(repository)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status()
        .map_err(|error| format!("could not start {program}: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("{program} exited with {status}"))
    }
}

fn platform_program(program: &str) -> String {
    if cfg!(windows) && matches!(program, "corepack" | "pnpm") {
        format!("{program}.cmd")
    } else {
        program.to_owned()
    }
}

fn headless_command(program: &str) -> Command {
    #[cfg(windows)]
    {
        let mut command = Command::new(program);
        command.creation_flags(CREATE_NO_WINDOW);
        command
    }
    #[cfg(not(windows))]
    {
        Command::new(program)
    }
}

fn run_powershell(repository: &Path, script: &str) -> Result<(), String> {
    run(
        repository,
        "pwsh",
        ["-NoLogo", "-NoProfile", "-File", script],
    )
}

#[cfg(test)]
mod tests {
    use super::{parse_version, platform_program, repository_root, verify_android_source_layout};

    #[test]
    fn repository_root_contains_workspace_manifest() {
        assert!(repository_root().join("Cargo.toml").is_file());
    }

    #[test]
    fn package_manager_executable_matches_host_convention() {
        let expected = if cfg!(windows) { "pnpm.cmd" } else { "pnpm" };

        assert_eq!(platform_program("pnpm"), expected);
    }

    #[test]
    fn parses_versions_with_platform_suffixes() {
        assert_eq!(
            parse_version("git version 2.55.0.windows.3"),
            Some((2, 55, 0))
        );
        assert_eq!(parse_version("v24.11.0"), Some((24, 11, 0)));
    }

    #[test]
    fn android_source_layout_is_policy_checked() {
        verify_android_source_layout(&repository_root()).unwrap();
    }
}
