{{- define "civora-core.name" -}}civora-core{{- end -}}

{{- define "civora-core.labels" -}}
app.kubernetes.io/name: civora-core
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/part-of: civora
app.kubernetes.io/managed-by: {{ .Release.Service }}
civora.io/country-pack: {{ .Values.countryPack }}
{{- end -}}

{{- define "civora-core.selector" -}}
app.kubernetes.io/name: civora-core
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "civora-core.image" -}}
{{- if .Values.image.digest -}}
{{ .Values.image.repository }}@{{ .Values.image.digest }}
{{- else -}}
{{ .Values.image.repository }}:{{ default .Chart.AppVersion .Values.image.tag }}
{{- end -}}
{{- end -}}

{{/* Restricted Pod Security Standard (ADR-013): non-root, read-only root FS, no privilege escalation, no capabilities. */}}
{{- define "civora-core.podSecurity" -}}
runAsNonRoot: true
runAsUser: 10001
runAsGroup: 10001
fsGroup: 10001
seccompProfile:
  type: RuntimeDefault
{{- end -}}

{{- define "civora-core.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end -}}

{{/* Signed images are deployed by digest outside dev (ADR-027). */}}
{{- define "civora-core.requireDigest" -}}
{{- if and (has .Values.environment (list "staging" "pilot" "prod")) (not .Values.image.digest) -}}
{{- fail (printf "image.digest is required when environment=%s (deploy signed images by digest, ADR-027)" .Values.environment) -}}
{{- end -}}
{{- end -}}

{{/* Accepted Checkov findings, with reasons (docs/phase-2/17-technical-validation-strategy.md §17.4). */}}
{{- define "civora-core.checkovSkips" -}}
checkov.io/skip1: CKV_K8S_11=No CPU limit by design (avoids CFS throttling); CPU requests and HPA bound usage
checkov.io/skip2: CKV_K8S_15=Images are deployed by immutable digest; IfNotPresent cannot run a different image
{{- end -}}

{{/* Database URL is mounted as a file from the Secret (not an environment variable). */}}
{{- define "civora-core.dbSecretVolume" -}}
- name: db-secret
  secret:
    secretName: {{ .Values.databaseSecret.name }}
    defaultMode: 0400
    items:
      - key: {{ .Values.databaseSecret.key }}
        path: database-url
{{- if .Values.databaseTls.caSecretName }}
- name: db-ca
  secret:
    secretName: {{ .Values.databaseTls.caSecretName }}
    items: [{ key: ca.crt, path: ca.crt }]
{{- end }}
{{- end -}}

{{/* Migration job: owner credentials when configured, otherwise the runtime secret (dev). */}}
{{- define "civora-core.migrateSecretVolume" -}}
- name: db-secret
  secret:
    secretName: {{ default .Values.databaseSecret.name .Values.migrations.databaseSecret.name }}
    defaultMode: 0400
    items:
      - key: {{ ternary .Values.migrations.databaseSecret.key .Values.databaseSecret.key (ne .Values.migrations.databaseSecret.name "") }}
        path: database-url
{{- if .Values.databaseTls.caSecretName }}
- name: db-ca
  secret:
    secretName: {{ .Values.databaseTls.caSecretName }}
    items: [{ key: ca.crt, path: ca.crt }]
{{- end }}
{{- end -}}

{{- define "civora-core.dbCaMount" -}}
{{- if .Values.databaseTls.caSecretName }}
- { name: db-ca, mountPath: /var/run/secrets/civora-db-ca, readOnly: true }
{{- end }}
{{- end -}}
