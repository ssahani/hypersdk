Name:           hyperexport-providers
Version:        0.0.1
Release:        1%{?dist}
Summary:        Multi-cloud VM export providers for hyperexport migration toolkit

License:        LGPL-3.0-or-later
URL:            https://github.com/ssahani/hyperexport-providers
Source0:        %{name}-%{version}.tar.gz

BuildRequires:  golang >= 1.21
BuildRequires:  systemd-rpm-macros
BuildRequires:  git

Requires:       systemd

%description
hyperexport-providers is a high-performance, daemon-based VM export system that
provides a provider layer abstraction for multiple clouds (vSphere, AWS, Azure,
GCP). It offers:
- Interactive CLI (hyperexport) for manual exports with beautiful terminal UI
- Background daemon (hypervisord) with REST API for automation
- Control CLI (hyperctl) for daemon management
- Support for vSphere today, with AWS/Azure/GCP coming soon

%prep
%setup -q

%build
# Build all binaries
go build -v -o hyperexport ./cmd/hyperexport
go build -v -o hypervisord ./cmd/hypervisord
go build -v -o hyperctl ./cmd/hyperctl

%install
# Install binaries
install -Dm755 hyperexport %{buildroot}%{_bindir}/hyperexport
install -Dm755 hypervisord %{buildroot}%{_bindir}/hypervisord
install -Dm755 hyperctl %{buildroot}%{_bindir}/hyperctl

# Install systemd service
install -Dm644 hypervisord.service %{buildroot}%{_unitdir}/hypervisord.service

# Install configuration
install -Dm644 config.yaml.example %{buildroot}%{_sysconfdir}/hyperexport/config.yaml

# Create data directory
install -dm755 %{buildroot}%{_sharedstatedir}/hyperexport
install -dm755 %{buildroot}%{_localstatedir}/log/hyperexport

# Install documentation
install -Dm644 README.md %{buildroot}%{_docdir}/%{name}/README.md
install -Dm644 GETTING-STARTED.md %{buildroot}%{_docdir}/%{name}/GETTING-STARTED.md
install -Dm644 example-job.yaml %{buildroot}%{_docdir}/%{name}/example-job.yaml
install -Dm644 example-batch.yaml %{buildroot}%{_docdir}/%{name}/example-batch.yaml

%pre
# Create system user for the daemon if it doesn't exist
getent group hyperexport >/dev/null || groupadd -r hyperexport
getent passwd hyperexport >/dev/null || \
    useradd -r -g hyperexport -d %{_sharedstatedir}/hyperexport \
    -s /sbin/nologin -c "hyperexport daemon user" hyperexport
exit 0

%post
%systemd_post hypervisord.service

# Set ownership
chown -R hyperexport:hyperexport %{_sharedstatedir}/hyperexport
chown -R hyperexport:hyperexport %{_localstatedir}/log/hyperexport

if [ $1 -eq 1 ]; then
    # First install
    echo "hyperexport-providers installed successfully!"
    echo "Edit /etc/hypervisord/config.yaml with your vCenter credentials"
    echo "Start the daemon: systemctl start hypervisord"
    echo "Enable auto-start: systemctl enable hypervisord"
fi

%preun
%systemd_preun hypervisord.service

%postun
%systemd_postun_with_restart hypervisord.service

if [ $1 -eq 0 ]; then
    # Uninstall
    userdel hyperexport 2>/dev/null || true
    groupdel hyperexport 2>/dev/null || true
fi

%files
%license LICENSE
%doc README.md GETTING-STARTED.md
%doc %{_docdir}/%{name}/example-job.yaml
%doc %{_docdir}/%{name}/example-batch.yaml
%{_bindir}/hyperexport
%{_bindir}/hypervisord
%{_bindir}/hyperctl
%{_unitdir}/hypervisord.service
%dir %{_sysconfdir}/hyperexport
%config(noreplace) %{_sysconfdir}/hyperexport/config.yaml
%attr(0755,hyperexport,hyperexport) %dir %{_sharedstatedir}/hyperexport
%attr(0755,hyperexport,hyperexport) %dir %{_localstatedir}/log/hyperexport

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
