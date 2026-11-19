# Country cell definition (ADR-004, ADR-013, ADR-019). Provider-agnostic: it takes the nodes produced by a
# hosting adapter and turns them into the Ansible inventory and the cell facts used by Helm/Argo CD.
# It deliberately has no provider dependency, so it validates offline.

variable "cell" {
  description = "Cell identity. One country pack per cell; personal data never leaves the cell's country."
  type = object({
    id              = string # e.g. "tn-staging"
    country         = string # ISO 3166-1 alpha-2
    environment     = string # dev | staging | pilot | prod
    deployment_tier = string # shared | dedicated-db | dedicated-cell | customer-hosted (ADR-019)
  })
  validation {
    condition     = contains(["dev", "staging", "pilot", "prod"], var.cell.environment)
    error_message = "environment must be dev, staging, pilot or prod."
  }
  validation {
    condition     = contains(["shared", "dedicated-db", "dedicated-cell", "customer-hosted"], var.cell.deployment_tier)
    error_message = "deployment_tier must be one of the ADR-019 tiers."
  }
}

variable "nodes" {
  description = "Nodes from the hosting adapter."
  type = list(object({
    name    = string
    address = string
    role    = string # server | agent | db | backup
    country = string # where the node physically runs
    zone    = string
  }))
}

locals {
  servers = [for n in var.nodes : n if n.role == "server"]
  agents  = [for n in var.nodes : n if n.role == "agent"]
  db      = [for n in var.nodes : n if n.role == "db"]
  backup  = [for n in var.nodes : n if n.role == "backup"]
}

output "ansible_inventory" {
  description = "Ansible inventory (YAML) for infra/ansible/site.yml."
  # Hard guards: a failed precondition stops plan/apply (check blocks would only warn).
  precondition {
    # Data residency (D9; Law 2004-63 Art. 50-52): every node of a cell runs in the cell's country.
    condition     = alltrue([for n in var.nodes : n.country == var.cell.country])
    error_message = "A node is outside the cell's country. Personal data may not be processed abroad (D9)."
  }
  precondition {
    condition     = var.cell.environment == "dev" || (length(local.servers) % 2 == 1 && length(local.servers) >= 3)
    error_message = "Non-dev cells need an odd number (>= 3) of Kubernetes server nodes."
  }
  precondition {
    condition     = var.cell.environment == "dev" || (length(local.backup) >= 1 && length(setintersection(toset([for n in local.backup : n.zone]), toset([for n in local.db : n.zone]))) == 0)
    error_message = "Non-dev cells need a backup node in a zone different from every database node (ADR-029)."
  }
  value = yamlencode({
    all = {
      vars = {
        civora_cell_id     = var.cell.id
        civora_country     = var.cell.country
        civora_environment = var.cell.environment
      }
      children = {
        k8s_servers = { hosts = { for n in local.servers : n.name => { ansible_host = n.address, zone = n.zone } } }
        k8s_agents  = { hosts = { for n in local.agents : n.name => { ansible_host = n.address, zone = n.zone } } }
        db_nodes    = { hosts = { for n in local.db : n.name => { ansible_host = n.address, zone = n.zone } } }
        backup      = { hosts = { for n in local.backup : n.name => { ansible_host = n.address, zone = n.zone } } }
      }
    }
  })
}

output "summary" {
  value = {
    cell     = var.cell.id
    servers  = length(local.servers)
    agents   = length(local.agents)
    db_nodes = length(local.db)
    backup   = length(local.backup)
  }
}
