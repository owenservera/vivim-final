use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, TerminatedPayload};

const BACKEND_SIDECAR: &str = "vivim-server";
const DEFAULT_PORT: u16 = 9421;
const MAX_RESTARTS: u32 = 5;

/// Extract the actual port from a vivim-server stdout line like:
///   "vivim-server listening on http://127.0.0.1:9422"
fn extract_port_from_line(line: &str) -> Option<u16> {
    let marker = "listening on http://127.0.0.1:";
    let idx = line.find(marker)?;
    let after = &line[idx + marker.len()..];
    let port_str: String = after.chars().take_while(|c| c.is_ascii_digit()).collect();
    port_str.parse().ok()
}

/// Spawn the compiled Bun backend sidecar and supervise it.
/// Returns (actual_port, exit_receiver) — exit_receiver fires when the process terminates.
fn spawn_backend(
    app: &tauri::AppHandle,
    requested_port: u16,
) -> Result<(u16, tokio::sync::oneshot::Receiver<()>), Box<dyn std::error::Error>> {
    let sidecar = app.shell().sidecar(BACKEND_SIDECAR)?.args([
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        &requested_port.to_string(),
    ]);
    let sidecar = sidecar.env("NODE_ENV", "production");
    let (mut rx, _child) = sidecar.spawn()?;

    let app_clone = app.clone();
    let actual_port = Arc::new(AtomicU16::new(requested_port));
    let actual_port_clone = actual_port.clone();
    let (exit_tx, exit_rx) = tokio::sync::oneshot::channel::<()>();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    print!("[vivim-server] {line}");
                    if let Some(port) = extract_port_from_line(&line) {
                        actual_port_clone.store(port, Ordering::Relaxed);
                        let _ = app_clone.emit("backend-ready", port);
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
        // Channel closed — sidecar process exited.
        let _ = exit_tx.send(());
    });
    let port = actual_port.load(Ordering::Relaxed);
    Ok((port, exit_rx))
}

/// Supervise the sidecar with auto-restart on unexpected termination.
/// Spawns up to MAX_RESTARTS times with exponential backoff (1s, 2s, 4s, 8s, 16s).
fn supervise_sidecar(app: &tauri::AppHandle) {
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut current_port = DEFAULT_PORT;
        for attempt in 0..=MAX_RESTARTS {
            if attempt > 0 {
                let backoff_ms = 1000 * 2u64.pow(attempt - 1);
                eprintln!(
                    "[vivim] restarting sidecar (attempt {attempt}/{MAX_RESTARTS}) in {backoff_ms}ms"
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
            }
            let (port, exit_rx) = match spawn_backend(&app_clone, current_port) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("[vivim] failed to spawn sidecar: {e}");
                    if attempt >= MAX_RESTARTS {
                        eprintln!("[vivim] max restarts ({MAX_RESTARTS}) reached, giving up");
                        let _ = app_clone.emit("backend-exit", (-1i32, 0i32));
                        return;
                    }
                    continue;
                }
            };
            current_port = port;
            eprintln!("[vivim] sidecar started on port {port} (attempt {attempt})");

            // Block until sidecar exits, then loop and restart.
            let _ = exit_rx.await;
            eprintln!("[vivim] sidecar on port {port} exited");
        }
        eprintln!("[vivim] supervisor exhausted all {MAX_RESTARTS} restart attempts");
        let _ = app_clone.emit("backend-exit", (-1i32, 0i32));
    });
}

#[tauri::command]
fn backend_port() -> u16 {
    DEFAULT_PORT
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![backend_port])
        .setup(|app| {
            let handle = app.handle().clone();
            supervise_sidecar(&handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running vivim tauri application");
}
