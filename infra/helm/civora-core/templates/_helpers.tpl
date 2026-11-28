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

{{/* Identity settings shared by the application and the cleanup job (Phase 3). */}}
{{- define "civora-core.identityEnv" -}}
{{- with .Values.identity }}
{{- if .issuerCitizens }}
- name: OIDC_ISSUER_CITIZENS
  value: {{ .issuerCitizens | quote }}
{{- if .keycloakInternalUrl }}
- name: OIDC_JWKS_URL_CITIZENS
  value: {{ printf "%s/realms/%s/protocol/openid-connect/certs" .keycloakInternalUrl (base .issuerCitizens) | quote }}
{{- end }}
{{- end }}
{{- if .issuerStaff }}
- name: OIDC_ISSUER_STAFF
  value: {{ .issuerStaff | quote }}
{{- if .keycloakInternalUrl }}
- name: OIDC_JWKS_URL_STAFF
  value: {{ printf "%s/realms/%s/protocol/openid-connect/certs" .keycloakInternalUrl (base .issuerStaff) | quote }}
{{- end }}
{{- end }}
{{- if .keycloakInternalUrl }}
- name: KEYCLOAK_INTERNAL_URL
  value: {{ .keycloakInternalUrl | quote }}
{{- end }}
{{- if .provisionerSecret }}
- name: KEYCLOAK_PROVISIONER_SECRET_FILE
  value: /var/run/secrets/civora-keycloak/citizens
- name: KEYCLOAK_STAFF_PROVISIONER_SECRET_FILE
  value: /var/run/secrets/civora-keycloak/staff
{{- end }}
{{- if .activationRedirectUri }}
- name: ACTIVATION_REDIRECT_URI
  value: {{ .activationRedirectUri | quote }}
{{- end }}
{{- if .invitationRedirectUri }}
- name: STAFF_INVITATION_REDIRECT_URI
  value: {{ .invitationRedirectUri | quote }}
{{- end }}
{{- end }}
{{- end -}}

{{- define "civora-core.identityMount" -}}
{{- if .Values.identity.provisionerSecret }}
- { name: keycloak-provisioner, mountPath: /var/run/secrets/civora-keycloak, readOnly: true }
{{- end }}
{{- end -}}

{{- define "civora-core.identityVolume" -}}
{{- if .Values.identity.provisionerSecret }}
- name: keycloak-provisioner
  secret: { secretName: {{ .Values.identity.provisionerSecret }}, defaultMode: 0440 }
{{- end }}
{{- end -}}

{{/* Services directory (Phase 5): its database URL as a file, and the editors' institution. */}}
{{- define "civora-core.catalogueCheck" -}}
{{- with .Values.catalogue }}
{{- if .databaseSecret.name }}
{{- if not .migrations.databaseSecret.name }}
{{- fail "catalogue.migrations.databaseSecret.name is required with catalogue.databaseSecret.name (the public migrations run as the pg-public owner)" }}
{{- end }}
{{- if and (has $.Values.environment (list "staging" "pilot" "prod")) (not .editorTenant) }}
{{- fail (printf "catalogue.editorTenant is required when environment=%s (only the cell operator's staff edit the directory)" $.Values.environment) }}
{{- end }}
{{- end }}
{{- end }}
{{- end -}}

{{- define "civora-core.catalogueEnv" -}}
{{- if .Values.catalogue.databaseSecret.name }}
- name: CATALOGUE_DATABASE_URL_FILE
  value: /var/run/secrets/civora-catalogue/database-url
{{- if .Values.catalogue.editorTenant }}
- name: CATALOGUE_EDITOR_TENANT
  value: {{ .Values.catalogue.editorTenant | quote }}
{{- end }}
{{- end }}
{{- end -}}

{{- define "civora-core.catalogueMount" -}}
{{- if .Values.catalogue.databaseSecret.name }}
- { name: catalogue-db, mountPath: /var/run/secrets/civora-catalogue, readOnly: true }
{{- end }}
{{- end -}}

{{- define "civora-core.catalogueVolume" -}}
{{- if .Values.catalogue.databaseSecret.name }}
- name: catalogue-db
  secret:
    secretName: {{ .Values.catalogue.databaseSecret.name }}
    defaultMode: 0400
    items:
      - key: {{ .Values.catalogue.databaseSecret.key }}
        path: database-url
{{- end }}
{{- end -}}
