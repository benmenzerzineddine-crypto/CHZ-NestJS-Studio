use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// Writes bytes to a unique temp file next to the target and renames it into place.
///
/// The destination is never deleted before the rename, so a failed finalize leaves
/// the previous file intact.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid target path".to_string())?;

    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create directory {}: {error}", parent.display()))?;

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid file name".to_string())?;
    let sequence = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
    let temp = parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        sequence
    ));

    if let Err(error) = fs::write(&temp, bytes) {
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not write {}: {error}", temp.display()));
    }

    if let Err(error) = fs::rename(&temp, path) {
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not finalize {}: {error}", path.display()));
    }

    Ok(())
}
