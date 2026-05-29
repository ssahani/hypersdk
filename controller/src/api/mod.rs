// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

pub mod apikeys;
mod ai;
mod applications;
mod audit;
mod backups;
mod backup_targets;
mod baremetal;
mod blueprints;
mod cluster;
mod content;
pub mod cpu_compat;
mod enrollment;
mod error;
mod events;
mod fence;
mod ha;
mod health;
mod health_check;
mod hosts;
mod maintenance;
mod metrics;
mod migration_jobs;
mod networks;
mod notifications;
mod oidc;
mod placement;
mod policy;
mod projects;
mod recommendations;
mod reports;
mod snapshots;
mod sse;
mod storage;
mod support;
mod tasks;
mod templates;
mod topology;
mod upgrade;
mod users;
mod vms;
mod webhooks;

use axum::middleware;
use axum::routing::{delete, get, patch, post};
use axum::Router;

use crate::auth::auth_middleware;
use crate::console;
use crate::rate_limit::{rate_limit_middleware, RateLimiter};
use crate::state::AppState;

pub fn router(state: AppState) -> Router {
    let rate_limiter = RateLimiter::new(300);
    let protected = Router::new()
        .route(
            "/api/v1/enrollment/tokens",
            get(enrollment::list_enrollment_tokens).post(enrollment::create_enrollment_token),
        )
        .route("/api/v1/hosts", get(hosts::list_hosts).post(hosts::create_host))
        .route("/api/v1/hosts/sync-all", post(hosts::sync_all_hosts))
        .route(
            "/api/v1/hosts/{id}",
            get(hosts::get_host)
                .patch(hosts::patch_host)
                .delete(hosts::delete_host),
        )
        .route("/api/v1/hosts/{id}/detail", get(hosts::get_host_detail))
        .route("/api/v1/hosts/{id}/validate", get(hosts::validate_host).post(hosts::enqueue_validate_host))
        .route("/api/v1/hosts/{id}/sync", post(hosts::sync_host))
        .route("/api/v1/hosts/{id}/maintenance", post(hosts::host_maintenance))
        .route("/api/v1/vms", get(vms::list_vms).post(vms::create_vm))
        .route(
            "/api/v1/enrollment/tokens/{token}",
            delete(enrollment::revoke_enrollment_token),
        )
        .route("/api/v1/hosts/{id}/fence", post(maintenance::fence_host_manual))
        .route("/api/v1/vms/{id}", get(vms::get_vm).patch(vms::patch_vm))
        .route("/api/v1/vms/{id}/disks", get(vms::list_vm_disks))
        .route("/api/v1/vms/{id}/disks/attach", post(vms::attach_vm_disk))
        .route("/api/v1/vms/{id}/metrics", get(vms::get_vm_metrics))
        .route("/api/v1/vms/{id}/adopt", post(vms::adopt_vm))
        .route("/api/v1/vms/{id}/health-check", post(health_check::vm_health_check))
        .route("/api/v1/vms/{id}/doctor", get(ai::vm_doctor))
        .route("/api/v1/ai/settings", get(ai::get_settings).patch(ai::patch_settings))
        .route("/api/v1/ai/spotlight", post(ai::spotlight))
        .route("/api/v1/ai/copilot/chat", post(ai::copilot_chat))
        .route("/api/v1/ai/copilot/stream", post(ai::copilot_stream))
        .route("/api/v1/ai/explain", post(ai::explain))
        .route("/api/v1/ai/runbook", post(ai::runbook))
        .route("/api/v1/ai/blueprints/generate", post(ai::generate_blueprint))
        .route("/api/v1/ai/cost", get(ai::cost_guardian))
        .route("/api/v1/ai/cost/export.csv", get(ai::cost_export_csv))
        .route("/api/v1/ai/capacity", get(ai::capacity_planner))
        .route("/api/v1/ai/capacity/export.csv", get(ai::capacity_export_csv))
        .route("/api/v1/ai/fleet/summary", get(ai::fleet_summary))
        .route("/api/v1/ai/fleet/local", get(ai::fleet_local))
        .route("/api/v1/ai/twin/graph", get(ai::twin_graph))
        .route("/api/v1/ai/twin/impact", post(ai::twin_impact))
        .route("/api/v1/ai/incidents/analyze", get(ai::analyze_incident))
        .route("/api/v1/ai/intent/environment", post(ai::intent_environment))
        .route("/api/v1/ai/sre/forecast", get(ai::sre_forecast))
        .route("/api/v1/ai/fleet/heatmap", get(ai::fleet_heatmap))
        .route("/api/v1/ai/fleet/rebalance/propose", get(ai::fleet_rebalance_propose))
        .route("/api/v1/ai/fleet/rebalance/execute", post(ai::fleet_rebalance_execute))
        .route("/api/v1/ai/cost/attribution", get(ai::cost_attribution))
        .route("/api/v1/ai/compliance/frameworks", get(ai::compliance_frameworks))
        .route("/api/v1/ai/security/graph", get(ai::security_graph))
        .route("/api/v1/ai/security/attack-path", post(ai::security_attack_path))
        .route("/api/v1/ai/knowledge/search", post(ai::knowledge_search))
        .route("/api/v1/ai/services/graph", get(ai::service_graph))
        .route("/api/v1/ai/memory/incidents", get(ai::infrastructure_memory))
        .route("/api/v1/ai/mission/stack", post(ai::mission_stack))
        .route("/api/v1/baremetal/servers", get(baremetal::list_servers).post(baremetal::register_server))
        .route("/api/v1/baremetal/servers/{id}/power", post(baremetal::server_power))
        .route("/api/v1/baremetal/capacity/plan", post(baremetal::capacity_plan))
        .route("/api/v1/ai/security", get(ai::security_sentinel))
        .route("/api/v1/ai/policy/export", get(ai::policy_export))
        .route("/api/v1/ai/autopilot/propose", get(ai::autopilot_propose))
        .route("/api/v1/ai/autopilot/execute", post(ai::autopilot_execute))
        .route("/api/v1/ai/autopilot/run", post(ai::autopilot_run))
        .route("/api/v1/ai/autopilot/history", get(ai::autopilot_history))
        .route("/api/v1/ai/compliance", get(ai::compliance_report))
        .route("/api/v1/ai/compliance/export", get(ai::compliance_export_html))
        .route("/api/v1/ai/compliance/export.pdf", get(ai::compliance_export_pdf))
        .route("/api/v1/ai/terminal/suggest", post(ai::terminal_suggest))
        .route("/api/v1/ai/network/explain", post(ai::network_explain))
        .route("/api/v1/migrations/advisor", get(ai::migration_advisor))
        .route("/api/v1/hosts/{id}/health-check", post(health_check::host_health_check))
        .route("/api/v1/recommendations", get(recommendations::list_recommendations))
        .route(
            "/api/v1/applications",
            get(applications::list_applications).post(applications::create_application),
        )
        .route("/api/v1/applications/{id}", get(applications::get_application))
        .route(
            "/api/v1/applications/{id}/actions",
            post(applications::run_application_action),
        )
        .route("/api/v1/topology", get(topology::cluster_topology))
        .route("/api/v1/vms/{id}/topology", get(topology::vm_topology))
        .route("/api/v1/vms/{id}/spec", get(vms::get_vm_spec))
        .route("/api/v1/vms/{id}/start", post(vms::start_vm))
        .route("/api/v1/vms/{id}/stop", post(vms::stop_vm))
        .route("/api/v1/vms/{id}/reboot", post(vms::reboot_vm))
        .route("/api/v1/vms/{id}/delete", post(vms::delete_vm))
        .route(
            "/api/v1/vms/{id}/guest-tools/install",
            post(vms::install_guest_tools),
        )
        .route("/api/v1/vms/{id}/migrate/precheck", post(vms::migrate_precheck))
        .route("/api/v1/vms/{id}/migrate", post(vms::migrate_vm))
        .route(
            "/api/v1/vms/{id}/ha",
            get(ha::get_vm_ha_policy).post(ha::set_vm_ha_policy),
        )
        .route("/api/v1/vms/from-template", post(vms::create_from_template))
        .route("/api/v1/vms/{id}/clone", post(vms::clone_vm))
        .route("/api/v1/vms/{id}/console", get(console::vm_console))
        .route("/api/v1/vms/{id}/ws-token", post(console::issue_ws_token))
        .route(
            "/api/v1/vms/{id}/snapshots",
            get(snapshots::list_vm_snapshots).post(snapshots::create_vm_snapshot),
        )
        .route(
            "/api/v1/vms/{id}/snapshots/{name}",
            delete(snapshots::delete_vm_snapshot),
        )
        .route(
            "/api/v1/vms/{id}/snapshots/{name}/revert",
            post(snapshots::revert_vm_snapshot),
        )
        .route(
            "/api/v1/vms/{id}/snapshots/{name}/clone",
            post(snapshots::clone_vm_snapshot),
        )
        .route(
            "/api/v1/vms/{id}/backups",
            get(backups::list_vm_backups).post(backups::create_vm_backup),
        )
        .route(
            "/api/v1/backup-targets",
            get(backup_targets::list_backup_targets).post(backup_targets::create_backup_target),
        )
        .route("/api/v1/backups/timeline", get(backups::list_backup_timeline))
        .route(
            "/api/v1/vms/{id}/backups/{backup_id}/restore",
            post(backups::restore_vm_backup),
        )
        .route(
            "/api/v1/vms/{id}/migrations",
            get(migration_jobs::list_vm_migration_jobs),
        )
        .route(
            "/api/v1/templates",
            get(templates::list_templates).post(templates::create_template),
        )
        .route(
            "/api/v1/templates/marketplace",
            get(templates::list_marketplace_templates),
        )
        .route("/api/v1/templates/seed", post(templates::seed_templates))
        .route(
            "/api/v1/templates/{name}/{version}",
            get(templates::get_template).delete(templates::delete_template),
        )
        .route(
            "/api/v1/templates/{name}/{version}/readiness",
            get(templates::get_template_readiness),
        )
        .route(
            "/api/v1/storage/pools",
            get(storage::list_storage_pools).post(storage::create_storage_pool),
        )
        .route("/api/v1/storage/pools/discover", post(storage::discover_storage_pools))
        .route(
            "/api/v1/storage/pools/{id}",
            patch(storage::patch_storage_pool).delete(storage::delete_storage_pool),
        )
        .route(
            "/api/v1/networks",
            get(networks::list_networks).post(networks::create_network),
        )
        .route("/api/v1/networks/discover", post(networks::discover_networks))
        .route(
            "/api/v1/networks/{id}",
            patch(networks::patch_network).delete(networks::delete_network),
        )
        .route("/api/v1/placement/recommendations", get(placement::list_recommendations))
        .route("/api/v1/placement/refresh", post(placement::refresh_recommendations))
        .route("/api/v1/cluster", get(cluster::get_cluster).patch(cluster::patch_cluster))
        .route("/api/v1/cluster/leadership", get(cluster::get_leadership))
        .route(
            "/api/v1/cluster/settings",
            get(cluster::get_settings).patch(cluster::patch_settings),
        )
        .route("/api/v1/ha/status", get(ha::get_ha_status))
        .route("/api/v1/migrations", get(migration_jobs::list_migration_jobs))
        .route("/api/v1/fence/events", get(fence::list_fence_events))
        .route("/api/v1/audit", get(audit::list_audit_logs))
        .route("/api/v1/tasks", get(tasks::list_tasks))
        .route("/api/v1/tasks/{id}", get(tasks::get_task))
        .route("/api/v1/tasks/{id}/cancel", post(tasks::cancel_task))
        .route("/api/v1/tasks/{id}/retry", post(tasks::retry_task))
        .route("/api/v1/events", get(events::list_events))
        .route("/api/v1/events/stream", get(sse::stream_events))
        .route(
            "/api/v1/content/images",
            get(content::list_content_images).post(content::create_content_image),
        )
        .route(
            "/api/v1/content/images/{id}/approve",
            post(content::approve_content_image),
        )
        .route(
            "/api/v1/content/images/{id}/reject",
            post(content::reject_content_image),
        )
        .route("/api/v1/users", get(users::list_users).post(users::create_user))
        .route("/api/v1/users/me", get(users::me))
        .route(
            "/api/v1/users/{id}",
            patch(users::patch_user).delete(users::delete_user),
        )
        .route("/api/v1/api-keys", get(apikeys::list_api_keys).post(apikeys::create_api_key))
        .route("/api/v1/api-keys/{id}", delete(apikeys::delete_api_key))
        .route("/api/v1/webhooks", get(webhooks::list_webhooks).post(webhooks::create_webhook))
        .route("/api/v1/webhooks/{id}", delete(webhooks::delete_webhook))
        .route("/api/v1/webhooks/{id}/toggle", post(webhooks::toggle_webhook))
        .route("/api/v1/webhook-deliveries", get(webhooks::list_webhook_deliveries))
        .route(
            "/api/v1/webhook-deliveries/{id}/retry",
            post(webhooks::retry_webhook_delivery),
        )
        .route("/api/v1/projects", get(projects::list_projects))
        .route("/api/v1/policy/rules", get(policy::list_policy_rules))
        .route("/api/v1/policy/quotas", get(policy::list_project_quotas).post(policy::upsert_project_quota))
        .route("/api/v1/support/bundle", get(support::support_bundle))
        .route("/api/v1/upgrade/matrix", get(upgrade::upgrade_matrix))
        .route("/api/v1/hosts/{id}/upgrade", post(upgrade::upgrade_host_agent))
        .route("/api/v1/reports/capacity", get(reports::capacity_report))
        .route("/api/v1/reports/finops", get(reports::finops_report))
        .route(
            "/api/v1/blueprints",
            get(blueprints::list_blueprints).post(blueprints::create_blueprint),
        )
        .route(
            "/api/v1/blueprints/{id}/run",
            post(blueprints::run_blueprint),
        )
        .route("/api/v1/blueprints/{id}", delete(blueprints::delete_blueprint))
        .route("/api/v1/metrics/prometheus", get(metrics::prometheus_metrics))
        .route(
            "/api/v1/maintenance/schedules",
            get(maintenance::list_schedules).post(maintenance::create_schedule),
        )
        .route(
            "/api/v1/maintenance/schedules/{id}",
            delete(maintenance::delete_schedule),
        )
        .route("/api/v1/notifications", get(notifications::list_notifications))
        .route(
            "/api/v1/notifications/{id}/deliver",
            post(notifications::mark_notification_delivered),
        )
        .route("/api/v1/auth/oidc", get(oidc::get_oidc_settings).patch(oidc::patch_oidc_settings))
        .route(
            "/api/v1/cpu-compat",
            get(cpu_compat::get_cpu_compat_matrix).patch(cpu_compat::patch_cpu_compat_matrix),
        )
        .route_layer(middleware::from_fn_with_state(rate_limiter.clone(), rate_limit_middleware))
        .route_layer(middleware::from_fn_with_state(state.clone(), auth_middleware));

    Router::new()
        .route("/api/v1/health", get(health::health))
        .route("/api/v1/health/ready", get(health::ready))
        .route("/api/v1/openapi.json", get(health::openapi))
        .route("/api/v1/auth/oidc/login", get(oidc::oidc_login))
        .route("/api/v1/auth/oidc/redirect", get(oidc::oidc_login_redirect))
        .route("/api/v1/auth/oidc/callback", get(oidc::oidc_callback))
        .route("/api/v1/hosts/join", post(hosts::join_host))
        .route("/install.sh", get(enrollment::install_script))
        .merge(console::ws_routes())
        .merge(protected)
        .with_state(state)
}

pub use error::ApiError;
