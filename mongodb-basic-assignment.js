// Run with: mongosh "mongodb://localhost:27017" mongodb-basic-assignment.js
// This script intentionally refuses to reuse an existing company database.

const companyDb = db.getSiblingDB("company");
const adminDb = db.getSiblingDB("admin");
const existingCompany = adminDb.runCommand({
  listDatabases: 1,
  nameOnly: true,
  filter: { name: "company" }
});

if (!existingCompany.ok) {
  throw new Error("Unable to verify whether the company database already exists.");
}

if (existingCompany.databases.length > 0) {
  throw new Error(
    "The company database already exists. Use a fresh local company database before running this assignment."
  );
}

// Task 1: Create the employees collection and insert the fresh dataset.
companyDb.employees.insertMany([
  {
    _id: "EMP001",
    name: "John",
    department: "Engineering",
    experience: 4,
    skills: ["Java", "Spring Boot"],
    active: true,
    address: { city: "Pune", country: "India" }
  },
  {
    _id: "EMP002",
    name: "Alice",
    department: "HR",
    experience: 3,
    skills: ["Recruitment", "Communication"],
    active: true,
    address: { city: "Mumbai", country: "India" }
  },
  {
    _id: "EMP003",
    name: "David",
    department: "Engineering",
    experience: 6,
    skills: ["Java", "MongoDB"],
    active: true,
    address: { city: "Bengaluru", country: "India" }
  },
  {
    _id: "EMP004",
    name: "Emma",
    department: "Finance",
    experience: 2,
    skills: ["Accounting", "Excel"],
    active: false,
    address: { city: "Pune", country: "India" }
  },
  {
    _id: "EMP005",
    name: "Robert",
    department: "Engineering",
    experience: 5,
    skills: ["Java", "Docker"],
    active: true,
    address: { city: "Delhi", country: "India" }
  }
]);

print("\nTask 1: database, collection, and document count");
printjson(adminDb.runCommand({
  listDatabases: 1,
  nameOnly: true,
  filter: { name: "company" }
}));
printjson(companyDb.getCollectionNames());
printjson({ employeeCount: companyDb.employees.countDocuments({}) });

// Task 2: Read and query operations.
print("\nTask 2.1: Engineering employees");
printjson(companyDb.employees.find(
  { department: "Engineering" },
  { _id: 1, name: 1, experience: 1 }
).sort({ name: 1 }).toArray());

print("\nTask 2.2: Employees with at least five years of experience");
printjson(companyDb.employees.find(
  { experience: { $gte: 5 } },
  { _id: 0, name: 1, experience: 1 }
).sort({ experience: -1 }).toArray());

print("\nTask 2.3: Employees in Pune");
printjson(companyDb.employees.find(
  { "address.city": "Pune" },
  { _id: 0, name: 1, "address.city": 1 }
).sort({ name: 1 }).map(employee => ({
  name: employee.name,
  city: employee.address.city
})).toArray());

print("\nTask 2.4: Employees with MongoDB or Spring Boot skills");
printjson(companyDb.employees.find(
  { skills: { $in: ["MongoDB", "Spring Boot"] } },
  { _id: 0, name: 1 }
).sort({ name: 1 }).toArray());

print("\nTask 2.5: Two employees with the most experience");
printjson(companyDb.employees.find(
  {},
  { _id: 0, name: 1, experience: 1 }
).sort({ experience: -1 }).limit(2).toArray());

// Task 3: Update operations.
print("\nTask 3.1: Increase Alice's experience");
printjson(companyDb.employees.updateOne(
  { _id: "EMP002" },
  { $inc: { experience: 1 } }
));
printjson(companyDb.employees.findOne(
  { _id: "EMP002" },
  { _id: 0, name: 1, experience: 1 }
));

print("\nTask 3.2: Set Emma to active");
printjson(companyDb.employees.updateOne(
  { _id: "EMP004" },
  { $set: { active: true } }
));
printjson(companyDb.employees.findOne(
  { _id: "EMP004" },
  { _id: 0, name: 1, active: 1 }
));

print("\nTask 3.3: Add MongoDB to Robert's skills twice using $addToSet");
printjson(companyDb.employees.updateOne(
  { _id: "EMP005" },
  { $addToSet: { skills: "MongoDB" } }
));
printjson(companyDb.employees.updateOne(
  { _id: "EMP005" },
  { $addToSet: { skills: "MongoDB" } }
));
printjson(companyDb.employees.findOne(
  { _id: "EMP005" },
  { _id: 0, name: 1, skills: 1 }
));

// Task 4: Insert and remove only the temporary employee.
print("\nTask 4: Insert and delete the temporary employee");
companyDb.employees.insertOne({
  _id: "EMP999",
  name: "Temporary Employee",
  department: "Training",
  experience: 0
});
printjson(companyDb.employees.deleteOne({ _id: "EMP999" }));
printjson({ temporaryEmployeeAfterDelete: companyDb.employees.findOne({ _id: "EMP999" }) });
printjson({ employeeCountAfterDelete: companyDb.employees.countDocuments({}) });

// Task 5: Inspect existing indexes, then create and verify the department index.
print("\nTask 5.1: Indexes before creating the department index");
printjson(companyDb.employees.getIndexes());

print("\nTask 5.2: Create ascending index on department");
printjson(companyDb.employees.createIndex({ department: 1 }));

print("\nTask 5.3: Indexes after creating the department index");
printjson(companyDb.employees.getIndexes());

// Task 6: Aggregation pipelines use the updated employee documents.
print("\nTask 6.1: Employee count per department");
printjson(companyDb.employees.aggregate([
  { $group: { _id: "$department", employeeCount: { $sum: 1 } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, department: "$_id", employeeCount: 1 } }
]).toArray());

print("\nTask 6.2: Average experience per department");
printjson(companyDb.employees.aggregate([
  { $group: { _id: "$department", averageExperience: { $avg: "$experience" } } },
  { $sort: { _id: 1 } },
  { $project: { _id: 0, department: "$_id", averageExperience: 1 } }
]).toArray());

print("\nTask 6.3: Top two Engineering employees by experience");
printjson(companyDb.employees.aggregate([
  { $match: { department: "Engineering" } },
  { $project: { _id: 0, name: 1, experience: 1 } },
  { $sort: { experience: -1 } },
  { $limit: 2 }
]).toArray());
