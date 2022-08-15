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

  sql = `SELECT "key", "size" FROM apps.awssdk('S3','listObjectsV2','{"Bucket":"boilingdata-demo","Delimiter":"/"}','.Contents') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const boilingApps = getBoilingApps(sql, appLib);

  await Promise.all(
    boilingApps.apps.map(async (app) => {
      console.log(app);
      const func = new Function("return " + app.functionString)();
      const appResp = await func({ AWS, region: "eu-west-1" });
      const pushRespToDuckDB = await createTableWithDataFromJSON(duckDbConn, appResp, app.tablename);
      console.log(pushRespToDuckDB + "\n");
      await duckDbConn.executeIterator(pushRespToDuckDB);
    })
  );

  console.log(sql);
  console.log((await duckDbConn.executeIterator(boilingApps.deparsed)).fetchAllRows());

  duckDbConn.close();
  duckdb.close();
}

main();
