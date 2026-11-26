UPDATE {{.prefix}}blocks SET created_by = 'system' where created_by IS NULL;
UPDATE {{.prefix}}blocks SET modified_by = 'system' where modified_by IS NULL;



{{if .postgres}}
ALTER TABLE {{.prefix}}blocks ALTER COLUMN created_by set NOT NULL;
ALTER TABLE {{.prefix}}blocks ALTER COLUMN modified_by set NOT NULL;
{{end}}
