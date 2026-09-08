resource "random_password" "db_tenant" {
  length  = 32
  special = false
}

resource "postgresql_role" "tenant" {
  count = var.apply_tenant_database_resources ? 1 : 0

  name     = local.tenant_database_name
  login    = true
  password = random_password.db_tenant.result
}

resource "postgresql_database" "tenant" {
  count = var.apply_tenant_database_resources ? 1 : 0

  name  = local.tenant_database_name
  owner = postgresql_role.tenant[0].name
}

resource "postgresql_grant" "tenant_database" {
  count = var.apply_tenant_database_resources ? 1 : 0

  database    = postgresql_database.tenant[0].name
  role        = postgresql_role.tenant[0].name
  object_type = "database"
  privileges  = ["ALL"]
}
