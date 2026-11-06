use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use super::util::write_atomic;

const PROJECTS_SUBDIR: &str = "projects";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    id: String,
    name: String,
    driver: String,
    entity_count: usize,
    updated_at: String,
}

fn projects_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve app data directory: {error}"))?
        .join(PROJECTS_SUBDIR);

    fs::create_dir_all(&dir)
        .map_err(|error| format!("Could not create project directory: {error}"))?;

    Ok(dir)
}

fn validate_id(id: &str) -> Result<(), String> {
    let valid = !id.is_empty()
        && id.len() <= 64
        && id.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '-'
        });

    if valid {
        Ok(())
    } else {
        Err("Invalid project id".to_string())
    }
}

fn project_path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    validate_id(id)?;
    Ok(projects_dir(app)?.join(format!("{id}.json")))
}

#[tauri::command]
pub fn save_project(app: AppHandle, project: serde_json::Value) -> Result<(), String> {
    let id = project
        .get("id")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Project is missing an id".to_string())?;

    let path = project_path(&app, id)?;
    let bytes = serde_json::to_vec_pretty(&project)
        .map_err(|error| format!("Could not serialize project: {error}"))?;

    write_atomic(&path, &bytes)
}

#[tauri::command]
pub fn load_project(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let path = project_path(&app, &id)?;
    let contents =
        fs::read_to_string(&path).map_err(|error| format!("Could not read project: {error}"))?;

    serde_json::from_str(&contents).map_err(|error| format!("Project file is corrupted: {error}"))
}

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<ProjectSummary>, String> {
    let dir = projects_dir(&app)?;
    let entries =
        fs::read_dir(&dir).map_err(|error| format!("Could not list projects: {error}"))?;

    let mut projects = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }

        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<serde_json::Value>(&contents) else {
            continue;
        };

        let Some(id) = value.get("id").and_then(|field| field.as_str()) else {
            continue;
        };

        projects.push(ProjectSummary {
            id: id.to_string(),
            name: value
                .get("name")
                .and_then(|field| field.as_str())
                .unwrap_or("Untitled")
                .to_string(),
            driver: value
                .get("driver")
                .and_then(|field| field.as_str())
                .unwrap_or("postgres")
                .to_string(),
            entity_count: value
                .get("entities")
                .and_then(|field| field.as_array())
                .map(|entities| entities.len())
                .unwrap_or(0),
            updated_at: value
                .get("updatedAt")
                .and_then(|field| field.as_str())
                .unwrap_or_default()
                .to_string(),
        });
    }

    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

#[tauri::command]
pub fn delete_project(app: AppHandle, id: String) -> Result<(), String> {
    let path = project_path(&app, &id)?;

    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not delete project: {error}")),
    }
}
