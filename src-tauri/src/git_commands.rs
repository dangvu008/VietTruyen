/**
 * File: git_commands.rs
 * Purpose: Tauri commands for Git-backed local storage
 * Layer: Infrastructure (Tauri Backend)
 * Domain: Storage → [filesystem CRUD + git versioning]
 *
 * File layout per project:
 *   <base_dir>/projects/<project_id>/
 *     ├── .git/
 *     ├── project.json
 *     ├── chapters/<chapter_id>.md
 *     └── chapters/<chapter_id>.meta.json
 */

use git2::{Repository, Signature};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

// ── Data Types ──────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub id: String,
    pub title: String,
    pub genre: String,
    pub chapter_count: usize,
    pub updated_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterPayload {
    pub id: String,
    pub title: String,
    pub content: String,
    pub summary: Option<String>,
    pub sequence_number: u32,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    pub id: String,
    pub message: String,
    pub timestamp: String,
    pub author: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionSnapshotPayload {
    pub entry: VersionEntry,
    pub chapters: Vec<ChapterPayload>,
    pub metadata: serde_json::Value,
}

// ── Helpers ─────────────────────────────────────────────────

fn base_dir() -> PathBuf {
    let home = dirs::document_dir().unwrap_or_else(|| {
        dirs::home_dir().expect("Cannot determine home directory")
    });
    home.join("VietTruyen").join("projects")
}

fn project_dir(project_id: &str) -> PathBuf {
    base_dir().join(project_id)
}

fn chapters_dir(project_id: &str) -> PathBuf {
    project_dir(project_id).join("chapters")
}

fn ensure_repo(project_id: &str) -> Result<Repository, String> {
    let path = project_dir(project_id);
    fs::create_dir_all(&path).map_err(|e| format!("Cannot create project dir: {e}"))?;
    fs::create_dir_all(chapters_dir(project_id))
        .map_err(|e| format!("Cannot create chapters dir: {e}"))?;

    match Repository::open(&path) {
        Ok(repo) => Ok(repo),
        Err(_) => Repository::init(&path).map_err(|e| format!("git init failed: {e}")),
    }
}

fn git_signature() -> Signature<'static> {
    Signature::now("VietTruyen", "app@viettruyen.local")
        .expect("Cannot create git signature")
}

fn auto_commit(repo: &Repository, message: &str) -> Result<String, String> {
    let mut index = repo.index().map_err(|e| format!("index error: {e}"))?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("add error: {e}"))?;
    index.write().map_err(|e| format!("index write error: {e}"))?;

    let tree_oid = index
        .write_tree()
        .map_err(|e| format!("write_tree error: {e}"))?;
    let tree = repo
        .find_tree(tree_oid)
        .map_err(|e| format!("find_tree error: {e}"))?;

    let sig = git_signature();

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    let parents: Vec<&git2::Commit> = match &parent_commit {
        Some(c) => vec![c],
        None => vec![],
    };

    let commit_oid = repo
        .commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)
        .map_err(|e| format!("commit error: {e}"))?;

    Ok(commit_oid.to_string())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

fn read_tree_file(repo: &Repository, tree: &git2::Tree, path: &str) -> Result<String, String> {
    let entry = tree
        .get_path(Path::new(path))
        .map_err(|e| format!("tree get_path error for {path}: {e}"))?;
    let object = entry
        .to_object(repo)
        .map_err(|e| format!("tree object error for {path}: {e}"))?;
    let blob = object
        .peel_to_blob()
        .map_err(|e| format!("blob read error for {path}: {e}"))?;

    std::str::from_utf8(blob.content())
        .map(|s| s.to_string())
        .map_err(|e| format!("utf8 decode error for {path}: {e}"))
}

// ── Tauri Commands ──────────────────────────────────────────

