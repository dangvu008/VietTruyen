#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git_commands;

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct LiteparseJsonPage {
    text: String,
}

#[derive(Debug, Deserialize)]
struct LiteparseJsonOutput {
    pages: Vec<LiteparseJsonPage>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ParsedPdfPayload {
    text: String,
    page_count: usize,
    metadata: std::collections::HashMap<String, String>,
}

#[derive(Debug)]
struct LiteparseCandidate {
    program: PathBuf,
    prefix_args: Vec<String>,
    label: String,
}

#[tauri::command]
fn parse_pdf_with_liteparse(bytes: Vec<u8>, max_pages: Option<u32>) -> Result<ParsedPdfPayload, String> {
    let mut last_error = None;

    for candidate in liteparse_candidates() {
        match run_liteparse(&candidate, &bytes, max_pages) {
            Ok(parsed) => {
                let page_count = parsed.pages.len();
                let text = parsed
                    .pages
                    .into_iter()
                    .map(|page| page.text)
                    .filter(|page| !page.trim().is_empty())
                    .collect::<Vec<_>>()
                    .join("\n\n")
                    .trim()
                    .to_string();

                let metadata = std::collections::HashMap::from([
                    ("command".to_string(), candidate.label),
                    ("ocr".to_string(), "disabled".to_string()),
                    ("transport".to_string(), "stdin".to_string()),
                ]);

                return Ok(ParsedPdfPayload {
                    text,
                    page_count,
                    metadata,
                });
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    Err(last_error.unwrap_or_else(|| {
        "Không tìm thấy LiteParse. Chạy `npm install` để dùng bản local hoặc cài `lit` vào PATH.".to_string()
    }))
}

fn liteparse_candidates() -> Vec<LiteparseCandidate> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir.clone());
    let bin_dir = project_root.join("node_modules").join(".bin");

    let mut candidates = vec![
        LiteparseCandidate {
            program: bin_dir.join(local_command_name("lit")),
            prefix_args: Vec::new(),
            label: "node_modules/.bin/lit".to_string(),
        },
        LiteparseCandidate {
            program: bin_dir.join(local_command_name("liteparse")),
            prefix_args: Vec::new(),
            label: "node_modules/.bin/liteparse".to_string(),
        },
        LiteparseCandidate {
            program: PathBuf::from("lit"),
            prefix_args: Vec::new(),
            label: "lit".to_string(),
        },
        LiteparseCandidate {
            program: PathBuf::from("liteparse"),
            prefix_args: Vec::new(),
            label: "liteparse".to_string(),
        },
        LiteparseCandidate {
            program: PathBuf::from(global_command_name("npx")),
            prefix_args: vec![
                "--no-install".to_string(),
                "@llamaindex/liteparse".to_string(),
            ],
            label: "npx @llamaindex/liteparse".to_string(),
        },
    ];

    candidates.retain(|candidate| {
        let is_relative_binary = candidate.program.components().count() > 1;
        !is_relative_binary || candidate.program.exists()
    });

    candidates
}

fn run_liteparse(
    candidate: &LiteparseCandidate,
    bytes: &[u8],
    max_pages: Option<u32>,
) -> Result<LiteparseJsonOutput, String> {
    let mut args = candidate.prefix_args.clone();
    args.extend([
        "parse".to_string(),
        "-".to_string(),
        "--format".to_string(),
        "json".to_string(),
        "--quiet".to_string(),
        "--no-ocr".to_string(),
    ]);

    if let Some(max_pages) = max_pages {
        args.push("--max-pages".to_string());
        args.push(max_pages.to_string());
    }

    let mut child = Command::new(&candidate.program)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Không thể chạy {}: {}", candidate.label, error))?;

    {
        let stdin = child
            .stdin
            .as_mut()
            .ok_or_else(|| format!("Không thể mở stdin cho {}.", candidate.label))?;
        stdin
            .write_all(bytes)
            .map_err(|error| format!("Không thể gửi PDF sang {}: {}", candidate.label, error))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("Không thể đọc output từ {}: {}", candidate.label, error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("{} thoat voi status {}.", candidate.label, output.status)
        } else {
            format!("{} loi: {}", candidate.label, stderr)
        });
    }

    serde_json::from_slice::<LiteparseJsonOutput>(&output.stdout)
        .map_err(|error| format!("LiteParse tra ve JSON khong hop le: {}", error))
}

#[cfg(target_os = "windows")]
fn local_command_name(name: &str) -> String {
    format!("{name}.cmd")
}

#[cfg(not(target_os = "windows"))]
fn local_command_name(name: &str) -> String {
    name.to_string()
}

#[cfg(target_os = "windows")]
fn global_command_name(name: &str) -> String {
    format!("{name}.cmd")
}

#[cfg(not(target_os = "windows"))]
fn global_command_name(name: &str) -> String {
    name.to_string()
}

struct RouterLaunchCandidate {
    program: PathBuf,
    args: Vec<String>,
    label: String,
}

fn is_port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(250)).is_ok()
}

