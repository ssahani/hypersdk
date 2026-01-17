// SPDX-License-Identifier: LGPL-3.0-or-later

package main

import (
	"testing"
)

// TestSanitizeFilename tests the filename sanitization function for security
func TestSanitizeFilename(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "valid_simple_filename",
			input:    "my-file.txt",
			expected: "my-file.txt",
		},
		{
			name:     "path_traversal_dot_dot_slash",
			input:    "../../../etc/passwd",
			expected: "etc-passwd", // Leading dashes trimmed
		},
		{
			name:     "path_traversal_backslash",
			input:    "..\\..\\windows\\system32",
			expected: "windows-system32", // Leading dashes trimmed
		},
		{
			name:     "forward_slash_separator",
			input:    "folder/file/name.txt",
			expected: "folder-file-name.txt",
		},
		{
			name:     "backslash_separator",
			input:    "folder\\file\\name.txt",
			expected: "folder-file-name.txt",
		},
		{
			name:     "null_byte_injection",
			input:    "file\x00malicious.txt",
			expected: "filemalicious.txt",
		},
		{
			name:     "special_characters",
			input:    "file:name*with?special<chars>|test.txt",
			expected: "file-name-with-special-chars--test.txt",
		},
		{
			name:     "spaces_in_filename",
			input:    "my file name.txt",
			expected: "my-file-name.txt",
		},
		{
			name:     "leading_dots_and_dashes",
			input:    "...---file.txt---...",
			expected: "file.txt",
		},
		{
			name:     "empty_after_sanitization",
			input:    "...---...",
			expected: "unnamed-vm",
		},
		{
			name:     "quotes_removed",
			input:    "my\"file\"name.txt",
			expected: "my-file-name.txt",
		},
		{
			name:     "mixed_dangerous_chars",
			input:    "../folder/file:name*test.ovf",
			expected: "folder-file-name-test.ovf", // Leading dashes trimmed
		},
		{
			name:     "windows_drive_letter",
			input:    "C:\\Windows\\System32\\file.txt",
			expected: "C--Windows-System32-file.txt",
		},
		{
			name:     "relative_path_current_dir",
			input:    "./file.txt",
			expected: "file.txt",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeFilename(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeFilename(%q) = %q, want %q", tt.input, result, tt.expected)
			}

			// Verify result doesn't contain dangerous characters
			if result != "" && result != "unnamed-vm" {
				validateSanitizedFilename(t, result)
			}
		})
	}
}

// TestSanitizeFilenameLength tests that very long filenames are truncated
func TestSanitizeFilenameLength(t *testing.T) {
	// Create a 300-character filename
	longName := ""
	for i := 0; i < 300; i++ {
		longName += "a"
	}

	result := sanitizeFilename(longName)
	if len(result) > 255 {
		t.Errorf("sanitizeFilename() produced name longer than 255 chars: %d", len(result))
	}
	if len(result) != 255 {
		t.Errorf("sanitizeFilename() should truncate to exactly 255 chars, got %d", len(result))
	}
}

// validateSanitizedFilename checks that a sanitized filename doesn't contain dangerous characters
func validateSanitizedFilename(t *testing.T, s string) {
	t.Helper()

	dangerousChars := []string{"/", "\\", "..", "\x00", ":", "*", "?", "\"", "<", ">", "|"}
	for _, char := range dangerousChars {
		if containsSubstring(s, char) {
			t.Errorf("Sanitized filename contains dangerous character %q: %q", char, s)
		}
	}

	// Ensure it doesn't start or end with dots or dashes
	if len(s) > 0 && (s[0] == '.' || s[0] == '-') {
		t.Errorf("Sanitized filename should not start with '.' or '-': %q", s)
	}
	if len(s) > 0 && (s[len(s)-1] == '.' || s[len(s)-1] == '-') {
		t.Errorf("Sanitized filename should not end with '.' or '-': %q", s)
	}
}

// containsSubstring checks if string contains a substring (helper for testing)
func containsSubstring(s, substr string) bool {
	if len(substr) > len(s) {
		return false
	}
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
