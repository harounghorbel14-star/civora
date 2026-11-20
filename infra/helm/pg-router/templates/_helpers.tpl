{{- define "pg-router.labels" -}}
app.kubernetes.io/name: pg-router
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: civora
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
{{- define "pg-router.selector" -}}
app.kubernetes.io/name: pg-router
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
