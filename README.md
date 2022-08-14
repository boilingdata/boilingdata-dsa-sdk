# Integrate anything with SQL - BoilingData DSAs

This repository is an SDK for creating integrations into [BoilingData](https://www.boilingdata.com/) ("Boiling") that can then be queried with SQL.

Essentially, this allows converting APIs/code/services into fast in-memory analytics SQL caches, on-demand, that you query with SQL and join with other data integrations or with more static data on S3 Data Lake like Parquet files. Fast embedded databases are leveraged to deliver high analytics performance with in-memory tables.

## Data Source Applications

APIs, applications, code, etc. can be integrated into [BoilingData](https://www.boilingdata.com/) as SQL Tables. We call these Data Source Applications, DSAs. A DSA is a JSON that describes 1) required parameters and a 2) JS function template.

Boiling renders the function tamplate with the parameters parsed from the SQL and calls it with a pre-defined set of input parameters, like an instantiation of the NodeJS AWS SDK (`aws-sdk`).

> You can install Data Source Applications into Boiling and use them in your SQL with the Table Function SQL syntax. See www.boilingdata.com on how to manage your DSAs (list, install, update, etc.).

```sql
  SELECT  key, size
    FROM  dsa.awssdk('S3','listObjectsV2','{"Bucket":"myBucket"}','.Contents')
ORDER BY  size;
```

Boiling stores the results (JSON, Array of Objects) into an in-memory SQL Table. Then it executes the given SQL over it. Next queries hitting the same DSA with the same parameters will re-use the cached SQL Table.

## DSA is a JSON file

The data source application consists of a JSON file, like [`dsa.awssdk.json`](dsa.awssdk.json), that can be installed into your Boiling account and then used in your SQL queries.

```sql
  SELECT  "Name", "CreationDate"
    FROM  dsa.awssdk('S3','listBuckets','','.Buckets')
   WHERE  "Name"
    LIKE  '%boilingdata%'
ORDER BY  "Name";
```

Boiling renders the function template with parameters parsed from SQL, calls the function, infers types from the returned JSON, create a new in-memory table (e.g. on DuckDB), inserts the Objects as rows into it, and runs your SQL over it.

```sql
CREATE TABLE IF NOT EXISTS dsa_awssdk_v9V(Key STRING, LastModified STRING, ETag STRING, ChecksumAlgorithm STRING, Size INTEGER, StorageClass STRING);
INSERT INTO dsa_awssdk_v9V VALUES ('demo.parquet', '"2022-06-18T10:14:03.000Z"', '"f5d2e2bda78a61d9ed9a184ccf3beba2-58"', '[]', 484530996, 'STANDARD');
INSERT INTO dsa_awssdk_v9V VALUES ('demo2.parquet', '"2022-06-18T10:14:24.000Z"', '"f5d2e2bda78a61d9ed9a184ccf3beba2-58"', '[]', 484530996, 'STANDARD');
INSERT INTO dsa_awssdk_v9V VALUES ('demo4.duckdb.zst', '"2022-06-18T10:55:23.000Z"', '"85669ad1c741265a227e6eafc53cac62-43"', '[]', 359243721, 'STANDARD');
INSERT INTO dsa_awssdk_v9V VALUES ('test.parquet', '"2022-05-23T16:37:00.000Z"', '"19c7dc463166dd08c931736ad9048a35"', '[]', 2783, 'STANDARD');
```

After the first call, the API call results are cached in an in-memory SQL database table and can be re-used for various SQL queries. Thus, further queries using the same DSA and parameters will not invoke the DSA application but re-use the cached results in the SQL Table.

## Example

Please see the [`dsa.awssdk.json`](dsa.awssdk.json) file. We have copied it below.

```json
[
  {
    "version": "0.1.0",
    "name": "awssdk",
    "description": "AWS SDK Data Source App (DSA) for BoilingData",
    "templateType": "json-templates",
    "funcTemplate": "async ({ AWS, region }) => { const _s = new AWS.{{service}}({ region }); return (await _s.{{apicall}}({{params}}).promise().catch(err => console.error(err))){{resultPath}}; }",
    "parameters": [
      {
        "name": "service",
        "description": "AWS Service to use, like S3 or Lambda"
      },
      {
        "name": "apicall",
        "description": "SDK method to call, like `listObjectsV2`"
      },
      {
        "name": "params",
        "description": "What parameters to pass to the method call, like '{\"Bucket\":\"boilingdata-demo\",\"Delimiter\":\"/\"}'"
      },
      {
        "name": "resultPath",
        "description": "What part to pick up from the AWS JSON resopnse (e.g. `.Contents`). The response must be an array of objects."
      }
    ],
    "examples": [
      {
        "sql": "SELECT \"Name\", \"CreationDate\" FROM dsa.awssdk('S3','listBuckets','','.Buckets');",
        "description": "Use AWS NodeJS SDK to all S3 Buckets"
      },
      {
        "sql": "SELECT key, size FROM dsa.awssdk('S3','listObjectsV2','{\"Bucket\":\"boilingdata-demo\",\"Delimiter\":\"/\"}','.Contents') WHERE key LIKE '%.parquet' ORDER BY key;",
        "description": "Use AWS NodeJS SDK to list a bucket, with delimiter (folders)"
      },
      {
        "sql": "SELECT * FROM dsa.awssdk('Lambda','invoke','{\"FunctionName\":\"myLatestScoresLambda\",\"Payload\":JSON.stringify({\"region\":\"us\"})}','') ORDER BY score;",
        "description": "Use AWS NodeJS SDK to call Lambda function"
      }
    ]
  }
]
```

## Installation to BoilingData

Please see Boiling documentation.

## Development

We run the example code on Amazon Linux Lambda NodeJS image, similar to what AWS Lambda uses.

```shell
yarn build
yarn test
```

## Security Considerations

BoilingData runs queries in single tenant resources that have secure boundaries (e.g. AWS Lambda that is also PCI DSS compliant). DSA applications are run within the limits of the IAM Roles that are provided by customers.

Since every query has its own dedicated resources and customers define the access policies, interference between customers is blocked. No DSA has access to the BoilingData system resources.
