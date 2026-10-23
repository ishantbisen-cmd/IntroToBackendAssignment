# MongoDB Advanced Assignment

This folder contains the MongoDB Advanced assignment deliverables. The script creates the fresh `company_advanced` database, performs Tasks 1–5 in order, and intentionally stops if that database already exists.

## Run Tasks 1–5

Start Docker Desktop and make sure the `mongo-basic-assignment` MongoDB container is running. From PowerShell in this folder:

```powershell
docker cp ".\mongodb-advanced-assignment.js" mongo-basic-assignment:/tmp/mongodb-advanced-assignment.js
docker exec mongo-basic-assignment mongosh --file /tmp/mongodb-advanced-assignment.js
```

The script verifies that the invalid employee is rejected with schema validation error 121 and prints the actual `explain("executionStats")` values for this MongoDB server and dataset.

## Run Task 6: backup and restore

After Tasks 1–5 complete successfully, run this once from PowerShell in this folder:

```powershell
.\backup-restore.ps1
```

The script creates a gzip archive named `company_advanced.archive`, saves a copy in this folder, and restores its collections into the new `company_advanced_restore` database. It refuses to restore if that target database already exists. It then prints the restored counts for employees, departments, and sessions.

## Connect and inspect

```powershell
docker exec -it mongo-basic-assignment mongosh
```

At the `mongosh` prompt:

```javascript
show dbs
use company_advanced
show collections
db.employees.countDocuments()
db.employees.getIndexes()
```

## Re-running against a fresh database

Both scripts protect existing data rather than dropping databases. Use a fresh MongoDB container or another unused database and update the database names in the scripts only if you need to repeat the assignment from the beginning.
