$ErrorActionPreference = "Stop"

$container = "mongo-basic-assignment"
$archiveName = "company_advanced.archive"
$archivePath = Join-Path $PSScriptRoot $archiveName

$containerState = docker inspect --format '{{.State.Running}}' $container
if ($LASTEXITCODE -ne 0 -or $containerState.Trim() -ne "true") {
  throw "Docker container '$container' must be running."
}

$restoreDatabaseExists = docker exec $container mongosh --quiet --eval "print(db.getSiblingDB('admin').runCommand({listDatabases:1,nameOnly:true,filter:{name:'company_advanced_restore'}}).databases.length > 0)"
if ($LASTEXITCODE -ne 0) {
  throw "Unable to check whether company_advanced_restore already exists."
}
if ($restoreDatabaseExists.Trim() -eq "true") {
  throw "company_advanced_restore already exists. Use a fresh restore target; this script will not overwrite it."
}

Write-Output "Creating gzip archive of company_advanced..."
docker exec $container mongodump --db company_advanced --archive="/tmp/$archiveName" --gzip
if ($LASTEXITCODE -ne 0) {
  throw "mongodump failed."
}

docker cp "${container}:/tmp/$archiveName" $archivePath
if ($LASTEXITCODE -ne 0) {
  throw "Unable to copy the archive to the assignment folder."
}

Write-Output "Restoring archive into company_advanced_restore..."
docker exec $container mongorestore `
  --archive="/tmp/$archiveName" `
  --gzip `
  --nsFrom="company_advanced.*" `
  --nsTo="company_advanced_restore.*"
if ($LASTEXITCODE -ne 0) {
  throw "mongorestore failed."
}

$countsJson = docker exec $container mongosh --quiet --eval "const d=db.getSiblingDB('company_advanced_restore'); print(JSON.stringify({employees:d.employees.countDocuments({}),departments:d.departments.countDocuments({}),sessions:d.sessions.countDocuments({})}))"
if ($LASTEXITCODE -ne 0) {
  throw "Unable to verify restored collection counts."
}
$counts = $countsJson | ConvertFrom-Json

Write-Output "Restored collection counts:"
$counts | Format-List
Write-Output "Gzip archive saved to: $archivePath"
