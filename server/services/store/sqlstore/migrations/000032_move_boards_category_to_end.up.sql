{{- /* To move Boards category to to the last value, we just need a relatively large value. */ -}}
{{- /* Assigning 10x total number of categories works perfectly. The sort_order is anyways updated */ -}}
{{- /* when the user manually DNDs a category. */ -}}

{{if or .postgres .sqlite}}
UPDATE {{.prefix}}categories SET sort_order = (10 * (SELECT COUNT(*) FROM {{.prefix}}categories)) WHERE lower(name) = 'boards';
{{end}}

