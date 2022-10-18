# Boiling Data Source Applications (DSA)

This repository is an SDK example for creating and testing Boiling Data Source Applications (DSA).

DSAs are integrations with Javascript Functions on-the-fly into [BoilingData](https://www.boilingdata.com/) ("Boiling") that can then be queried with SQL like any other SQL Compute Cached data source. No need to install plugins, JAR files, compile, transpile, package, upload etc. but just write Javascript function template into JSON formatted string and INSERT into Boiling apps catalog and its ready for use immediately.

```sql
  SELECT key, size
    FROM apps.awssdk('S3','listObjectsV2','{"Bucket":"boilingdata-demo"}','.Contents')
ORDER BY size;
```

## Turn anything into fast SQL Materialised View

DSAs convert APIs/code/services into fast in-memory analytics SQL caches, on-demand, that you query with SQL again and again, and join with other dynamic or static data sources (like Parquet files). Fast embedded databases are leveraged to deliver high analytics performance with in-memory tables.

A Boiling Data Source is a JSON file that defines 1) Javascript Function template and 2) the required parameters to use when it is called from SQL as a Table Function.

As a bonus, you can optionally 3) define Table Aliases for DSAs with pre-defined parameter values. This way you can name your data sources more suitably for its real Semantic Meaning - for easier readability / understandability. Like when you choose a good descriptive name for your functions in code (or many names if you like).

```sql
SELECT * FROM apps.awssdk.allBuckets WHERE name LIKE '%boiling%';
```

Boiling renders the function templates with the parameters passed from the **SQL Table function** invocations, runs them, and stores the results into temporary tables, **before** it passes the full SQL for the embedded database engines. In other words, it transforms a template into real runnable Javascript function code that takes a pre-defined set of parameters, like AWS SDK S3, Glue, and Lambda instantiations (that Boiling provides). Then it invokes the function based on parameters in the SQL query, and transforms the results into in-memory SQL Table for the specific embedded engine in question (e.g. DuckDB).

### Boiling DSA is a JSON file

The DSA consists of a JSON file, like [`app.awssdk.json`](app.awssdk.json) or [`app.random.json`](app.random.json), that can be INSERTed into your Boiling account and then used in your SQL queries.

```sql
  SELECT key, size, lastmodified
    FROM apps.awssdkTest('S3','listObjectsV2','{"Bucket":"boilingdata-demo"}','.Contents')
   WHERE key LIKE '%.parquet'
ORDER BY size DESC;
```

1. Boiling renders the function template with parameters parsed from SQL Table function invocation.
2. It calls the function,
3. Infers types from the returned JSON, and creates a new in-memory table (e.g. on DuckDB) and loads the Objects Array as rows into it.
4. Finally, Boiling runs your SQL over it and returns the results for you
5. Next SQL queries using the same DSA Table skips steps 1-3 and runs the SQL direclty over the in-mem table already as long as cache exists (Boiling hot API!)

### Example

Please see the [`app.awssdk.json`](app.awssdk.json) file. We have copied a shortened version below. Please note that the actual function template is very short, it relies on AWS SDK internal retries and has error handling that just writes to console (for now). See also another example of generating random numbers table on [`app.random.json`](app.random.json) file.

```json
[
  {
    "version": "0.1.0",
    "appName": "awssdk",
    "description": "AWS SDK Boiling Data Source App",
    "templateType": "json-templates",
    "templateVersion": "1.0.0",
    "funcTemplate": "async ({ S3, Glue, Lambda }) => (await {{service}}.{{apicall}}({{params}}).promise()){{resultPath}}",
    "parameters": [
      {
        "name": "service",
        "description": "AWS Service to use: S3, Glue, or Lambda"
      },
      {
        "name": "apicall",
        "description": "SDK method to call, like \"listObjectsV2\""
      },
      {
        "name": "params",
        "description": "What parameters to pass to the method call, like '{\"Bucket\":\"boilingdata-demo\",\"Delimiter\":\"/\"}'"
      },
      {
        "name": "resultPath",
        "description": "What part to pick up from the AWS JSON resopnse (e.g. \".Contents\"). The response must be an array of objects."
      }
    ],
    "aliases": [
      {
        "aliasTableName": "allBuckets",
        "parameters": ["S3", "listBuckets", "", ".Buckets"],
        "description": "Table that contains all S3 Buckets listing"
      },
      {
        "aliasTableName": "myGameTopScores",
        "fixedParameters": [
          "Lambda",
          "invoke",
          "{\"FunctionName\":\"myGameTopScores\",\"Payload\":JSON.stringify({\"region\":\"us\"})}",
          ".Contents"
        ],
        "description": "Table that contains latest top scores for MyGame"
      }
    ],
    "examples": [
      {
        "sql": "SELECT \"Name\", \"CreationDate\" FROM apps.awssdk('S3','listBuckets','','.Buckets');",
        "description": "Use AWS NodeJS SDK S3 instance to list all S3 Buckets"
      },
      {
        "sql": "SELECT * FROM apps.awssdk.allBuckets WHERE name LIKE '%boiling%';",
        "description": "Use an alias table to get all buckets listing with name containing boiling"
      },
      {
        "sql": "SELECT * FROM apps.awssdk.myGameTopScores ORDER BY score, name;",
        "description": "Table alias for AWS Lambda data source"
      }
    ]
  }
]
```

# Installation to BoilingData

