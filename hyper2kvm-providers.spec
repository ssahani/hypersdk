Name:           hyper2kvm-providers
Version:        0.0.1
Release:        1%{?dist}
Summary:        Multi-cloud VM export providers for hyper2kvm migration toolkit

License:        LGPL-3.0-or-later
URL:            https://github.com/ssahani/hyper2kvm-providers
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  golang >= 1.21
BuildRequires:  systemd-rpm-macros
BuildRequires:  git

Requires:       systemd

%description
hyper2kvm-providers is a high-performance, daemon-based VM export system that
provides a provider layer abstraction for multiple clouds (vSphere, AWS, Azure,
GCP). It offers:
- Interactive CLI (hyper2kvm) for manual exports with beautiful terminal UI
- Background daemon (hyper2kvmd) with REST API for automation
- Control CLI (h2kvmctl) for daemon management
- Support for vSphere today, with AWS/Azure/GCP coming soon

%prep
%setup -q

%build
# Build all binaries
go build -v -o hyper2kvm ./cmd/hyper2kvm
go build -v -o hyper2kvmd ./cmd/hyper2kvmd
go build -v -o h2kvmctl ./cmd/h2kvmctl

%install
# Install binaries
install -Dm755 hyper2kvm %{buildroot}%{_bindir}/hyper2kvm
install -Dm755 hyper2kvmd %{buildroot}%{_bindir}/hyper2kvmd
install -Dm755 h2kvmctl %{buildroot}%{_bindir}/h2kvmctl

# Install systemd service
install -Dm644 hyper2kvmd.service %{buildroot}%{_unitdir}/hyper2kvmd.service

# Install configuration
install -Dm644 config.yaml.example %{buildroot}%{_sysconfdir}/hyper2kvm/config.yaml

# Create data directory
install -dm755 %{buildroot}%{_sharedstatedir}/hyper2kvm
install -dm755 %{buildroot}%{_localstatedir}/log/hyper2kvm

# Install documentation
install -Dm644 README.md %{buildroot}%{_docdir}/%{name}/README.md
install -Dm644 GETTING-STARTED.md %{buildroot}%{_docdir}/%{name}/GETTING-STARTED.md
install -Dm644 example-job.yaml %{buildroot}%{_docdir}/%{name}/example-job.yaml
install -Dm644 example-batch.yaml %{buildroot}%{_docdir}/%{name}/example-batch.yaml

%pre
# Create system user for the daemon if it doesn't exist
getent group hyper2kvm >/dev/null || groupadd -r hyper2kvm
getent passwd hyper2kvm >/dev/null || \
    useradd -r -g hyper2kvm -d %{_sharedstatedir}/hyper2kvm \
    -s /sbin/nologin -c "hyper2kvm daemon user" hyper2kvm
exit 0

%post
%systemd_post hyper2kvmd.service

# Set ownership
chown -R hyper2kvm:hyper2kvm %{_sharedstatedir}/hyper2kvm
chown -R hyper2kvm:hyper2kvm %{_localstatedir}/log/hyper2kvm

if [ $1 -eq 1 ]; then
    # First install
    echo "hyper2kvm-providers installed successfully!"
    echo "Edit /etc/hyper2kvm/config.yaml with your vCenter credentials"
    echo "Start the daemon: systemctl start hyper2kvmd"
    echo "Enable auto-start: systemctl enable hyper2kvmd"
fi

%preun
%systemd_preun hyper2kvmd.service

%postun
%systemd_postun_with_restart hyper2kvmd.service

if [ $1 -eq 0 ]; then
    # Uninstall
    userdel hyper2kvm 2>/dev/null || true
    groupdel hyper2kvm 2>/dev/null || true
fi

%files
%license LICENSE
%doc README.md GETTING-STARTED.md
%doc %{_docdir}/%{name}/example-job.yaml
%doc %{_docdir}/%{name}/example-batch.yaml
%{_bindir}/hyper2kvm
%{_bindir}/hyper2kvmd
%{_bindir}/h2kvmctl
%{_unitdir}/hyper2kvmd.service
%dir %{_sysconfdir}/hyper2kvm
%config(noreplace) %{_sysconfdir}/hyper2kvm/config.yaml
%attr(0755,hyper2kvm,hyper2kvm) %dir %{_sharedstatedir}/hyper2kvm
%attr(0755,hyper2kvm,hyper2kvm) %dir %{_localstatedir}/log/hyper2kvm

%changelog
* Sat Jan 17 2026 Susant Sahani <ssahani@redhat.com> - 0.0.1-1
- Initial package release (alpha)
- Multi-cloud provider architecture (vSphere today, AWS/Azure/GCP next)
- Beautiful terminal UI with pterm
- REST JSON API daemon
- Configuration file support (YAML)
- Systemd integration
- Parallel downloads with worker pools
- Resumable downloads with retry logic
- Interactive VM selection
- Batch job processing
- Comprehensive logging
