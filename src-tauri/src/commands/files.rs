use std::collections::BTreeSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::util::write_atomic;

#[derive(Deserialize, Clone, Copy, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
enum WriteStrategy {
    #[default]
    Overwrite,
    Skip,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileWrite {
    path: String,
    content: String,
    #[serde(default)]
    strategy: WriteStrategy,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFailure {
    path: String,
    error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteReport {
    written: Vec<String>,
    skipped: Vec<String>,
    failed: Vec<FileFailure>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskFileState {
    path: String,
    sha256: String,
    mtime: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadManifestResult {
    manifest: Option<serde_json::Value>,
    existing: Vec<DiskFileState>,
    is_empty: bool,
    has_manifest: bool,
}

const MANIFEST_NAME: &str = "chz-nest.json";

fn safe_join(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.trim().is_empty() {
        return Err("Empty file path".to_string());
    }

    let relative_path = Path::new(relative);
    if relative_path.is_absolute() {
        return Err(format!("Absolute paths are not allowed: {relative}"));
    }

    for component in relative_path.components() {
        match component {
            Component::Normal(_) => {}
            _ => return Err(format!("Invalid path: {relative}")),
        }
    }

    Ok(root.join(relative_path))
}

fn file_sha256(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| format!("Could not read file: {error}"))?;
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

fn disk_file_state(canonical_root: &Path, relative: &str) -> Result<Option<DiskFileState>, String> {
    let target = safe_join(canonical_root, relative)?;
    let metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("Could not inspect {relative}: {error}")),
    };
    if metadata.file_type().is_symlink() || !metadata.is_file() {
        return Ok(None);
    }

    let canonical_target = match target.canonicalize() {
        Ok(path) => path,
        Err(_) => return Ok(None),
    };
    if !canonical_target.starts_with(canonical_root) {
        return Ok(None);
    }

    let actual_hash = file_sha256(&canonical_target)?;
    let mtime = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis().min(u64::MAX as u128) as u64)
        .unwrap_or_default();

    Ok(Some(DiskFileState {
        path: relative.to_string(),
        sha256: actual_hash,
        mtime,
    }))
}

#[tauri::command]
pub fn read_manifest(root: String, paths: Vec<String>) -> Result<ReadManifestResult, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Target folder does not exist: {root}"));
    }

    let canonical_root = root_path
        .canonicalize()
        .map_err(|error| format!("Could not resolve target folder: {error}"))?;
    let is_empty = fs::read_dir(&canonical_root)
        .map_err(|error| format!("Could not read target folder: {error}"))?
        .next()
        .is_none();

    let manifest_path = canonical_root.join(MANIFEST_NAME);
    let manifest = if manifest_path.exists() {
        let raw = fs::read_to_string(&manifest_path)
            .map_err(|error| format!("Could not read {MANIFEST_NAME}: {error}"))?;
        Some(
            serde_json::from_str::<serde_json::Value>(&raw)
                .map_err(|error| format!("Could not parse {MANIFEST_NAME}: {error}"))?,
        )
    } else {
        None
    };

    let mut candidates = BTreeSet::new();
    if let Some(value) = &manifest {
        let files = value
            .get("files")
            .and_then(|files| files.as_object())
            .ok_or_else(|| format!("{MANIFEST_NAME} is missing its files map"))?;
        candidates.extend(files.keys().cloned());
    }
    candidates.extend(paths);
    candidates.remove(MANIFEST_NAME);

    let mut existing = Vec::new();
    for relative in candidates {
        if let Some(state) = disk_file_state(&canonical_root, &relative)? {
            existing.push(state);
        }
    }

    let has_manifest = manifest.is_some();
    Ok(ReadManifestResult {
        manifest,
        existing,
        is_empty,
        has_manifest,
    })
}

fn ensure_existing_ancestor_inside(
    canonical_root: &Path,
    parent: &Path,
) -> Result<(), String> {
    let mut probe = parent;
    loop {
        match fs::symlink_metadata(probe) {
            Ok(metadata) => {
                if metadata.file_type().is_symlink() {
                    return Err("Refusing to write through a symbolic link".to_string());
                }
                let canonical = probe
                    .canonicalize()
                    .map_err(|error| format!("Could not resolve target directory: {error}"))?;
                if !canonical.starts_with(canonical_root) {
                    return Err("Target escapes the selected folder".to_string());
                }
                return Ok(());
            }
            Err(error) if error.kind() == ErrorKind::NotFound => {
                probe = probe
                    .parent()
                    .ok_or_else(|| "Invalid target path".to_string())?;
            }
            Err(error) => {
                return Err(format!("Could not inspect target directory: {error}"));
            }
        }
    }
}


