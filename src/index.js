const AWS = require("aws-sdk");
const { Connection, DuckDB } = require("node-duckdb");
const { getCreateTableFromJSON, getInsertsFromJSON } = require("./lib/sql-helpers");
const { getBoilingApps } = require("./lib/boiling-apps");

const appLib = require("../app.awssdk.json");

async function createTableWithDataFromJSON(connection, rows, tableName) {
  let allStmts = "";
  const createTableStmt = getCreateTableFromJSON(rows, tableName);
  const insertStmts = getInsertsFromJSON(rows, tableName);

  allStmts += createTableStmt;
  await connection.executeIterator(createTableStmt);
  await Promise.all(
    insertStmts.map(async (stmt) => {
      allStmts += "\n" + stmt;
      await connection.executeIterator(stmt);
    })
  );
  return allStmts;
}

async function main() {
  const duckdb = new DuckDB();
  const duckDbConn = new Connection(duckdb);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM apps.awssdk('S3','listObjectsV2','{"Bucket":"boilingdata-demo","Delimiter":"/"}','.Contents') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps = getBoilingApps(sql, appLib);
  console.log(boilingApps);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM apps.awssdk.demoBucketRootListing WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps2 = getBoilingApps(sql, appLib);
  console.log(boilingApps2);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM apps.awssdk.demoBucketRecursiveListing WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps3 = getBoilingApps(sql, appLib);
  console.log(boilingApps3);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM apps.awssdk.bucketRecursiveListing('boilingdata-demo') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps4 = getBoilingApps(sql, appLib);
  console.log(boilingApps4);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM awssdk.bucketRecursiveListing('boilingdata-demo') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps5 = getBoilingApps(sql, appLib);
  console.log(boilingApps5);

  console.log("----------------------------------------------");
  sql = `SELECT "key", "size" FROM awssdk.bucketRecursiveListingWithDelimiter('boilingdata-demo','/') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps6 = getBoilingApps(sql, appLib);
  console.log(boilingApps6);

  await Promise.all(
    boilingApps5.apps.map(async (app) => {
      console.log(app);
      const func = new Function("return " + app.functionString)();
      const appResp = await func({ AWS, region: "eu-west-1" });
      const pushRespToDuckDB = await createTableWithDataFromJSON(duckDbConn, appResp, app.tablename);
      console.log(pushRespToDuckDB + "\n");
      await duckDbConn.executeIterator(pushRespToDuckDB);
    })
  );
  console.log(sql);
  console.log(boilingApps5.deparsed);
  console.log((await duckDbConn.executeIterator(boilingApps5.deparsed)).fetchAllRows());

  await Promise.all(
    boilingApps6.apps.map(async (app) => {
      console.log(app);
      const func = new Function("return " + app.functionString)();
      const appResp = await func({ AWS, region: "eu-west-1" });
      const pushRespToDuckDB = await createTableWithDataFromJSON(duckDbConn, appResp, app.tablename);
      console.log(pushRespToDuckDB + "\n");
      await duckDbConn.executeIterator(pushRespToDuckDB);
    })
  );
  console.log(sql);
  console.log(boilingApps6.deparsed);
  console.log((await duckDbConn.executeIterator(boilingApps6.deparsed)).fetchAllRows());

  duckDbConn.close();
  duckdb.close();
}

main();
