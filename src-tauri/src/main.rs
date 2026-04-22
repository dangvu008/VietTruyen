#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod git_commands;

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // PDF parsing
            parse_pdf_with_liteparse,
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
