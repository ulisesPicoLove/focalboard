{{- /* Every authenticated request looks the session up by token. */ -}}
{{ createIndexIfNeeded "sessions" "token" }}