Here is a simple Boiling DSA for interacting with AWS S3. Please note that it does not implement fetching all the pages the API provides, only the first results in the batch.

```json
{
  "appName": "S3",
  "funcTemplate": "async ({ S3 }) => (await S3.{{apicall}}({{params}}).promise()){{resultPath}}",
  "parameters": [{ "name": "apicall" }, { "name": "params" }, { "name": "resultPath" }]
}
```

Go to [app.boilingdata.com](https://app.boilingdata.com/) and `INSERT` the DSA JSON string into `apps` catalog, and you can use it right away.

```sql
INSERT INTO apps VALUES ('S3', '{"appName":"S3","funcTemplate":"async ({ S3 }) => (await S3.{{apicall}}({{params}}).promise()){{resultPath}}","parameters":[{"name":"apicall"},{"name":"params"},{"name":"resultPath"}]}');
SELECT * FROM apps;
SELECT * FROM apps.S3('listBuckets','','.Buckets');
SELECT key, size, lastmodified FROM apps.S3('listObjectsV2','{"Bucket":"boilingdata-demo"}','.Contents') WHERE key LIKE '%csv' ORDER BY lastmodified DESC;
SELECT * FROM apps.awssdk('Glue','getDatabases','','.DatabaseList');
SELECT * FROM apps.awssdk('Glue','getTables','{"DatabaseName":"default"}','.TableList');
SELECT * FROM apps.awssdk('Glue','getPartitions','{"DatabaseName":"default","TableName":"nyctaxis"}','.Partitions');
...
```

Another exmaple Boiling DSA, which is a random number generator.

```json
{
  "appName": "rand10by10",
  "funcTemplate": "async () => [...new Array(10)].map(row => [...new Array(10)].map(_ => Math.random()*1000))"
}
```

```sql
INSERT INTO apps VALUES ('rand', '{"appName": "rand","funcTemplate":  "async () => [...new Array(10)].map(row => [...new Array(10)].map(_ => Math.random()*1000))"}');
SELECT * FROM apps.rand();
```

# Development

We run the example code on Amazon Linux Lambda NodeJS docker container image, similar to what AWS Lambda uses. We use the AWS SDK Boiling App as an example and query S3 and Glue.

> You can use this codebase as a testbed or SDK for your Boiling DSAs, but you need to update the queries and tests to match your resources in your AWS Account. Some tests depend on our AWS credentials based access to our resources, so they wount work for you out-of-the box

```shell
yarn build
yarn test
```

# Analysis

### Performance Considerations

Once in the in-memory embedded database tables, like DuckDB, the queries run blazing fast on multi-threaded and single tenant query dedicated CPU and memory resources.

Getting the data into the memory, into the SQL Table is slower and thus introduces initial loading delay. Like reading DuckDB or Parquet files from S3 with all the available network bandwidth, or with Boiling DSAs reading from anything you define (a Boiling DSA could be just random number generator that generates test data based on input parameters).

With Boiling DSAs, we use JSON as the interface to return the data to Boiling, which is very inefficient transport format in general. However, APIs and services usually respond with JSON, so it is a convenient way of integrating and creating sources into Boiling in an already supported and existing way. Furthermore, JSON is NOT used when the queries are ran as the data at that point has already been loaded into the database native (optimised) formats.

### Security Considerations

Boiling runs queries in single tenant resources that have secure execution boundaries (e.g. AWS Lambda that is also PCI DSS compliant among other things). Boiling Apps are also run within the security context of the AWS IAM Roles that are provided by users accessing their own data and interfaces (or public interfaces).

Since every query has its own dedicated resources and customer defined (AWS IAM) access policies, interference between customers is blocked and exposure is controlled. Also, no Boiling App has access to the Boiling system resources.

Boiling Apps are run in `"use strict";` mode with `new Function()` API, and under customer provided IAM assumed role. Boiling Apps are JSON files that anybody can review and validate. Also, installing them is under the control of the user. However, like with any code, users are responsible to maintain the code and install updates when necessary (unless Boiling maintains them on behalf of you).

### Discussion

Boiling DSAs are not meant to be big applications that require loads of modules and hundreds of lines of code, but a small shim layer that can e.g. use `apps.awssdk()` SQL Table function to invoke your AWS Lambda, or use `apps.http()` to call your REST API that hosts an entire fleet of microservices.

Error handling needs to be taken care of to avoid hanging queries. We hope that this repository will serve as a starting point to develop reliable and good integrations. BoilingData will catch errors and report them back to callers.

#### Dynamic parameter passing for Boiling DSA?

> Is it be possible to pass sub query results as parameters for DSAs?

DSAs are like materialised views, they get instantiated before the SQL query is run. This means that dynamic parameter passing from sub queries is not supported. In other words, the following query will **not work** because the DSA depends on a parameter that resolves dynamically (i.e. whatever happens to be in the `tablenames` table).

```sql
SELECT *, b.tablename FROM apps.awssdk.gluePartitions('default', b.tablename) a, (SELECT tablename FROM tablenames) b;
```

**NOTE**: To run the query, you could first run the sub query and then iterate its results and run the main query. This way, you would be running multiple queries instead of one.

#### Boiling DSA composition?

> Is it be possible to create a composite DSA that is composed of other DSAs but also supports parameters?

That would not be too difficult todo. However, composition can be done on SQL level too, so we leave it there.
