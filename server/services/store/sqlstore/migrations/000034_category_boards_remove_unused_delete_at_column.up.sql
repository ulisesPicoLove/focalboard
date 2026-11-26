{{if .postgres}}
    {{ dropColumnIfNeeded "category_boards" "delete_at" }}
{{end}}