#!/bin/bash
# Installation script for hyper2kvmd

set -e

echo "Installing hyper2kvmd..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (use sudo)"
  exit 1
fi

# Create directories
echo "Creating directories..."
mkdir -p /usr/local/bin
mkdir -p /etc/hyper2kvm
mkdir -p /var/lib/hyper2kvm
mkdir -p /var/log/hyper2kvm

# Copy binaries
echo "Installing binaries..."
cp build/hyper2kvmd /usr/local/bin/
cp build/h2kvmctl /usr/local/bin/
chmod +x /usr/local/bin/hyper2kvmd
chmod +x /usr/local/bin/h2kvmctl

# Copy config if it doesn't exist
if [ ! -f /etc/hyper2kvm/config.yaml ]; then
  echo "Installing default config..."
  cp config.yaml.example /etc/hyper2kvm/config.yaml
  echo "IMPORTANT: Edit /etc/hyper2kvm/config.yaml with your vCenter credentials"
fi

# Install systemd service
echo "Installing systemd service..."
cp hyper2kvmd.service /etc/systemd/system/
systemctl daemon-reload

echo "Installation complete!"
echo ""
echo "Next steps:"
echo "  1. Edit /etc/hyper2kvm/config.yaml with your vCenter credentials"
echo "  2. Start the daemon: sudo systemctl start hyper2kvmd"
echo "  3. Enable auto-start: sudo systemctl enable hyper2kvmd"
echo "  4. Check status: sudo systemctl status hyper2kvmd"
echo "  5. View logs: sudo journalctl -u hyper2kvmd -f"
echo ""
echo "Query the daemon with: h2kvmctl status"
