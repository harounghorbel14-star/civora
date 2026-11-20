# Pilot cell, Tunisia: the recommended topology for regulated tenants (financial institutions; health and government
# data later), pending the founder's decisions (ADR-003 three servers, ADR-029 second site) and a provider (E-07).
# Addresses are RFC 5737 documentation addresses until the provider hands over its VMs. Nothing here is applied.
#   main site   : 3 Kubernetes servers + 2 agents, 3 database servers (automatic failover, nothing acknowledged lost),
#                 backup repository 1 in another zone
#   second site : backup repository 2 + a 2-server STANDBY CLUSTER streaming from the main site (runbook §8.1)
terraform {
  required_version = ">= 1.8.0"
  # backend "s3" {}   # in-country S3-compatible bucket, configured at init time (never committed with credentials)
}

module "hosting" {
  source = "../../modules/hosting-static"
  nodes = [
    { name = "tn-pil-s1", address = "198.51.100.11", role = "server", country = "TN", zone = "a" },
    { name = "tn-pil-s2", address = "198.51.100.12", role = "server", country = "TN", zone = "b" },
    { name = "tn-pil-s3", address = "198.51.100.13", role = "server", country = "TN", zone = "c" },
    { name = "tn-pil-a1", address = "198.51.100.21", role = "agent", country = "TN", zone = "a" },
    { name = "tn-pil-a2", address = "198.51.100.22", role = "agent", country = "TN", zone = "b" },
    { name = "tn-pil-db1", address = "198.51.100.31", role = "db", country = "TN", zone = "a" },
    { name = "tn-pil-db2", address = "198.51.100.32", role = "db", country = "TN", zone = "b" },
    { name = "tn-pil-db3", address = "198.51.100.33", role = "db", country = "TN", zone = "c" },
    { name = "tn-pil-bk1", address = "198.51.100.41", role = "backup", country = "TN", zone = "d" },
    { name = "tn-pil-bk2", address = "203.0.113.51", role = "backup_dr", country = "TN", zone = "a", site = "second" },
    { name = "tn-pil-sb1", address = "203.0.113.61", role = "db_standby", country = "TN", zone = "a", site = "second" },
    { name = "tn-pil-sb2", address = "203.0.113.62", role = "db_standby", country = "TN", zone = "b", site = "second" },
  ]
}

module "cell" {
  source = "../../modules/cell"
  cell = {
    id              = "tn-pilot"
    country         = "TN"
    environment     = "pilot"
    deployment_tier = "shared"
  }
  nodes = module.hosting.nodes
}

output "ansible_inventory" {
  value = module.cell.ansible_inventory
}

output "summary" {
  value = module.cell.summary
}
