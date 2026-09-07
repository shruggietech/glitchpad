# Contract: Linux Desktop Integration

**Contract version**: 1

## Desktop entry

The installed entry is an application entry for Glitchpad, launches the installed native executable with a safe multi-file field code, sets `Terminal=false`, uses the approved icon name, and declares only the categories and media types governed by the Linux package contract. It contains no shell wrapper, command substitution, redirection, environment assignment, absolute build path, URI field code, deprecated pattern/default keys, or MIME priority.

## Stable media types and extensions

`packaging/linux/mime-map.json` maps freedesktop media types to the stable extensions in `packaging/desktop/capabilities.json`. Every family and extension must agree exactly with the stable inventory. The package may install a shared-MIME definition only for a Glitchpad-owned stable type that is not reliably supplied by the platform; it must add only its own lowercase globs and must not delete, override, add magic for, or claim a forbidden format.

## Delivery behavior

Desktop and command-line delivery use the existing native desktop delivery queue. One or more safely separated file arguments are converted to native source handles, revalidated, and delivered to interface state without serializing native paths. A second process forwards its arguments to the active session, preserves order, focuses the intended source exactly once, and does not discard unsaved work. Directories, missing files, non-file URIs, duplicates, and unsafe inputs yield explicit bounded outcomes.

## Installation and removal

The Debian package installs its executable, desktop entry, approved icon resources, notices, and any package-owned MIME definition under conventional system prefixes. Maintainer actions refresh desktop, icon, and MIME databases non-interactively and tolerate absent optional cache tools. Removal deletes package-owned integration but preserves user documents, preferences, recovery data, and user-selected application defaults.

The AppImage carries an equivalent desktop entry, icon, executable, license, notices, and stable declarations inside its image. Running it does not silently install system integration or mutate default-application preferences.

## Validation

Static validation parses the actual desktop entry, MIME declarations, Debian metadata and inventories, and extracted AppImage inventory. Clean-environment validation queries installed desktop/MIME state, exercises startup and running-instance delivery with spaces, Unicode and leading-dash filenames, then removes the package and proves package-owned registration is absent. Any broader claim or stale registration fails the package gate.
