# Same rules as civora.cedar, written in Rego (OPA 1.x). Input carries the entity attributes inline
# because OPA has no entity store: {principal:{type,id,tenant,roles,unit}, action, resource:{...}, context:{...}}.
package civora.authz

default allow := false

allow if {
	permit
	not forbid
}

handler_actions := {"case:read", "case:update", "case:readInternalNotes"}

supervisor_actions := {"case:read", "case:update", "case:readInternalNotes", "case:exportForMediator"}

same_tenant if input.principal.tenant == input.resource.tenant

break_glass_read if {
	input.action == "case:read"
	"platform-operator" in input.principal.roles
	input.context.breakGlass
	input.context.mfa
	input.context.justification != ""
}

# P1
permit if {
	input.principal.type == "User"
	input.resource.type == "Case"
	input.action in handler_actions
	"case-handler" in input.principal.roles
	same_tenant
	input.principal.unit == input.resource.unit
}

# P2
permit if {
	input.principal.type == "User"
	input.resource.type == "Case"
	input.action in supervisor_actions
	"supervisor" in input.principal.roles
	same_tenant
}

# P3
permit if {
	input.principal.type == "User"
	input.resource.type == "Case"
	input.action == "case:exportForMediator"
	"correspondent" in input.principal.roles
	same_tenant
}

# P4
permit if {
	input.principal.type == "Customer"
	input.resource.type == "Case"
	input.action == "case:readStatus"
	input.resource.customer == input.principal.id
}

# P5
permit if {
	input.principal.type == "User"
	input.resource.type == "RulePackActivation"
	input.action == "rulepack:configure"
	"tenant-admin" in input.principal.roles
	same_tenant
	input.context.mfa
}

# P6
permit if {
	input.principal.type == "User"
	input.resource.type == "Case"
	break_glass_read
}

# F1
forbid if {
	input.principal.type == "User"
	input.resource.type == "Case"
	not same_tenant
	not break_glass_read
}

# F2
forbid if {
	input.resource.type == "Case"
	input.resource.dataTier >= 3
	not care_with_consent
}

care_with_consent if {
	input.context.purpose == "care"
	input.context.consent
}
