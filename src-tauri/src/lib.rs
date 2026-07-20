use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, TerminatedPayload};

const BACKEND_SIDECAR: &str = "vivim-server";
const BACKEND_PORT: u16 = 9421;

/// Spawn the compiled Bun backend sidecar and supervise it.
/// The backend owns all Vivim engines (conversation, parser, governor, etc.).
/// Rust only manages lifecycle: spawn, readiness, log relay, clean shutdown.
fn spawn_backend(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar(BACKEND_SIDECAR)?.args([
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        &BACKEND_PORT.to_string(),
    ]);
    // Production posture: disable pino-pretty worker transport (which spawns a
    // thread incompatible with a standalone compiled Bun binary).
    sidecar = sidecar.env("NODE_ENV", "production");
    let (mut rx, _child) = sidecar.spawn()?;

    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    print!("[vivim-server] {line}");
                    // Relay backend readiness to the frontend.
                    if line.contains("listening") {
                        let _ = app_clone.emit("backend-ready", BACKEND_PORT);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    eprint!("[vivim-server:err] {line}");
                }
                CommandEvent::Terminated(TerminatedPayload { code, signal }) => {
                    eprintln!("[vivim-server] terminated code={code:?} signal={signal:?}");
                    let _ = app_clone.emit("backend-exit", (code, signal));
                }
                _ => {}
            }
        }
    });
    Ok(())
}

#[tauri::command]
fn backend_port() -> u16 {
    BACKEND_PORT
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![backend_port])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Err(e) = spawn_backend(&handle) {
                eprintln!("Failed to spawn vivim-server sidecar: {e}");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running vivim tauri application");
}