fn command_exists(program: &Path) -> bool {
    if program.components().count() > 1 {
        return program.exists();
    }

    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| dir.join(program).exists())
        })
        .unwrap_or(false)
}

fn router_launch_candidates(router_dir: &Path) -> Vec<RouterLaunchCandidate> {
    let has_production_build = router_dir.join(".next").join("BUILD_ID").exists();
    let npm = PathBuf::from(global_command_name("npm"));
    let bun = PathBuf::from(global_command_name("bun"));

    let mut candidates = Vec::new();

    if has_production_build {
        candidates.push(RouterLaunchCandidate {
            program: npm.clone(),
            args: vec!["run".to_string(), "start".to_string()],
            label: "npm run start".to_string(),
        });
        candidates.push(RouterLaunchCandidate {
            program: bun.clone(),
            args: vec!["run".to_string(), "start:bun".to_string()],
            label: "bun run start:bun".to_string(),
        });
    }

    candidates.push(RouterLaunchCandidate {
        program: npm,
        args: vec!["run".to_string(), "dev".to_string()],
        label: "npm run dev".to_string(),
    });
    candidates.push(RouterLaunchCandidate {
        program: bun,
        args: vec!["run".to_string(), "dev:bun".to_string()],
        label: "bun run dev:bun".to_string(),
    });

    candidates
        .into_iter()
        .filter(|candidate| command_exists(&candidate.program))
        .collect()
}

fn ensure_9router_started() -> Result<(), String> {
    const ROUTER_PORT: u16 = 20128;

    if is_port_open(ROUTER_PORT) {
        return Ok(());
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let project_root = manifest_dir
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or(manifest_dir.clone());
    let router_dir = project_root.join("9router");

    if !router_dir.exists() {
        return Err("Không tìm thấy thư mục 9router trong project root.".to_string());
    }

    let candidates = router_launch_candidates(&router_dir);
    if candidates.is_empty() {
        return Err("Không tìm thấy runtime phù hợp để bật 9router (cần npm hoặc bun trong PATH).".to_string());
    }

    let log_path = project_root.join(".tmp").join("9router.log");
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let mut last_error = None;

    for candidate in candidates {
        let stdout = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .map_err(|error| format!("Không thể mở log 9router: {}", error))?;
        let stderr = stdout
            .try_clone()
            .map_err(|error| format!("Không thể clone log 9router: {}", error))?;

        match Command::new(&candidate.program)
            .args(&candidate.args)
            .current_dir(&router_dir)
            .env("PORT", ROUTER_PORT.to_string())
            .env("HOSTNAME", "127.0.0.1")
            .env("BASE_URL", "http://127.0.0.1:20128")
            .env("NEXT_PUBLIC_BASE_URL", "http://127.0.0.1:20128")
            .stdout(Stdio::from(stdout))
            .stderr(Stdio::from(stderr))
            .spawn()
        {
            Ok(_) => {
                for _ in 0..24 {
                    std::thread::sleep(Duration::from_millis(500));
                    if is_port_open(ROUTER_PORT) {
                        return Ok(());
                    }
                }
                last_error = Some(format!(
                    "{} đã được spawn nhưng cổng {} chưa sẵn sàng. Xem log tại {}",
                    candidate.label,
                    ROUTER_PORT,
                    log_path.display()
                ));
            }
            Err(error) => {
                last_error = Some(format!("Không thể chạy {}: {}", candidate.label, error));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Không thể tự bật 9router.".to_string()))
}

#[tauri::command]
fn ensure_nine_router_started() -> Result<(), String> {
    ensure_9router_started()
}

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            if let Err(error) = ensure_9router_started() {
                eprintln!("[startup] 9router auto-start skipped: {}", error);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // PDF parsing
            parse_pdf_with_liteparse,
            ensure_nine_router_started,
            // Git storage commands
            git_commands::storage_init,
            git_commands::storage_list_projects,
            git_commands::storage_get_project,
            git_commands::storage_save_project,
            git_commands::storage_delete_project,
            git_commands::storage_list_chapters,
            git_commands::storage_get_chapter,
            git_commands::storage_save_chapter,
            git_commands::storage_delete_chapter,
            git_commands::storage_replace_chapters,
            git_commands::storage_git_commit,
            git_commands::storage_git_log,
            git_commands::storage_git_show,
        ])
        .run(tauri::generate_context!())
        .expect("error while running VietTruyen");
}