#[tauri::command]
pub fn write_files(root: String, files: Vec<FileWrite>) -> Result<WriteReport, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err(format!("Target folder does not exist: {root}"));
    }

    let canonical_root = root_path
        .canonicalize()
        .map_err(|error| format!("Could not resolve target folder: {error}"))?;

    let mut report = WriteReport {
        written: Vec::new(),
        skipped: Vec::new(),
        failed: Vec::new(),
    };

    for file in files {
        let target = match safe_join(&canonical_root, &file.path) {
            Ok(target) => target,
            Err(error) => {
                report.failed.push(FileFailure {
                    path: file.path,
                    error,
                });
                continue;
            }
        };

        if file.strategy == WriteStrategy::Skip && target.exists() {
            report.skipped.push(file.path);
            continue;
        }

        if let Ok(metadata) = fs::symlink_metadata(&target) {
            if metadata.file_type().is_symlink() {
                report.failed.push(FileFailure {
                    path: file.path,
                    error: "Refusing to write through a symbolic link".to_string(),
                });
                continue;
            }
        }

        let Some(parent) = target.parent() else {
            report.failed.push(FileFailure {
                path: file.path,
                error: "Invalid target path".to_string(),
            });
            continue;
        };

        if let Err(error) = ensure_existing_ancestor_inside(&canonical_root, parent) {
            report.failed.push(FileFailure {
                path: file.path,
                error,
            });
            continue;
        }

        if let Err(error) = fs::create_dir_all(parent) {
            report.failed.push(FileFailure {
                path: file.path,
                error: format!("Could not create directory: {error}"),
            });
            continue;
        }

        let canonical_parent = match parent.canonicalize() {
            Ok(path) => path,
            Err(error) => {
                report.failed.push(FileFailure {
                    path: file.path,
                    error: format!("Could not resolve target directory: {error}"),
                });
                continue;
            }
        };

        if !canonical_parent.starts_with(&canonical_root) {
            report.failed.push(FileFailure {
                path: file.path,
                error: "Target escapes the selected folder".to_string(),
            });
            continue;
        }

        match write_atomic(&target, file.content.as_bytes()) {
            Ok(()) => report.written.push(file.path),
            Err(error) => report.failed.push(FileFailure {
                path: file.path,
                error,
            }),
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_nested_relative_paths() {
        let root = Path::new("/tmp/root");
        assert_eq!(
            safe_join(root, "src/main.ts").unwrap(),
            root.join("src/main.ts")
        );
    }

    #[test]
    fn rejects_traversal() {
        let root = Path::new("/tmp/root");
        assert!(safe_join(root, "../evil.ts").is_err());
        assert!(safe_join(root, "src/../../evil.ts").is_err());
    }

    #[test]
    fn rejects_absolute_paths() {
        let root = Path::new("/tmp/root");
        assert!(safe_join(root, "/etc/passwd").is_err());
    }

    #[test]
    fn rejects_empty_and_curdir_paths() {
        let root = Path::new("/tmp/root");
        assert!(safe_join(root, "").is_err());
        assert!(safe_join(root, "./file.ts").is_err());
    }

    fn temp_root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "chz-nest-files-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn write(path: &str, content: &str, strategy: WriteStrategy) -> FileWrite {
        FileWrite {
            path: path.to_string(),
            content: content.to_string(),
            strategy,
        }
    }

    #[test]
    fn overwrites_and_skips_existing_files() {
        let root = temp_root("write");
        let root_string = root.to_string_lossy().into_owned();

        let first = write_files(
            root_string.clone(),
            vec![write("src/a.txt", "one", WriteStrategy::Overwrite)],
        )
        .unwrap();
        assert_eq!(first.written, vec!["src/a.txt"]);

        let skipped = write_files(
            root_string.clone(),
            vec![write("src/a.txt", "two", WriteStrategy::Skip)],
        )
        .unwrap();
        assert_eq!(skipped.skipped, vec!["src/a.txt"]);
        assert_eq!(fs::read_to_string(root.join("src/a.txt")).unwrap(), "one");

        let overwritten = write_files(
            root_string,
            vec![write("src/a.txt", "three", WriteStrategy::Overwrite)],
        )
        .unwrap();
        assert_eq!(overwritten.written, vec!["src/a.txt"]);
        assert_eq!(fs::read_to_string(root.join("src/a.txt")).unwrap(), "three");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reports_traversal_and_does_not_write_outside_root() {
        let root = temp_root("traversal");
        let outside = root.parent().unwrap().join("chz-nest-evil.txt");
        let _ = fs::remove_file(&outside);

        let report = write_files(
            root.to_string_lossy().into_owned(),
            vec![write("../chz-nest-evil.txt", "evil", WriteStrategy::Overwrite)],
        )
        .unwrap();

        assert!(report.written.is_empty());
        assert_eq!(report.failed.len(), 1);
        assert!(!outside.exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn never_deletes_files_missing_from_the_manifest() {
        let root = temp_root("keep");
        let root_string = root.to_string_lossy().into_owned();

        write_files(
            root_string.clone(),
            vec![
                write("src/a.txt", "a", WriteStrategy::Overwrite),
                write("src/b.txt", "b", WriteStrategy::Overwrite),
            ],
        )
        .unwrap();
        write_files(
            root_string,
            vec![write("src/a.txt", "updated", WriteStrategy::Overwrite)],
        )
        .unwrap();

        assert_eq!(fs::read_to_string(root.join("src/a.txt")).unwrap(), "updated");
        assert_eq!(fs::read_to_string(root.join("src/b.txt")).unwrap(), "b");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn failure_keeps_existing_parent_contents_intact() {
        let root = temp_root("atomic");
        fs::write(root.join("block"), "keep").unwrap();

        let report = write_files(
            root.to_string_lossy().into_owned(),
            vec![write("block/a.txt", "new", WriteStrategy::Overwrite)],
        )
        .unwrap();

        assert!(report.written.is_empty());
        assert_eq!(report.failed.len(), 1);
        assert_eq!(fs::read_to_string(root.join("block")).unwrap(), "keep");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reads_manifest_and_hashes_known_files_only() {
        let root = temp_root("manifest");
        fs::write(root.join("a.txt"), "hello").unwrap();
        fs::write(root.join("untracked.txt"), "ignored").unwrap();
        let manifest = serde_json::json!({
            "generator": "chz-nest",
            "files": { "a.txt": "not-used", "missing.txt": "not-used" }
        });
        fs::write(
            root.join(MANIFEST_NAME),
            serde_json::to_string(&manifest).unwrap(),
        )
        .unwrap();

        let result = read_manifest(root.to_string_lossy().into_owned(), Vec::new()).unwrap();
        assert!(result.has_manifest);
        assert!(!result.is_empty);
        assert_eq!(result.existing.len(), 1);
        assert_eq!(result.existing[0].path, "a.txt");
        assert_eq!(result.existing[0].sha256, file_sha256(&root.join("a.txt")).unwrap());
        assert!(result.existing.iter().all(|file| file.path != "untracked.txt"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reports_empty_folders_without_a_manifest() {
        let root = temp_root("empty");
        let result = read_manifest(root.to_string_lossy().into_owned(), Vec::new()).unwrap();
        assert!(!result.has_manifest);
        assert!(result.is_empty);
        assert!(result.manifest.is_none());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn hashes_requested_paths_without_a_manifest() {
        let root = temp_root("requested");
        fs::write(root.join("existing.txt"), "hello").unwrap();

        let result = read_manifest(
            root.to_string_lossy().into_owned(),
            vec!["existing.txt".to_string(), "new.txt".to_string()],
        )
        .unwrap();

        assert!(!result.has_manifest);
        assert_eq!(result.existing.len(), 1);
        assert_eq!(result.existing[0].path, "existing.txt");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn skips_symlinked_candidates() {
        let root = temp_root("manifest-symlink");
        let outside = root.parent().unwrap().join("chz-nest-outside.txt");
        fs::write(&outside, "outside").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, root.join("link.txt")).unwrap();

        let result = read_manifest(
            root.to_string_lossy().into_owned(),
            vec!["link.txt".to_string()],
        )
        .unwrap();
        assert!(result.existing.is_empty());
        let _ = fs::remove_file(&outside);
        let _ = fs::remove_dir_all(root);
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlinked_parents_without_creating_outside_directories() {
        let root = temp_root("symlink-parent");
        let outside = root.parent().unwrap().join(format!(
            "chz-nest-symlink-outside-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&outside);
        fs::create_dir_all(&outside).unwrap();
        std::os::unix::fs::symlink(&outside, root.join("link")).unwrap();

        let report = write_files(
            root.to_string_lossy().into_owned(),
            vec![write("link/nested/a.txt", "evil", WriteStrategy::Overwrite)],
        )
        .unwrap();

        assert!(report.written.is_empty());
        assert_eq!(report.failed.len(), 1);
        assert!(!outside.join("nested/a.txt").exists());
        let _ = fs::remove_dir_all(&outside);
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_a_malformed_manifest() {
        let root = temp_root("malformed");
        fs::write(root.join(MANIFEST_NAME), "{}").unwrap();
        assert!(read_manifest(root.to_string_lossy().into_owned(), Vec::new()).is_err());
        let _ = fs::remove_dir_all(root);
    }
}
