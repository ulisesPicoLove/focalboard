{{if .mysql}}
DROP INDEX idx_sessions_token ON {{.prefix}}sessions;
{{else}}
DROP INDEX idx_sessions_token;
{{end}}