#[tauri::command]
pub fn storage_init() -> Result<(), String> {
    let base = base_dir();
    fs::create_dir_all(&base).map_err(|e| format!("Cannot create base dir: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn storage_list_projects() -> Result<Vec<ProjectMeta>, String> {
    let base = base_dir();
    if !base.exists() {
        return Ok(vec![]);
    }

    let mut projects = Vec::new();
    let entries = fs::read_dir(&base).map_err(|e| format!("read_dir error: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let project_json = path.join("project.json");
        if !project_json.exists() {
            continue;
        }

        let raw = fs::read_to_string(&project_json)
            .map_err(|e| format!("read project.json error: {e}"))?;
        let value: serde_json::Value =
            serde_json::from_str(&raw).map_err(|e| format!("parse project.json error: {e}"))?;

        let chapter_count = path
            .join("chapters")
            .read_dir()
            .map(|rd| rd.filter(|e| {
                e.as_ref()
                    .map(|e| e.path().extension().map(|ext| ext == "md").unwrap_or(false))
                    .unwrap_or(false)
            }).count())
            .unwrap_or(0);

        projects.push(ProjectMeta {
            id: value["id"].as_str().unwrap_or_default().to_string(),
            title: value["title"].as_str().unwrap_or("Untitled").to_string(),
            genre: value["genre"].as_str().unwrap_or("").to_string(),
            chapter_count,
            updated_at: value["updatedAt"].as_str().unwrap_or_default().to_string(),
            created_at: value["createdAt"].as_str().unwrap_or_default().to_string(),
        });
    }

    Ok(projects)
}

#[tauri::command]
pub fn storage_get_project(project_id: &str) -> Result<serde_json::Value, String> {
    let project_json = project_dir(project_id).join("project.json");
    if !project_json.exists() {
        return Err(format!("Project {project_id} not found"));
    }

    let raw =
        fs::read_to_string(&project_json).map_err(|e| format!("read error: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("parse error: {e}"))
}

#[tauri::command]
pub fn storage_save_project(project: serde_json::Value) -> Result<(), String> {
    let project_id = project["id"]
        .as_str()
        .ok_or("Project missing 'id' field")?;

    let repo = ensure_repo(project_id)?;
    let project_json = project_dir(project_id).join("project.json");

    let serialized =
        serde_json::to_string_pretty(&project).map_err(|e| format!("serialize error: {e}"))?;
    fs::write(&project_json, &serialized).map_err(|e| format!("write error: {e}"))?;

    auto_commit(&repo, &format!("Save project: {}", project["title"].as_str().unwrap_or("")))?;
    Ok(())
}

#[tauri::command]
pub fn storage_delete_project(project_id: &str) -> Result<(), String> {
    let path = project_dir(project_id);
    if path.exists() {
        fs::remove_dir_all(&path).map_err(|e| format!("delete error: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn storage_list_chapters(project_id: &str) -> Result<Vec<ChapterPayload>, String> {
    let dir = chapters_dir(project_id);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut chapters = Vec::new();
    let entries = fs::read_dir(&dir).map_err(|e| format!("read_dir error: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e != "md").unwrap_or(true) {
            continue;
        }

        let chapter_id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_string();

        let content =
            fs::read_to_string(&path).map_err(|e| format!("read chapter error: {e}"))?;

        // Read companion metadata file
        let meta_path = dir.join(format!("{chapter_id}.meta.json"));
        let meta: serde_json::Value = if meta_path.exists() {
            let raw = fs::read_to_string(&meta_path)
                .map_err(|e| format!("read meta error: {e}"))?;
            serde_json::from_str(&raw).unwrap_or_default()
        } else {
            serde_json::json!({})
        };

        chapters.push(ChapterPayload {
            id: chapter_id,
            title: meta["title"].as_str().unwrap_or("Untitled").to_string(),
            content,
            summary: meta["summary"].as_str().map(String::from),
            sequence_number: meta["sequenceNumber"].as_u64().unwrap_or(1) as u32,
            status: meta["status"].as_str().unwrap_or("draft").to_string(),
            created_at: meta["createdAt"].as_str().unwrap_or_default().to_string(),
            updated_at: meta["updatedAt"].as_str().unwrap_or_default().to_string(),
        });
    }

    chapters.sort_by_key(|c| c.sequence_number);
    Ok(chapters)
}

#[tauri::command]
pub fn storage_get_chapter(project_id: &str, chapter_id: &str) -> Result<ChapterPayload, String> {
    let md_path = chapters_dir(project_id).join(format!("{chapter_id}.md"));
    let meta_path = chapters_dir(project_id).join(format!("{chapter_id}.meta.json"));

    if !md_path.exists() {
        return Err(format!("Chapter {chapter_id} not found"));
    }

    let content = fs::read_to_string(&md_path).map_err(|e| format!("read error: {e}"))?;
    let meta: serde_json::Value = if meta_path.exists() {
        let raw = fs::read_to_string(&meta_path).map_err(|e| format!("read meta error: {e}"))?;
        serde_json::from_str(&raw).unwrap_or_default()
    } else {
        serde_json::json!({})
    };

    Ok(ChapterPayload {
        id: chapter_id.to_string(),
        title: meta["title"].as_str().unwrap_or("Untitled").to_string(),
        content,
        summary: meta["summary"].as_str().map(String::from),
        sequence_number: meta["sequenceNumber"].as_u64().unwrap_or(1) as u32,
        status: meta["status"].as_str().unwrap_or("draft").to_string(),
        created_at: meta["createdAt"].as_str().unwrap_or_default().to_string(),
        updated_at: meta["updatedAt"].as_str().unwrap_or_default().to_string(),
    })
}

#[tauri::command]
pub fn storage_save_chapter(project_id: &str, chapter: ChapterPayload) -> Result<(), String> {
    let repo = ensure_repo(project_id)?;
    let dir = chapters_dir(project_id);
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir error: {e}"))?;

    // Write content as .md
    let md_path = dir.join(format!("{}.md", chapter.id));
    fs::write(&md_path, &chapter.content).map_err(|e| format!("write md error: {e}"))?;

    // Write metadata as .meta.json
    let meta = serde_json::json!({
        "title": chapter.title,
        "summary": chapter.summary,
        "sequenceNumber": chapter.sequence_number,
        "status": chapter.status,
        "createdAt": chapter.created_at,
        "updatedAt": chapter.updated_at,
    });
    let meta_path = dir.join(format!("{}.meta.json", chapter.id));
    let serialized =
        serde_json::to_string_pretty(&meta).map_err(|e| format!("serialize error: {e}"))?;
    fs::write(&meta_path, &serialized).map_err(|e| format!("write meta error: {e}"))?;

    auto_commit(&repo, &format!("Update chapter: {}", chapter.title))?;
    Ok(())
}

#[tauri::command]
pub fn storage_delete_chapter(project_id: &str, chapter_id: &str) -> Result<(), String> {
    let repo = ensure_repo(project_id)?;
    let md_path = chapters_dir(project_id).join(format!("{chapter_id}.md"));
    let meta_path = chapters_dir(project_id).join(format!("{chapter_id}.meta.json"));

    if md_path.exists() {
        fs::remove_file(&md_path).map_err(|e| format!("delete md error: {e}"))?;
    }
    if meta_path.exists() {
        fs::remove_file(&meta_path).map_err(|e| format!("delete meta error: {e}"))?;
    }

    auto_commit(&repo, &format!("Delete chapter: {chapter_id}"))?;
    Ok(())
}

#[tauri::command]
pub fn storage_replace_chapters(
    project_id: &str,
    chapters: Vec<ChapterPayload>,
) -> Result<(), String> {
    let repo = ensure_repo(project_id)?;
    let dir = chapters_dir(project_id);

    // Clear existing chapters
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("clear chapters error: {e}"))?;
    }
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir error: {e}"))?;

    // Write all chapters
    for chapter in &chapters {
        let md_path = dir.join(format!("{}.md", chapter.id));
        fs::write(&md_path, &chapter.content).map_err(|e| format!("write error: {e}"))?;

        let meta = serde_json::json!({
            "title": chapter.title,
            "summary": chapter.summary,
            "sequenceNumber": chapter.sequence_number,
            "status": chapter.status,
            "createdAt": chapter.created_at,
            "updatedAt": chapter.updated_at,
        });
        let meta_path = dir.join(format!("{}.meta.json", chapter.id));
        let serialized =
            serde_json::to_string_pretty(&meta).map_err(|e| format!("serialize error: {e}"))?;
        fs::write(&meta_path, &serialized).map_err(|e| format!("write meta error: {e}"))?;
    }

    auto_commit(
        &repo,
        &format!("Replace all chapters ({} total)", chapters.len()),
    )?;
    Ok(())
}

#[tauri::command]
pub fn storage_git_commit(project_id: &str, message: &str) -> Result<VersionEntry, String> {
    let repo = ensure_repo(project_id)?;
    let oid = auto_commit(&repo, message)?;

    Ok(VersionEntry {
        id: oid,
        message: message.to_string(),
        timestamp: now_iso(),
        author: "user".to_string(),
    })
}

#[tauri::command]
pub fn storage_git_log(
    project_id: &str,
    path: Option<&str>,
) -> Result<Vec<VersionEntry>, String> {
    let repo_path = project_dir(project_id);
    let repo = match Repository::open(&repo_path) {
        Ok(r) => r,
        Err(_) => return Ok(vec![]),
    };

    let mut revwalk = repo.revwalk().map_err(|e| format!("revwalk error: {e}"))?;
    revwalk.push_head().ok(); // Ignore error if no commits yet
    revwalk
        .set_sorting(git2::Sort::TIME)
        .map_err(|e| format!("sort error: {e}"))?;

    let mut entries = Vec::new();
    let max_entries = 100;

    for oid_result in revwalk {
        if entries.len() >= max_entries {
            break;
        }

        let oid = match oid_result {
            Ok(o) => o,
            Err(_) => continue,
        };

        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };

        // If path filter requested, check if commit touches that path
        if let Some(filter_path) = path {
            let dominated = commit_touches_path(&repo, &commit, filter_path);
            if !dominated {
                continue;
            }
        }

        let timestamp = commit.time();
        let epoch = timestamp.seconds();
        let iso = chrono::DateTime::from_timestamp(epoch, 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default();

        entries.push(VersionEntry {
            id: oid.to_string(),
            message: commit.message().unwrap_or("").to_string(),
            timestamp: iso,
            author: commit
                .author()
                .name()
                .unwrap_or("unknown")
                .to_string(),
        });
    }

    Ok(entries)
}

#[tauri::command]
pub fn storage_git_show(
    project_id: &str,
    version_id: &str,
) -> Result<VersionSnapshotPayload, String> {
    let repo = Repository::open(project_dir(project_id))
        .map_err(|e| format!("open repo error: {e}"))?;
    let oid = git2::Oid::from_str(version_id).map_err(|e| format!("invalid version id: {e}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("find commit error: {e}"))?;
    let tree = commit
        .tree()
        .map_err(|e| format!("commit tree error: {e}"))?;

    let metadata = match read_tree_file(&repo, &tree, "project.json") {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    };

    let mut chapters = Vec::new();
    if let Ok(chapters_entry) = tree.get_path(Path::new("chapters")) {
        let chapters_tree = chapters_entry
            .to_object(&repo)
            .map_err(|e| format!("chapters object error: {e}"))?
            .peel_to_tree()
            .map_err(|e| format!("chapters tree error: {e}"))?;

        for entry in &chapters_tree {
            let Some(name) = entry.name() else {
                continue;
            };
            if !name.ends_with(".md") {
                continue;
            }

            let chapter_id = name.trim_end_matches(".md");
            let content = read_tree_file(&repo, &tree, &format!("chapters/{name}"))?;
            let meta_path = format!("chapters/{chapter_id}.meta.json");
            let meta: serde_json::Value = match read_tree_file(&repo, &tree, &meta_path) {
                Ok(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({})),
                Err(_) => serde_json::json!({}),
            };

            chapters.push(ChapterPayload {
                id: chapter_id.to_string(),
                title: meta["title"].as_str().unwrap_or("Untitled").to_string(),
                content,
                summary: meta["summary"].as_str().map(String::from),
                sequence_number: meta["sequenceNumber"].as_u64().unwrap_or(1) as u32,
                status: meta["status"].as_str().unwrap_or("draft").to_string(),
                created_at: meta["createdAt"].as_str().unwrap_or_default().to_string(),
                updated_at: meta["updatedAt"].as_str().unwrap_or_default().to_string(),
            });
        }
    }

    chapters.sort_by_key(|chapter| chapter.sequence_number);

    let timestamp = commit.time();
    let entry = VersionEntry {
        id: version_id.to_string(),
        message: commit.message().unwrap_or("").to_string(),
        timestamp: chrono::DateTime::from_timestamp(timestamp.seconds(), 0)
            .map(|dt| dt.to_rfc3339())
            .unwrap_or_default(),
        author: commit.author().name().unwrap_or("unknown").to_string(),
    };

    Ok(VersionSnapshotPayload {
        entry,
        chapters,
        metadata,
    })
}

fn commit_touches_path(_repo: &Repository, commit: &git2::Commit, path: &str) -> bool {
    let tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return false,
    };

    // Check if path exists in this commit's tree
    tree.get_path(Path::new(path)).is_ok()
}
