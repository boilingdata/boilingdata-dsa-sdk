const AWS = require("aws-sdk");
const { Connection, DuckDB } = require("node-duckdb");
const { getCreateTableFromJSON, getInsertsFromJSON, getDataSourceAppsFromSQL } = require("./lib/sql-helpers");
const { getDSAsForApps, renderDSAFuncTemplates } = require("./lib/dsa");

const dsaLib = require("../dsa.awssdk.json");

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

  sql = `SELECT "key", "size" FROM dsa.awssdk('S3','listObjectsV2','{"Bucket":"boilingdata-demo","Delimiter":"/"}','.Contents') WHERE "key" LIKE '%.parquet' ORDER BY "key";`;
  const apps = getDataSourceAppsFromSQL(sql);
  const DSAs = getDSAsForApps(apps, dsaLib);
  const renderedDSAs = renderDSAFuncTemplates(DSAs);

  await Promise.all(
    renderedDSAs.dsas.map(async (dsa) => {
      const func = new Function("return " + dsa.functionString)();
      const appResp = await func({ AWS, region: "eu-west-1" });
      const pushRespToDuckDB = await createTableWithDataFromJSON(duckDbConn, appResp, dsa.tablename);
      await duckDbConn.executeIterator(pushRespToDuckDB);
    })
  );

  console.log(sql);
  console.log((await duckDbConn.executeIterator(renderedDSAs.deparsed)).fetchAllRows());

  duckDbConn.close();
  duckdb.close();
}

main();
