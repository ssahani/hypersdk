//! Automation: RBAC, API tokens, alerts, webhooks, scheduled actions.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::LibvirtError;

const DATA_DIR: &str = "/var/lib/virtspawn";

// ── RBAC ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Role {
    #[serde(rename = "admin")]
    Admin,
    #[serde(rename = "operator")]
    Operator,
    #[serde(rename = "readonly")]
    ReadOnly,
}

impl Role {
    pub fn can_write(&self) -> bool {
        matches!(self, Role::Admin | Role::Operator)
    }
    pub fn can_delete(&self) -> bool {
        matches!(self, Role::Admin)
    }
    pub fn can_manage_users(&self) -> bool {
        matches!(self, Role::Admin)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserRole {
    pub username: String,
    pub role: Role,
}

type RoleMap = HashMap<String, Role>;

fn roles_path() -> String { format!("{DATA_DIR}/roles.json") }

pub fn load_roles() -> RoleMap {
    match std::fs::read_to_string(roles_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

pub fn save_roles(roles: &RoleMap) -> Result<(), LibvirtError> {
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(roles)
        .map_err(|e| LibvirtError::Operation(format!("Serialize roles: {e}")))?;
    std::fs::write(roles_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("Write roles: {e}")))?;
    Ok(())
}

pub fn get_user_role(username: &str) -> Role {
    let roles = load_roles();
    roles.get(username).cloned().unwrap_or(Role::Admin) // default: admin (backward compat)
}

pub fn set_user_role(username: &str, role: Role) -> Result<(), LibvirtError> {
    let mut roles = load_roles();
    roles.insert(username.to_string(), role);
    save_roles(&roles)
}

// ── API Tokens ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiToken {
    pub name: String,
    pub token: String,
    pub username: String,
    pub role: Role,
    pub created: String,
}

type TokenMap = HashMap<String, ApiToken>; // token -> ApiToken

fn tokens_path() -> String { format!("{DATA_DIR}/api-tokens.json") }

pub fn load_tokens() -> TokenMap {
    match std::fs::read_to_string(tokens_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn save_tokens(tokens: &TokenMap) -> Result<(), LibvirtError> {
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(tokens)
        .map_err(|e| LibvirtError::Operation(format!("Serialize tokens: {e}")))?;
    std::fs::write(tokens_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("Write tokens: {e}")))?;
    Ok(())
}

pub fn create_api_token(name: &str, username: &str, role: Role) -> Result<ApiToken, LibvirtError> {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let bytes: [u8; 32] = rng.gen();
    let token = format!("vs_{}", hex::encode(bytes));

    let api_token = ApiToken {
        name: name.to_string(),
        token: token.clone(),
        username: username.to_string(),
        role,
        created: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };

    let mut tokens = load_tokens();
    tokens.insert(token, api_token.clone());
    save_tokens(&tokens)?;
    Ok(api_token)
}

pub fn validate_api_token(token: &str) -> Option<ApiToken> {
    let tokens = load_tokens();
    tokens.get(token).cloned()
}

pub fn delete_api_token(token: &str) -> Result<(), LibvirtError> {
    let mut tokens = load_tokens();
    tokens.remove(token);
    save_tokens(&tokens)
}

pub fn list_api_tokens() -> Vec<ApiToken> {
    let tokens = load_tokens();
    let mut list: Vec<ApiToken> = tokens.into_values().collect();
    // Mask token values for listing
    for t in &mut list {
        if t.token.len() > 12 {
            t.token = format!("{}...{}", &t.token[..8], &t.token[t.token.len()-4..]);
        }
    }
    list
}

// ── Alerts ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertRule {
    pub id: String,
    pub name: String,
    pub condition: String,   // cpu_percent > 90, disk_percent > 85, vm_down
    pub threshold: f64,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub id: String,
    pub rule_name: String,
    pub message: String,
    pub severity: String, // warning, critical
    pub timestamp: String,
    pub acknowledged: bool,
}

fn alerts_path() -> String { format!("{DATA_DIR}/alerts.json") }
fn alert_rules_path() -> String { format!("{DATA_DIR}/alert-rules.json") }

pub fn load_alert_rules() -> Vec<AlertRule> {
    match std::fs::read_to_string(alert_rules_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => default_alert_rules(),
    }
}

fn default_alert_rules() -> Vec<AlertRule> {
    vec![
        AlertRule { id: "cpu-high".into(), name: "High CPU".into(), condition: "cpu_percent".into(), threshold: 90.0, enabled: true },
        AlertRule { id: "mem-high".into(), name: "High Memory".into(), condition: "memory_percent".into(), threshold: 90.0, enabled: true },
        AlertRule { id: "disk-high".into(), name: "Disk Full".into(), condition: "disk_percent".into(), threshold: 85.0, enabled: true },
    ]
}

pub fn save_alert_rules(rules: &[AlertRule]) -> Result<(), LibvirtError> {
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(rules)
        .map_err(|e| LibvirtError::Operation(format!("Serialize alert rules: {e}")))?;
    std::fs::write(alert_rules_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("Write alert rules: {e}")))?;
    Ok(())
}

pub fn load_alerts() -> Vec<Alert> {
    match std::fs::read_to_string(alerts_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_alert(alert: &Alert) -> Result<(), LibvirtError> {
    let mut alerts = load_alerts();
    // Keep only last 100 alerts
    if alerts.len() > 100 { alerts.drain(0..alerts.len()-100); }
    alerts.push(alert.clone());
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(&alerts)
        .map_err(|e| LibvirtError::Operation(format!("Serialize alerts: {e}")))?;
    std::fs::write(alerts_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("Write alerts: {e}")))?;
    Ok(())
}

pub fn acknowledge_alert(id: &str) -> Result<(), LibvirtError> {
    let mut alerts = load_alerts();
    for a in &mut alerts {
        if a.id == id { a.acknowledged = true; }
    }
    let data = serde_json::to_string_pretty(&alerts)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    std::fs::write(alerts_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    Ok(())
}

// ── Webhooks ───────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub id: String,
    pub url: String,
    pub events: Vec<String>, // vm_started, vm_stopped, alert_fired, etc.
    pub enabled: bool,
}

fn webhooks_path() -> String { format!("{DATA_DIR}/webhooks.json") }

pub fn load_webhooks() -> Vec<WebhookConfig> {
    match std::fs::read_to_string(webhooks_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_webhooks(hooks: &[WebhookConfig]) -> Result<(), LibvirtError> {
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(hooks)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    std::fs::write(webhooks_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    Ok(())
}

pub fn fire_webhook(event: &str, payload: &serde_json::Value) {
    let hooks = load_webhooks();
    for hook in hooks {
        if !hook.enabled { continue; }
        if !hook.events.contains(&event.to_string()) && !hook.events.contains(&"*".to_string()) { continue; }
        let url = hook.url.clone();
        let body = serde_json::json!({ "event": event, "data": payload }).to_string();
        // Fire and forget in background
        std::thread::spawn(move || {
            let _ = std::process::Command::new("curl")
                .args(["-sf", "-X", "POST", "-H", "Content-Type: application/json", "-d", &body, &url])
                .output();
        });
    }
}

// ── Scheduled Actions ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledAction {
    pub id: String,
    pub vm_name: String,
    pub action: String,     // start, stop, shutdown, snapshot, reboot
    pub schedule: String,   // cron-like: "0 22 * * *" or simple: "daily 22:00"
    pub enabled: bool,
    pub last_run: String,
}

fn schedules_path() -> String { format!("{DATA_DIR}/schedules.json") }

pub fn load_schedules() -> Vec<ScheduledAction> {
    match std::fs::read_to_string(schedules_path()) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

pub fn save_schedules(schedules: &[ScheduledAction]) -> Result<(), LibvirtError> {
    let _ = std::fs::create_dir_all(DATA_DIR);
    let data = serde_json::to_string_pretty(schedules)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    std::fs::write(schedules_path(), data)
        .map_err(|e| LibvirtError::Operation(format!("{e}")))?;
    Ok(())
}

/// Check if a schedule should run now (simple daily HH:MM matching).
pub fn should_run_now(schedule: &str) -> bool {
    let now = chrono::Local::now();
    // Parse "daily HH:MM" format
    if let Some(time) = schedule.strip_prefix("daily ") {
        let parts: Vec<&str> = time.split(':').collect();
        if parts.len() == 2 {
            let hour: u32 = parts[0].parse().unwrap_or(99);
            let min: u32 = parts[1].parse().unwrap_or(99);
            return now.format("%H").to_string().parse::<u32>().unwrap_or(0) == hour
                && now.format("%M").to_string().parse::<u32>().unwrap_or(0) == min;
        }
    }
    false
}
