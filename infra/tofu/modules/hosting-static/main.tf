# Hosting adapter "static": nodes that already exist (customer premises, or a provider without an API).
# This is the only adapter that can be written before a hosting provider is selected (Phase 1 evidence E-07).
# Provider adapters (e.g. OpenStack or VMware, if the selected N-Cloud/G-Cloud provider exposes them) implement
# the same output contract: a list of {name, address, role, country, zone, site}.

variable "nodes" {
  type = list(object({
    name    = string
    address = string
    role    = string
    country = string
    zone    = string
    site    = optional(string, "main") # data centre; the second in-country site holds repository 2 (+ standby cluster)
  }))
  validation {
    condition     = alltrue([for n in var.nodes : contains(["server", "agent", "db", "backup", "backup_dr", "db_standby"], n.role)])
    error_message = "role must be server, agent, db, backup, backup_dr or db_standby."
  }
  validation {
    condition     = length(distinct([for n in var.nodes : n.name])) == length(var.nodes)
    error_message = "node names must be unique."
  }
}

output "nodes" {
  value = var.nodes
}
