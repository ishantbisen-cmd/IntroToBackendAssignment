// Run with: docker exec mongo-basic-assignment mongosh --file /tmp/mongodb-advanced-assignment.js
// Use a fresh MongoDB instance: this script refuses to reuse company_advanced.

const adminDb = db.getSiblingDB("admin");
const companyDb = db.getSiblingDB("company_advanced");
const existingDatabase = adminDb.runCommand({
  listDatabases: 1,
  nameOnly: true,
  filter: { name: "company_advanced" }
});

if (!existingDatabase.ok) {
  throw new Error("Unable to verify whether company_advanced already exists.");
}

if (existingDatabase.databases.length > 0) {
  throw new Error(
    "company_advanced already exists. Use a fresh database before running this assignment."
  );
}

// Task 1: Create a collection with schema validation and insert the starting data.
companyDb.createCollection("employees", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "departmentId", "experience", "active"],
      properties: {
        name: { bsonType: "string" },
        departmentId: { bsonType: "int" },
        experience: { bsonType: "int" },
        active: { bsonType: "bool" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

companyDb.employees.insertMany([
  {
    _id: 1,
    name: "John",
    departmentId: 10,
    skills: ["Java", "MongoDB"],
    experience: 4,
    active: true,
    certifications: [
      { name: "MongoDB", status: "Expired", expiryYear: 2026 }
    ]
  },
  {
    _id: 2,
    name: "Alice",
    departmentId: 10,
    skills: ["Python", "MongoDB"],
    experience: 6,
    active: true,
    certifications: [
      { name: "MongoDB", status: "Active", expiryYear: 2028 }
    ]
  },
  {
    _id: 3,
    name: "David",
    departmentId: 20,
    skills: ["Communication"],
    experience: 3,
    active: false,
    certifications: [
      { name: "Communication", status: "Active", expiryYear: 2027 }
    ]
  }
]);

print("\nTask 1: Validated collection and initial employee count");
printjson(companyDb.getCollectionInfos({ name: "employees" }));
printjson({ validEmployeeCount: companyDb.employees.countDocuments({}) });

print("\nTask 1.4: Verify invalid document is rejected by schema validation");
let invalidDocumentRejected = false;
try {
  companyDb.employees.insertOne({
    _id: 99,
    name: 123,
    departmentId: "HR",
    experience: "one",
    active: "yes"
  });
} catch (error) {
  if (error.code !== 121) {
    throw error;
  }
  invalidDocumentRejected = true;
  print(`Invalid document rejected with schema validation error ${error.code}.`);
}

if (!invalidDocumentRejected) {
  throw new Error("The invalid employee document was unexpectedly accepted.");
}
printjson({
  validEmployeeCount: companyDb.employees.countDocuments({}),
  invalidDocumentRejected
});

// Task 2: Query and update certification array elements.
print("\nTask 2.1: Employee with an active MongoDB certification");
printjson(companyDb.employees.find({
  certifications: {
    $elemMatch: { name: "MongoDB", status: "Active" }
  }
}, { _id: 0, name: 1, certifications: 1 }).toArray());

print("\nTask 2.2: Activate John's MongoDB certification with the positional operator");
printjson(companyDb.employees.updateOne(
  {
    _id: 1,
    certifications: {
      $elemMatch: { name: "MongoDB", status: "Expired" }
    }
  },
  { $set: { "certifications.$.status": "Active" } }
));

print("\nTask 2.3: Mark certifications expiring before 2027 as Renewal Due");
printjson(companyDb.employees.updateMany(
  {},
  { $set: { "certifications.$[cert].status": "Renewal Due" } },
  { arrayFilters: [{ "cert.expiryYear": { $lt: 2027 } }] }
));
printjson(companyDb.employees.find(
  { "certifications.name": "MongoDB" },
  { _id: 0, name: 1, certifications: 1 }
).sort({ name: 1 }).toArray());

// Task 3: Perform all requested writes in one bulkWrite call.
print("\nTask 3: Increase John's experience, deactivate Alice, and insert Emma");
printjson(companyDb.employees.bulkWrite([
  {
    updateOne: {
      filter: { _id: 1 },
      update: { $inc: { experience: 1 } }
    }
  },
  {
    updateOne: {
      filter: { _id: 2 },
      update: { $set: { active: false } }
    }
  },
  {
    insertOne: {
      document: {
        _id: 4,
        name: "Emma",
        departmentId: 20,
        skills: ["Excel"],
        experience: 2,
        active: true,
        certifications: [
          { name: "Excel", status: "Active", expiryYear: 2026 }
        ]
      }
    }
  }
]));
printjson({
  john: companyDb.employees.findOne(
    { _id: 1 },
    { _id: 0, name: 1, experience: 1 }
  ),
  alice: companyDb.employees.findOne(
    { _id: 2 },
    { _id: 0, name: 1, active: 1 }
  ),
  employeeCount: companyDb.employees.countDocuments({})
});

// Task 4: Create departments and run the requested aggregation pipelines.
print("\nTask 4: Create departments");
companyDb.departments.insertMany([
  { _id: 10, name: "Engineering" },
  { _id: 20, name: "HR" }
]);

print("\nTask 4.1: Join employees to departments");
printjson(companyDb.employees.aggregate([
  {
    $lookup: {
      from: "departments",
      localField: "departmentId",
      foreignField: "_id",
      as: "department"
    }
  },
  { $unwind: "$department" },
  { $project: { _id: 0, name: 1, departmentName: "$department.name" } },
  { $sort: { name: 1 } }
]).toArray());

print("\nTask 4.2: Count employees for each skill");
printjson(companyDb.employees.aggregate([
  { $unwind: "$skills" },
  { $group: { _id: "$skills", employeeCount: { $sum: 1 } } },
  { $sort: { employeeCount: -1, _id: 1 } },
  { $project: { _id: 0, skill: "$_id", employeeCount: 1 } }
]).toArray());

print("\nTask 4.3: Active employee names and count using $facet");
printjson(companyDb.employees.aggregate([
  {
    $facet: {
      activeEmployees: [
        { $match: { active: true } },
        { $sort: { name: 1 } },
        { $project: { _id: 0, name: 1 } }
      ],
      activeEmployeeCount: [
        { $match: { active: true } },
        { $count: "count" }
      ]
    }
  }
]).toArray());

// Task 5: Create the compound index, inspect query execution, and create a TTL index.
print("\nTask 5.1: Create and verify the compound index");
printjson(companyDb.employees.createIndex({ departmentId: 1, name: 1 }));
printjson(companyDb.employees.getIndexes());

print("\nTask 5.2: Explain the departmentId query sorted by name");
const queryExplain = companyDb.employees.find(
  { departmentId: 10 }
).sort({ name: 1 }).explain("executionStats");

function findAccessStage(plan) {
  if (!plan || typeof plan !== "object") {
    return null;
  }
  if (plan.stage === "COLLSCAN" || plan.stage === "IXSCAN") {
    return plan.stage;
  }
  const children = [
    plan.inputStage,
    ...(plan.inputStages || []),
    ...(plan.shards || []).map(shard => shard.winningPlan),
    ...(plan.children || [])
  ];
  for (const child of children) {
    const stage = findAccessStage(child);
    if (stage) {
      return stage;
    }
  }
  return null;
}

const winningAccessStage = findAccessStage(queryExplain.queryPlanner.winningPlan);
printjson({
  winningAccessStage,
  nReturned: queryExplain.executionStats.nReturned,
  totalDocsExamined: queryExplain.executionStats.totalDocsExamined,
  totalKeysExamined: queryExplain.executionStats.totalKeysExamined,
  winningPlan: queryExplain.queryPlanner.winningPlan
});

print("\nTask 5.3: Create a session and zero-delay TTL index");
companyDb.sessions.insertOne({
  _id: 1,
  userName: "John",
  expiresAt: new Date(Date.now() + 600000)
});
printjson(companyDb.sessions.createIndex(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
));
printjson(companyDb.sessions.getIndexes());
