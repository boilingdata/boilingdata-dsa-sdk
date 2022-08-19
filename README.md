# Boiling Apps - Integrate anything with SQL

> Now you have Boiling Apps, in addition to Boiling Data..

This repository is an SDK (example) for creating Boiling Apps, namely integrations into [BoilingData](https://www.boilingdata.com/) ("Boiling") that can then be queried with SQL like any other SQL Compute Cached data source.

Essentially, this allows converting APIs/code/services into fast in-memory analytics SQL caches, on-demand, that you query with SQL and join with other Boiling Apps or with more static data on S3 Data Lake like Parquet files (Boiling Data). Fast embedded databases are leveraged to deliver high analytics performance with in-memory tables.

## Boiling Apps

APIs, applications, code, etc. can be integrated into [BoilingData](https://www.boilingdata.com/) as SQL Tables. We call these Boiling Apps. A Boiling App is a JSON file that describes 1) required parameters and contains a 2) JS function template string.

That's all what is required. No compiling, no transpiling, no packaging. Just a JSON file.

Boiling renders the function template with the parameters parsed from the SQL Table function invocations and calls the App with a pre-defined set of input parameters (Boiling Apps API), like with an instantiation of the NodeJS AWS SDK (`aws-sdk`).

> You can install Boiling Apps into Boiling and use them in your SQL with the Table Function SQL syntax (`apps.awssdk('S3','listObjectsV2','{"Bucket":"myBucket"}','.Contents')`). See www.boilingdata.com on how to manage your Boiling Apps (list, install, update, etc.).

```sql
  SELECT  key, size
    FROM  apps.awssdk('S3','listObjectsV2','{"Bucket":"myBucket"}','.Contents')
ORDER BY  size;
```

Boiling stores the results (JSON, Array of Objects) into an in-memory SQL Table. Then it executes the given SQL over it. Next queries hitting the same Boiling App with the same parameters set will re-use the cached in-memory SQL Table and provide blazing fast query responses.

### Boiling App is a JSON file

Boiling App consists of a JSON file, like [`apps.awssdk.json`](apps.awssdk.json), that can be installed into your Boiling account and then used in your SQL queries.

```sql
  SELECT  "Name", "CreationDate"
    FROM  apps.awssdk('S3','listBuckets','','.Buckets')
   WHERE  "Name"
    LIKE  '%boilingdata%'
ORDER BY  "Name";
```

Boiling renders the function template with parameters parsed from SQL, calls the function, infers types from the returned JSON, create a new in-memory table (e.g. on DuckDB), loads the Objects as rows into it, and runs your SQL over it.

```sql
CREATE TABLE IF NOT EXISTS apps_awssdk_v9V(Key STRING, LastModified STRING, ETag STRING, ChecksumAlgorithm STRING, Size INTEGER, StorageClass STRING);
INSERT INTO apps_awssdk_v9V VALUES ('demo.parquet', '"2022-06-18T10:14:03.000Z"', '"f5d2e2bda78a61d9ed9a184ccf3beba2-58"', '[]', 484530996, 'STANDARD');
INSERT INTO apps_awssdk_v9V VALUES ('demo2.parquet', '"2022-06-18T10:14:24.000Z"', '"f5d2e2bda78a61d9ed9a184ccf3beba2-58"', '[]', 484530996, 'STANDARD');
INSERT INTO apps_awssdk_v9V VALUES ('demo4.duckdb.zst', '"2022-06-18T10:55:23.000Z"', '"85669ad1c741265a227e6eafc53cac62-43"', '[]', 359243721, 'STANDARD');
INSERT INTO apps_awssdk_v9V VALUES ('test.parquet', '"2022-05-23T16:37:00.000Z"', '"19c7dc463166dd08c931736ad9048a35"', '[]', 2783, 'STANDARD');
```

NOTE: Boiling uses more effective ways to load the data than plain INSERT statements when it makes sense. This is just an example.

The Boiling App call (with the set of params) results are stored in an in-memory SQL database table and can be queried again with Boiling SQL queries. Thus, further queries using the same Boiling App and parameters will not invoke the Boiling App but re-use the cached results in the SQL Table.

### Example

Please see the [`apps.awssdk.json`](apps.awssdk.json) file. We have copied it below.

```json
[
  {
    "version": "0.1.0",
    "name": "awssdk",
    "description": "AWS SDK Boiling App",
    "templateType": "json-templates",
    "templateVersion": "1.0.0",
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
        "sql": "SELECT \"Name\", \"CreationDate\" FROM apps.awssdk('S3','listBuckets','','.Buckets');",
        "description": "Use AWS NodeJS SDK to all S3 Buckets"
      },
      {
        "sql": "SELECT key, size FROM apps.awssdk('S3','listObjectsV2','{\"Bucket\":\"boilingdata-demo\",\"Delimiter\":\"/\"}','.Contents') WHERE key LIKE '%.parquet' ORDER BY key;",
        "description": "Use AWS NodeJS SDK to list a bucket, with delimiter (folders)"
      },
      {
        "sql": "SELECT * FROM apps.awssdk('Lambda','invoke','{\"FunctionName\":\"myLatestScoresLambda\",\"Payload\":JSON.stringify({\"region\":\"us\"})}','') ORDER BY score;",
        "description": "Use AWS NodeJS SDK to call Lambda function"
      }
    ]
  }
]
```

### Boiling App Hierarchies

We will add support for Boiling App (alias) hierarchies, so that you can essentially create more easily consumable aliases with default values for some of the variables of a Boiling App.

Let's say you want to call your own Lambda but instead of doing it with `SELECT * FROM apps.awssdk('Lambda','invoke','{"FunctionName":"myLambda","Payload":JSON.stringify({"region":"us"})}',''});`, you could just call `SELECT * FROM apps.myLambda('us');`.

### Installation to BoilingData

TBD. Please see Boiling documentation.

## Development

We run the example code on Amazon Linux Lambda NodeJS docker container image, similar to what AWS Lambda uses. We use the AWS SDK Boiling App as an example and query S3.

```shell
yarn build
yarn test
```

## Analysis

### Performance Considerations

Once in the in-memory embedded database tables, like DuckDB, the queries run blazing fast on multi-threaded and single tenant query dedicated CPU and memory resources.

Getting the data into the memory, into the SQL Table is slower and thus introduces initial loading delay. Like reading DuckDB or Parquet files from S3 with all the available network bandwidth, or with Boiling Apps reading from anything you define (a Boiling App could be just random number generator that generates test data based on input parameters).

With Boiling Apps, we use JSON as the interface to return the data to Boiling, which is very inefficient transport format in general. However, APIs and services usually respond with JSON, so it is a convenient way of integrating and creating sources into Boiling in an already supported and existing way. Furthermore, JSON is NOT used when the queries are ran as the data at that point has already been loaded into the database native (optimised) format.

### Security Considerations

Boiling runs queries in single tenant resources that have secure execution boundaries (e.g. AWS Lambda that is also PCI DSS compliant among other things). Boiling Apps are also run within the security context of the AWS IAM Roles that are provided by users accessing their own data and interfaces (or public interfaces).

Since every query has its own dedicated resources and customer defined (AWS IAM) access policies, interference between customers is blocked and exposure is controlled. Also, no Boiling App has access to the Boiling system resources.

Boiling Apps are run in `"use strict";` mode with `new Function()` API, and under customer provided IAM assumed role. Boiling Apps are JSON files that anybody can review and validate. Also, installing them is under the control of the user. However, like with any code, users are responsible to maintain the code and install updates when necessary (unless Boiling maintains them on behalf of you).

In case users want to access resources that require credentials, it is not the best practice to include them into the SQL Table function and thus into the SQL query itself. This is because the SQL queries get logged, may go through various integrations etc. To address this we allow setting and updating credentials for your Boiling Apps in Boiling API (TBD).

### Discussion

Boiling Apps are not meant to be big applications that require loads of modules and hundreds of lines of code, but a small shim layer that can e.g. use `apps.awssdk()` SQL Table function to invoke your AWS Lambda, or use `apps.http()` to call your REST API that hosts an entire fleet of microservices.

Error handling needs to be taken care of to avoid hanging queries. We hope that this repository will serve as a starting point to develop reliable and good integrations.
