use std::fs::OpenOptions;
use std::io::Write;
use std::sync::atomic::{AtomicU16, AtomicBool, Ordering};
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandEvent, TerminatedPayload};

const BACKEND_SIDECAR: &str = "vivim-server";
const DEFAULT_PORT: u16 = 9421;
const MAX_RESTARTS: u32 = 5;
const BACKEND_READY_TIMEOUT_MS: u64 = 30_000;

/// Resolve the supervisor log path (mirrors the sidecar's log location so all
/// app logs live in one place): %LOCALAPPDATA%/vivim/vivim-supervisor.log.
fn supervisor_log_path() -> std::path::PathBuf {
    let base = std::env::var("LOCALAPPDATA")
        .or_else(|_| std::env::var("APPDATA"))
        .unwrap_or_else(|_| ".".into());
    std::path::PathBuf::from(format!("{base}/vivim/vivim-supervisor.log"))
}

/// Append a supervisor event line to the log file. Best-effort: never panics,
/// falls back to printing to stderr when the file cannot be opened.
fn log_supervisor(line: &str) {
    if let Some(dir) = supervisor_log_path().parent() {
        if let Err(e) = std::fs::create_dir_all(dir) {
            eprintln!("[vivim] could not create log dir: {e}");
            return;
        }
    }
    match OpenOptions::new().create(true).append(true).open(supervisor_log_path()) {
        Ok(mut f) => {
            let _ = writeln!(f, "{line}");
        }
        Err(e) => {
            eprintln!("[vivim] could not open supervisor log: {e}");
        }
    }
}

/// Extract the actual port from a vivim-server stdout line like:
///   "vivim-server listening on http://127.0.0.1:9422"
fn extract_port_from_line(line: &str) -> Option<u16> {
    let marker = "listening on http://";
    let idx = line.find(marker)?;
    let after = &line[idx + marker.len()..];
    let colon_idx = after.find(':')?;
    let port_str: String = after[colon_idx + 1..]
        .chars()
        .take_while(|c| c.is_ascii_digit())
        .collect();
    port_str.parse().ok()
}

/// Spawn the compiled Bun backend sidecar and supervise it.
/// Returns (actual_port, exit_receiver).
fn spawn_backend(
    app: &tauri::AppHandle,
    requested_port: u16,
) -> Result<(u16, tokio::sync::oneshot::Receiver<()>), Box<dyn std::error::Error + Send + Sync>> {
    let sidecar = app
        .shell()
        .sidecar(BACKEND_SIDECAR)?
        .args(["serve", "--host", "127.0.0.1", "--port", &requested_port.to_string()]);
    let sidecar_log = supervisor_log_path()
        .parent()
        .map(|p| p.join("vivim-server.log"))
        .unwrap_or_else(|| std::path::PathBuf::from("vivim-server.log"));
    let sidecar = sidecar
        .env("NODE_ENV", "production")
        .env("VIVIM_LOG_FILE", sidecar_log.to_string_lossy().to_string());
    let (mut rx, _child) = sidecar.spawn()?;

    let app_clone = app.clone();
    let actual_port = Arc::new(AtomicU16::new(requested_port));
    let actual_port_clone = actual_port.clone();
    let backend_ready = Arc::new(AtomicBool::new(false));
    let backend_ready_clone = backend_ready.clone();
    let (exit_tx, exit_rx) = tokio::sync::oneshot::channel::<()>();

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    print!("[vivim-server] {line}");
                    if let Some(port) = extract_port_from_line(&line) {
                        actual_port_clone.store(port, Ordering::SeqCst);
                        backend_ready_clone.store(true, Ordering::SeqCst);
                        let _ = app_clone.emit("backend-ready", port);
                    }
                }
                CommandEvent::Stderr(bytes) => {
                    let line = String::from_utf8_lossy(&bytes);
                    eprint!("[vivim-server:err] {line}");
                }
                CommandEvent::Terminated(TerminatedPayload { code, signal }) => {
                    eprintln!("[vivim-server] terminated code={code:?} signal={signal:?}");
                    log_supervisor(&format!(
                        "sidecar terminated code={code:?} signal={signal:?}"
                    ));
                    let _ = app_clone.emit("backend-exit", (code, signal));
                }
                _ => {}
            }
        }
        // Channel closed — sidecar process exited.
        let _ = exit_tx.send(());
    });

    let port = actual_port.load(Ordering::SeqCst);
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
                log_supervisor(&format!(
                    "restarting sidecar (attempt {attempt}/{MAX_RESTARTS}) in {backoff_ms}ms"
                ));
                tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
            }

            match spawn_backend(&app_clone, current_port) {
                Ok((port, exit_rx)) => {
                    current_port = port;
                    eprintln!("[vivim] sidecar started, waiting for ready signal on port {port} (attempt {attempt})");
                    log_supervisor(&format!(
                        "sidecar started on port {port} (attempt {attempt})"
                    ));

                    // Block until sidecar exits, then loop and restart.
                    let _ = exit_rx.await;
                    eprintln!("[vivim] sidecar on port {port} exited");
                    log_supervisor(&format!("sidecar on port {port} exited"));
                }
                Err(e) => {
                    eprintln!("[vivim] failed to spawn sidecar: {e}");
                    log_supervisor(&format!("failed to spawn sidecar: {e}"));
                    if attempt >= MAX_RESTARTS {
                        eprintln!("[vivim] max restarts ({MAX_RESTARTS}) reached, giving up");
                        log_supervisor(&format!(
                            "max restarts ({MAX_RESTARTS}) reached, giving up"
                        ));
                        let _ = app_clone.emit("backend-exit", (-1i32, 0i32));
                        return;
                    }
                }
            }
        }
        eprintln!("[vivim] supervisor exhausted all {MAX_RESTARTS} restart attempts");
        log_supervisor(&format!(
            "supervisor exhausted all {MAX_RESTARTS} restart attempts"
        ));
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
        .invoke_handler(tauri::generate_handler![backend_port])
        .setup(|app| {
            let handle = app.handle().clone();
            let window = app.get_webview_window("main").expect("main window must exist");

            // Spawn the backend sidecar supervisor
            supervise_sidecar(&handle);

            // Listen for backend-ready event to show the window and navigate
            let win_clone = window.clone();
            handle.listen("backend-ready", move |_event| {
                // The window is now ready to show — Tauri will load frontendDist automatically
                if !win_clone.is_visible().unwrap_or(false) {
                    let _ = win_clone.show();
                    let _ = win_clone.set_focus();
                }
            });

            // Safety timeout: if backend doesn't start in 30s, show window anyway with error
            let win_timeout = window.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(tokio::time::Duration::from_millis(
                    BACKEND_READY_TIMEOUT_MS,
                ))
                .await;
                if !win_timeout.is_visible().unwrap_or(false) {
                    eprintln!(
                        "[vivim] WARNING: backend-ready timeout after {BACKEND_READY_TIMEOUT_MS}ms, showing window anyway"
                    );
                    let _ = win_timeout.show();
                    let _ = win_timeout.set_focus();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running vivim tauri application");
}
