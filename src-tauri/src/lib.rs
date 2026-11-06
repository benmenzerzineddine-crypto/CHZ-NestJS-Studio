mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::projects::save_project,
            commands::projects::load_project,
            commands::projects::list_projects,
            commands::projects::delete_project,
            commands::files::write_files,
            commands::files::read_manifest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
