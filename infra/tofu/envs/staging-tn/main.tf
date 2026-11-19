# Staging cell, Tunisia. Addresses are RFC 5737 documentation addresses: placeholders until a hosting
# provider is contracted (E-07). Replace module "hosting" with the provider adapter when it exists.
terraform {
  required_version = ">= 1.8.0"
  # State backend: S3-compatible bucket inside the cell's country, encrypted, with locking.
  # Configured at init time (tofu init -backend-config=...) once the provider exists; never committed with credentials.
  # backend "s3" {}
}

module "hosting" {
  source = "../../modules/hosting-static"
  nodes = [
    { name = "tn-stg-s1", address = "192.0.2.11", role = "server", country = "TN", zone = "a" },
    { name = "tn-stg-s2", address = "192.0.2.12", role = "server", country = "TN", zone = "b" },
    { name = "tn-stg-s3", address = "192.0.2.13", role = "server", country = "TN", zone = "c" },
    { name = "tn-stg-a1", address = "192.0.2.21", role = "agent", country = "TN", zone = "a" },
    { name = "tn-stg-a2", address = "192.0.2.22", role = "agent", country = "TN", zone = "b" },
    { name = "tn-stg-db1", address = "192.0.2.31", role = "db", country = "TN", zone = "a" },
    { name = "tn-stg-db2", address = "192.0.2.32", role = "db", country = "TN", zone = "b" },
    { name = "tn-stg-bk1", address = "192.0.2.41", role = "backup", country = "TN", zone = "c" },
  ]
}

module "cell" {
  source = "../../modules/cell"
  cell = {
    id              = "tn-staging"
    country         = "TN"
    environment     = "staging"
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
