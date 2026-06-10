// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.

pub mod console_ws;
pub mod grpc;
pub mod guacamole_proxy;
pub mod libvirt_invoke;
pub mod libvirt_ops;
pub mod provision_ops;
pub mod state;

pub mod pb {
    tonic::include_proto!("machina.agent.v1");
}
