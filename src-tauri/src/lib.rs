use tauri::Manager;

/// Shows the main window once the frontend has signalled it is ready.
/// The window is created with `visible: false` and only revealed here
/// so the user never sees a blank white flash during boot.
fn show_window(app: &tauri::App) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn backend_ready(app: tauri::AppHandle) {
    show_window(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![backend_ready])
        .setup(|app| {
            // On desktop, the backend is embedded as a sidecar or in-process.
            // In Tauri V2 static-export mode the frontend is pre-built; we
            // simply wait for the `backend-ready` event from the JS layer.
            let handle = app.handle().clone();
            app.listen("backend-ready", move |_| {
                show_window(&handle);
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Vivim");
}
