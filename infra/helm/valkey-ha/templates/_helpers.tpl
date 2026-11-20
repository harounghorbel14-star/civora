{{- define "valkey-ha.labels" -}}
app.kubernetes.io/name: valkey-ha
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/part-of: civora
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
{{- define "valkey-ha.selector" -}}
app.kubernetes.io/name: valkey-ha
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
{{- define "valkey-ha.hosts" -}}
{{- $hosts := list -}}
{{- range $i := until (int .Values.replicas) -}}
{{- $hosts = append $hosts (printf "%s-%d.%s-headless.%s.svc.cluster.local" $.Release.Name $i $.Release.Name $.Release.Namespace) -}}
{{- end -}}
{{- join " " $hosts -}}
{{- end -}}
