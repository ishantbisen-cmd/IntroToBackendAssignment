# MongoDB Advanced Assignment

This folder contains the MongoDB Advanced assignment deliverables. The script creates the fresh `company_advanced` database, performs Tasks 1–5 in order, and intentionally stops if that database already exists.

## Run Tasks 1–5

Start Docker Desktop and make sure the `mongo-basic-assignment` MongoDB container is running. From PowerShell in this folder:

```powershell
docker cp ".\mongodb-advanced-assignment.js" mongo-basic-assignment:/tmp/mongodb-advanced-assignment.js
docker exec mongo-basic-assignment mongosh --file /tmp/mongodb-advanced-assignment.js
```

The script verifies that the invalid employee is rejected with schema validation error 121 and prints the actual `explain("executionStats")` values for this MongoDB server and dataset.

## Task 6: backup and restore

Task 6 was completed locally with `mongodump` and `mongorestore`. The gzip archive was restored into the separate `company_advanced_restore` database and its collection counts were verified. Backup/restore scripts and archive files are intentionally kept out of this GitHub submission.

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

The task script refuses to reuse an existing `company_advanced` database. Use a fresh MongoDB container or another unused database if you need to repeat Tasks 1–5.
