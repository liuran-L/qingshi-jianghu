use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;
use std::fs;
use tauri::{Manager, Runtime};

fn valid_slot(slot: &str) -> bool {
    slot == "auto" || (1..=20).any(|value| slot == format!("manual-{value}"))
}

fn open_database<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<Connection, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let connection = Connection::open(directory.join("qingshi-jianghu-v5.db")).map_err(|error| error.to_string())?;
    connection.execute_batch(
        "CREATE TABLE IF NOT EXISTS saves (slot TEXT PRIMARY KEY, label TEXT NOT NULL, payload TEXT NOT NULL, saved_at INTEGER NOT NULL);
         CREATE TABLE IF NOT EXISTS save_backups (slot TEXT PRIMARY KEY, payload TEXT NOT NULL, saved_at INTEGER NOT NULL);",
    ).map_err(|error| error.to_string())?;
    Ok(connection)
}

#[tauri::command]
fn save_game(app: tauri::AppHandle, slot: String, payload: String, saved_at: i64, label: Option<String>, rotate_backup: bool) -> Result<(), String> {
    if !valid_slot(&slot) || serde_json::from_str::<serde_json::Value>(&payload).is_err() {
        return Err("非法存档数据".into());
    }
    let mut connection = open_database(&app)?;
    let transaction = connection.transaction().map_err(|error| error.to_string())?;
    if slot == "auto" && rotate_backup {
        if let Some((old_payload, old_saved_at)) = transaction
            .query_row("SELECT payload, saved_at FROM saves WHERE slot = 'auto'", [], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)))
            .optional().map_err(|error| error.to_string())?
        {
            transaction.execute(
                "INSERT INTO save_backups(slot, payload, saved_at) VALUES('auto', ?1, ?2)
                 ON CONFLICT(slot) DO UPDATE SET payload = excluded.payload, saved_at = excluded.saved_at",
                params![old_payload, old_saved_at],
            ).map_err(|error| error.to_string())?;
        }
    }
    let fallback_label = if slot == "auto" { "自动存档".to_string() } else { format!("手动存档 {}", slot.trim_start_matches("manual-")) };
    let old_label: Option<String> = transaction.query_row("SELECT label FROM saves WHERE slot = ?1", params![slot], |row| row.get(0)).optional().map_err(|error| error.to_string())?;
    let save_label = if slot == "auto" { fallback_label } else { label.filter(|value| !value.trim().is_empty()).map(|value| value.trim().chars().take(24).collect()).or(old_label).unwrap_or(fallback_label) };
    transaction.execute(
        "INSERT INTO saves(slot, label, payload, saved_at) VALUES(?1, ?2, ?3, ?4)
         ON CONFLICT(slot) DO UPDATE SET label = excluded.label, payload = excluded.payload, saved_at = excluded.saved_at",
        params![slot, save_label, payload, saved_at],
    ).map_err(|error| error.to_string())?;
    transaction.commit().map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveSummary {
    id: String,
    label: String,
    exists: bool,
    player_name: Option<String>,
    world_minutes: Option<i64>,
    location_id: Option<String>,
    game_version: Option<i64>,
    saved_at: Option<i64>,
}

#[tauri::command]
fn list_saves(app: tauri::AppHandle) -> Result<Vec<SaveSummary>, String> {
    let connection = open_database(&app)?;
    let mut ids = vec!["auto".to_string()];
    ids.extend((1..=20).map(|index| format!("manual-{index}")));
    ids.into_iter().map(|id| {
        let row: Option<(String, String, i64)> = connection.query_row(
            "SELECT label, payload, saved_at FROM saves WHERE slot = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).optional().map_err(|error| error.to_string())?;
        if let Some((label, payload, saved_at)) = row {
            let value: serde_json::Value = serde_json::from_str(&payload).unwrap_or(serde_json::Value::Null);
            Ok(SaveSummary {
                id,
                label,
                exists: true,
                player_name: value.pointer("/player/name").and_then(|item| item.as_str()).map(str::to_string),
                world_minutes: value.get("worldMinutes").and_then(|item| item.as_i64()),
                location_id: value.get("locationId").and_then(|item| item.as_str()).map(str::to_string),
                game_version: value.get("version").and_then(|item| item.as_i64()),
                saved_at: Some(saved_at),
            })
        } else {
            let label = if id == "auto" { "自动存档".to_string() } else { format!("手动存档 {}", id.trim_start_matches("manual-")) };
            Ok(SaveSummary { id, label, exists: false, player_name: None, world_minutes: None, location_id: None, game_version: None, saved_at: None })
        }
    }).collect()
}

#[tauri::command]
fn rename_save(app: tauri::AppHandle, slot: String, label: String) -> Result<(), String> {
    let trimmed = label.trim();
    if !valid_slot(&slot) || slot == "auto" || trimmed.is_empty() { return Err("不能重命名此存档".into()); }
    let connection = open_database(&app)?;
    let name: String = trimmed.chars().take(24).collect();
    let changed = connection.execute("UPDATE saves SET label = ?1 WHERE slot = ?2", params![name, slot]).map_err(|error| error.to_string())?;
    if changed == 0 { return Err("存档不存在".into()); }
    Ok(())
}

#[tauri::command]
fn delete_save(app: tauri::AppHandle, slot: String) -> Result<(), String> {
    if !valid_slot(&slot) || slot == "auto" { return Err("不能删除此存档".into()); }
    let connection = open_database(&app)?;
    connection.execute("DELETE FROM saves WHERE slot = ?1", params![slot]).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_game(app: tauri::AppHandle, slot: String) -> Result<Option<String>, String> {
    if !valid_slot(&slot) { return Err("非法存档位".into()); }
    let connection = open_database(&app)?;
    connection.query_row("SELECT payload FROM saves WHERE slot = ?1", params![slot], |row| row.get(0)).optional().map_err(|error| error.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupRecord { payload: String, saved_at: i64 }

#[tauri::command]
fn load_backup(app: tauri::AppHandle) -> Result<Option<BackupRecord>, String> {
    let connection = open_database(&app)?;
    connection.query_row("SELECT payload, saved_at FROM save_backups WHERE slot = 'auto'", [], |row| Ok(BackupRecord { payload: row.get(0)?, saved_at: row.get(1)? })).optional().map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_game, load_game, load_backup, list_saves, rename_save, delete_save])
        .run(tauri::generate_context!())
        .expect("failed to run qingshi jianghu");
}
