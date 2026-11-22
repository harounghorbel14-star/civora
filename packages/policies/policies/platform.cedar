// CIVORA platform rules (Workspace RF and Tier T0), from the O-A7 spike (spikes/policy-engine), unchanged. ADR-006.
@id("P1-handler-own-unit")
permit (
  principal is User,
  action in [Action::"case:read", Action::"case:update", Action::"case:readInternalNotes"],
  resource is Case
)
when {
  principal.roles.contains("case-handler") &&
  principal.tenant == resource.tenant &&
  principal.unit == resource.unit
};

// P2: a supervisor (complaint-unit head) acts on every case of their tenant.
@id("P2-supervisor-tenant")
permit (
  principal is User,
  action in [Action::"case:read", Action::"case:update", Action::"case:readInternalNotes", Action::"case:exportForMediator"],
  resource is Case
)
when { principal.roles.contains("supervisor") && principal.tenant == resource.tenant };

// P3: the BCT correspondent exports a case file for the banking mediator (FR-26; Circular 2022-08 Art. 13).
@id("P3-correspondent-export")
permit (principal is User, action == Action::"case:exportForMediator", resource is Case)
when { principal.roles.contains("correspondent") && principal.tenant == resource.tenant };

// P4: a customer reads the status of their own case only.
@id("P4-customer-own-status")
permit (principal is Customer, action == Action::"case:readStatus", resource is Case)
when { resource.customer == principal };

// P5: a tenant administrator changes rule-pack settings (e.g. category deadlines) with MFA.
@id("P5-admin-rulepack-mfa")
permit (principal is User, action == Action::"rulepack:configure", resource is RulePackActivation)
when { principal.roles.contains("tenant-admin") && principal.tenant == resource.tenant && context.mfa };

// P6: break-glass read by CIVORA operations: MFA and a written justification; always audited.
@id("P6-break-glass-read")
permit (principal is User, action == Action::"case:read", resource is Case)
when {
  principal.roles.contains("platform-operator") &&
  context.breakGlass && context.mfa && context.justification != ""
};

// F1: tenant isolation. Nothing crosses tenants except an audited break-glass read.
@id("F1-tenant-isolation")
forbid (principal is User, action, resource is Case)
when { principal.tenant != resource.tenant }
unless {
  action == Action::"case:read" &&
  principal.roles.contains("platform-operator") &&
  context.breakGlass && context.mfa && context.justification != ""
};

// F2: Tier T0 (special category: health) data only for the care purpose with recorded consent.
@id("F2-t0-purpose-consent")
forbid (principal, action, resource is Case)
when { resource.dataTier == 0 }
unless { context.purpose == "care" && context.consent };
