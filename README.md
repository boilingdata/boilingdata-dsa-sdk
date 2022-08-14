# Data Source Applications (DSA) in BoilingData

This repository is an SDK for creating data integrations into [BoilingData](https://www.boilingdata.com/). Essentially, this allows converting slow APIs into fast in-memory analytics SQL caches, on-demand, that you query with SQL and, join with other data integrations or with more static data on S3 Data Lake. Fast embedded databases are leveraged to deliver high analytics performance with data in-memory.

## TL;DR

APIs, applications, code, etc. can be integrated into [BoilingData](https://www.boilingdata.com/) as SQL Tables. We call these Data Source Applications, DSAs. A DSA is a JSON that describes required parameters and a JS function template. BoilingData passes pre-defined set of parameters for the rendered functions, like an instance of the AWS SDK.

> You can install JavaScript function templates into BoilingData and call them from your SQL with the Table Function SQL syntax. See BoilingData on how to manage your DSAs (list, install, update, etc.).

BoilingData will call the function and store the JSON Array of Objects results into an in-memory SQL Table. Then it executes the given SQL over it. Further queries with the same DSA parameters will re-use the cached SQL Table.

## Data Source Application (DSA) JSON

The whole application is a JSON file, `dsa.awssdk.json`, that can be installed into your BoilingData account and used like this:

```sql
  SELECT  "Name", "CreationDate"
    FROM  dsa.awssdk('S3','listBuckets','','.Buckets')
   WHERE  "Name"
    LIKE  '%boilingdata%'
ORDER BY  "Name";
```

On a first call, BoilingData service renders the JS function template with the provided parameters in the SQL query, creates the actual Function, and invokes it with a pre-defined set of parameters (e.g. `{ AWS: AWS, region: 'us-east-1' }`, where `AWS` is `aws-sdk` instance). The function must return JSON array of Objects. Boiling will infer types from the returned JSON, create a new in-memory table (e.g. on DuckDB) and push the Objects as rows into it.

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

TBD.

## Security Considerations

BoilingData runs queries in single tenant resources that have secure boundaries (e.g. AWS Lambda that is also PCI DSS compliant). DSA applications are run within the limits of the IAM Roles that are provided by customers.

Since every query has its own dedicated resources and customers define the access policies, interference between customers is blocked. No DSA has access to the BoilingData system resources.
