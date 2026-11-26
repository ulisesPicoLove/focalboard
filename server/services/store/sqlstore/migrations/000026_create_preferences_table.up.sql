CREATE TABLE IF NOT EXISTS {{.prefix}}preferences
(
    userid   VARCHAR(36) NOT NULL,
    category VARCHAR(32) NOT NULL,
    name     VARCHAR(32) NOT NULL,
    value    TEXT        NULL,
    PRIMARY KEY (userid, category, name)
);

{{- /* createIndexIfNeeded tableName columns */ -}}
{{ createIndexIfNeeded "preferences" "category" }}
{{ createIndexIfNeeded "preferences" "name" }}
