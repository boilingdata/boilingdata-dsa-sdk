const { parse: parsesql, deparse } = require("pgsql-parser");
const jp = require("jsonpath");
const crypto = require("crypto");
const { getDuckDBType } = require("./util.js");
const util = require("util");

function getCreateTableFromJSON(rows, tableName, dropFirst = true) {
  // CREATE TABLE people(id INTEGER, name VARCHAR);
  let stmt = "";
  if (dropFirst) stmt += `DROP TABLE IF EXISTS ${tableName};`;
  stmt = `CREATE TABLE IF NOT EXISTS ${tableName}(`;
  const row = Array.isArray(rows) ? rows[0] : rows;
  let first = true;
  Object.entries(row).map((pair) => {
    stmt += `${first ? "" : ", "}${pair[0]} ${getDuckDBType(pair[1])}`;
    first = false;
  });
  stmt += ");";
  return stmt;
}

function getInsertsFromJSON(rows, tableName) {
  return rows.map((row) => {
    let stmt = `INSERT INTO ${tableName} VALUES (`;
    // INSERT INTO people VALUES (1, 'Mark'), (2, 'Hannes'), (3, 'Bob');
    let first = true;
    Object.values(row).map((v) => {
      const isHyphen = getDuckDBType(v) === "STRING";
      stmt += first ? "" : ", ";
      stmt += isHyphen ? "'" : "";
      stmt += typeof v !== "string" && isHyphen ? JSON.stringify(v) : v;
      stmt += isHyphen ? "'" : "";
      first = false;
    });
    stmt += ");";
    return stmt;
  });
}

function getBoilingAppCalls(sql, appsLib) {
  const stmts = parsesql(sql);
  let apps = [];
  jp.apply(stmts, "$..fromClause", (fromClause) => {
    console.log(util.inspect(fromClause, false, 15));
    const func = fromClause[0]?.RangeFunction?.functions[0]?.List?.items[0]?.FuncCall;
    let cat = func?.funcname[0]?.String?.str ?? fromClause[0]?.RangeVar?.catalogname ?? "apps";
    let schema = func?.funcname[1]?.String?.str ?? fromClause[0]?.RangeVar?.schemaname ?? "";
    let name = func?.funcname[2]?.String?.str ?? fromClause[0]?.RangeVar?.relname;
    console.log(`${cat}.${schema}.${name}`);
    const parameters = func?.args.map((a) => {
      if (a.A_Const?.val?.String) return a.A_Const?.val?.String?.str;
      if (a.A_Const?.val?.Integer) return a.A_Const?.val?.Integer.ival;
      return null;
    });
    if (cat && schema && !name) {
      if (appsLib.some((app) => app.appName === cat)) {
        // awssdk.bucketrecursivelisting('boilingdata-demo') and "awssdk" is found frmo appsLib
        // ==> apps.awssdk.bucketrecursivelisting('boilingdata-demo')
        console.log("short hand notation recognised");
        name = schema;
        schema = cat;
        cat = "apps";
      }
    }
    if (cat === "apps") {
      const hash = crypto
        .createHash("sha1")
        .update(JSON.stringify(parameters ?? name))
        .digest("base64");
      const tablename = `${cat}_${schema}${name ? "_" : ""}${name ? name : ""}_${hash
        .replace(/\+/g, "X")
        .replace(/\=/g, "Y")
        .replace(/\-/g, "Z")
        .replace(/\//g, "V")}`;
      apps.push({ cat, schema, name, tablename, parameters });
      const simpleFrom = { RangeVar: { relname: tablename } };
      return [simpleFrom];
    }
    return fromClause;
  });
  const deparsed = deparse(stmts);
  return { deparsed, apps };
}

module.exports = {
  getCreateTableFromJSON,
  getInsertsFromJSON,
  getBoilingAppCalls,
};
