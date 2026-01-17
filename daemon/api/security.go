// SPDX-License-Identifier: LGPL-3.0-or-later

package api

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// ValidateWebhookURL validates a webhook URL and checks for SSRF vulnerabilities
func ValidateWebhookURL(webhookURL string, blockPrivateIPs bool) error {
	// Parse URL
	parsedURL, err := url.Parse(webhookURL)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}

	// Check scheme
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("invalid URL scheme: %s (must be http or https)", parsedURL.Scheme)
	}

	// Get hostname
	hostname := parsedURL.Hostname()
	if hostname == "" {
		return fmt.Errorf("missing hostname in URL")
	}

	// If blocking private IPs, validate hostname
	if blockPrivateIPs {
		// Resolve hostname to IP addresses
		ips, err := net.LookupIP(hostname)
		if err != nil {
			return fmt.Errorf("failed to resolve hostname: %w", err)
		}

		// Check each resolved IP
		for _, ip := range ips {
			if isPrivateIP(ip) {
				return fmt.Errorf("webhook URL resolves to private IP address: %s", ip.String())
			}
		}
	}

	return nil
}

// isPrivateIP checks if an IP address is in a private range
func isPrivateIP(ip net.IP) bool {
	// Private IPv4 ranges
	privateRanges := []string{
		"10.0.0.0/8",       // Class A private network
		"172.16.0.0/12",    // Class B private networks
		"192.168.0.0/16",   // Class C private networks
		"127.0.0.0/8",      // Loopback
		"169.254.0.0/16",   // Link-local
		"224.0.0.0/4",      // Multicast
		"240.0.0.0/4",      // Reserved
		"0.0.0.0/8",        // This network
		"::1/128",          // IPv6 loopback
		"fe80::/10",        // IPv6 link-local
		"fc00::/7",         // IPv6 unique local addresses
	}

	for _, cidr := range privateRanges {
		_, ipNet, err := net.ParseCIDR(cidr)
		if err != nil {
			continue
		}
		if ipNet.Contains(ip) {
			return true
		}
	}

	return false
}

// SanitizeErrorMessage removes sensitive information from error messages
func SanitizeErrorMessage(err error) string {
	if err == nil {
		return ""
	}

	msg := err.Error()

	// Remove file paths
	if strings.Contains(msg, "/") {
		parts := strings.Split(msg, ":")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}

	// Generic database errors
	if strings.Contains(strings.ToLower(msg), "sql") ||
		strings.Contains(strings.ToLower(msg), "database") {
		return "database error occurred"
	}

	// Generic file system errors
	if strings.Contains(strings.ToLower(msg), "permission denied") {
		return "permission error"
	}

	return "an error occurred"
}
