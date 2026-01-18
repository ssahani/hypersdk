#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install required packages
apt-get install -y \
    curl \
    wget \
    git \
    jq \
    unzip \
    software-properties-common

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Configure CloudWatch Logs Agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<EOF
{
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/hypersdk/daemon.log",
            "log_group_name": "/hypersdk/daemon",
            "log_stream_name": "{instance_id}"
          }
        ]
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Create HyperSDK directories
mkdir -p /opt/hypersdk
mkdir -p /var/log/hypersdk
mkdir -p /etc/hypersdk

# Download HyperSDK daemon (placeholder - actual implementation would download from artifact repository)
# wget https://releases.hypersdk.io/daemon/${daemon_version}/hypersdk-daemon -O /opt/hypersdk/daemon
# chmod +x /opt/hypersdk/daemon

# Create configuration file
cat > /etc/hypersdk/config.yaml <<EOF
daemon:
  port: 8081
  log_level: info

dashboard:
  enabled: true
  port: 8080
  update_interval: 1s

redis:
  endpoint: "${redis_endpoint}"
  enabled: $( [ -n "${redis_endpoint}" ] && echo "true" || echo "false" )

backup:
  enabled: true
  bucket: "${backup_bucket}"
  interval: 24h
  retention_days: 30

monitoring:
  enabled: ${monitoring_enable}
  prometheus_port: 9090
EOF

# Create systemd service
cat > /etc/systemd/system/hypersdk.service <<EOF
[Unit]
Description=HyperSDK Daemon
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hypersdk
ExecStart=/opt/hypersdk/daemon --config /etc/hypersdk/config.yaml
Restart=always
RestartSec=10
StandardOutput=append:/var/log/hypersdk/daemon.log
StandardError=append:/var/log/hypersdk/daemon.log

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service (commented out until daemon binary is available)
# systemctl daemon-reload
# systemctl enable hypersdk
# systemctl start hypersdk

# Install Prometheus Node Exporter if monitoring is enabled
if [ "${monitoring_enable}" = "true" ]; then
    wget https://github.com/prometheus/node_exporter/releases/download/v1.7.0/node_exporter-1.7.0.linux-amd64.tar.gz
    tar xvfz node_exporter-1.7.0.linux-amd64.tar.gz
    mv node_exporter-1.7.0.linux-amd64/node_exporter /usr/local/bin/
    rm -rf node_exporter-1.7.0.linux-amd64*

    cat > /etc/systemd/system/node-exporter.service <<EOF2
[Unit]
Description=Prometheus Node Exporter
After=network.target

[Service]
Type=simple
User=nobody
ExecStart=/usr/local/bin/node_exporter
Restart=always

[Install]
WantedBy=multi-user.target
EOF2

    systemctl daemon-reload
    systemctl enable node-exporter
    systemctl start node-exporter
fi

echo "HyperSDK installation completed"
