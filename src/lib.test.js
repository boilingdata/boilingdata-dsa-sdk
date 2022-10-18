const AWS = require("aws-sdk");
const { Connection, DuckDB } = require("node-duckdb");
const { createTableWithDataFromJSON } = require("./lib/sql-helpers");
const { getBoilingApps, renderBoilingApps } = require("./lib/boiling-apps");

const appLib = [require("../app.awssdk.json")];

const testQueries = [
  `SELECT "key", size FROM apps.awssdk('S3','listObjectsV2','{"Bucket":"boilingdata-demo","Delimiter":"/"}','.Contents') WHERE "key" LIKE '%.parquet' ORDER BY "key";`,
  `SELECT "key", "size" FROM apps.awssdk.demoBucketRootListing WHERE "key" LIKE '%.parquet' ORDER BY "key";`,
  `SELECT key, "size" FROM apps.awssdk.demoBucketRecursiveListing WHERE "key" LIKE '%.parquet' ORDER BY "key";`,
  `SELECT "key", "size" FROM apps.awssdk.bucketRecursiveListing('boilingdata-demo') WHERE "key" LIKE '%.parquet' ORDER BY "key";`,
  `SELECT "key", "size" FROM apps.awssdk.bucketRecursiveListingWithDelimiter('boilingdata-demo','/') WHERE "key" LIKE '%.parquet' ORDER BY "key";`,
  `SELECT t.key, t.size FROM apps.awssdk.demoBucketRootListing AS t WHERE "key" LIKE '%.parquet' ORDER BY key;`,
  `SELECT k.key, k.size FROM apps.awssdk.bucketRecursiveListingWithDelimiter('boilingdata-demo','/') AS k ORDER BY k.key;`,
  `SELECT t.key, t.size, k.key, k.size FROM apps.awssdk.demoBucketRootListing AS t, apps.awssdk.bucketRecursiveListingWithDelimiter('boilingdata-demo','/') AS k;`,
  `SELECT * FROM apps.awssdk.bucketRecursiveListingWithDelimiter('boilingdata-demo','/');`,
  `SELECT * FROM apps.awssdk('Glue','getTables','{"DatabaseName":"default"}','.TableList') ORDER BY name;`,
  `SELECT * FROM apps.awssdk.gluePartitions('default', 'nyctaxis') ORDER BY values;`,
];

const duckdb = new DuckDB();
const duckDbConn = new Connection(duckdb);
const S3 = new AWS.S3({ region: "eu-west-1" });
const Glue = new AWS.Glue({ region: "eu-west-1" });
const Lambda = new AWS.Lambda({ region: "eu-west-1" });

describe("dsa-lib", () => {
  afterAll(() => {
    duckDbConn.close();
    duckdb.close();
  });

  it("parsing", () => {
    const apps = [];
    testQueries.forEach((sql) => apps.push(getBoilingApps(sql, appLib)));
    expect(apps).toMatchSnapshot();
  });

  it("rendering", () => {
    expect(
      renderBoilingApps([
        {
          funcTemplate: appLib[0].funcTemplate,
          parameters: {
            service: "S3",
            apicall: "listsBuckets",
            params: '{"Bucket":"boilingdata-demo"}',
            resultPath: ".Buckets",
          },
        },
      ])
    ).toMatchSnapshot();
  });

  it("running", async () => {
    const allRows = [];
    for (const i of [1, 4, 5, 6, 9, 10]) {
      const sql = testQueries[i];
      const dsa = getBoilingApps(sql, appLib);
      await Promise.all(
        dsa.apps.map(async (app) => {
          const func = new Function("return " + app.functionString)();
          const appResp = await func({ S3, Glue, Lambda });
          const pushRespToDuckDB = await createTableWithDataFromJSON(duckDbConn, appResp, app.tablename);
          await duckDbConn.executeIterator(pushRespToDuckDB);
        })
      );
      console.log("----- executing query:\n\t", dsa.deparsed);
      allRows.push((await duckDbConn.executeIterator(dsa.deparsed)).fetchAllRows());
    }
    expect(allRows.sort()).toMatchSnapshot();
  });
});
