const { parse: parsesql, deparse } = require("pgsql-parser");
const jp = require("jsonpath");
const crypto = require("crypto");
const { getDuckDBType } = require("./util.js");

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
    stmt = `INSERT INTO ${tableName} VALUES (`;
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

function getBoilingAppCalls(sql) {
  const stmts = parsesql(sql);
  let apps = [];
  jp.apply(stmts, "$..fromClause", (fromClause) => {
    const func = fromClause[0]?.RangeFunction?.functions[0]?.List?.items[0]?.FuncCall;
    const cat = func?.funcname[0]?.String?.str;
    const name = func?.funcname[1]?.String?.str;
    const parameters = func?.args.map((a) => {
      if (a.A_Const?.val?.String) return a.A_Const?.val?.String?.str;
      if (a.A_Const?.val?.Integer) return a.A_Const?.val?.Integer.ival;
      return null;
    });
    if (cat === "apps") {
      const hash = crypto.createHash("sha1").update(JSON.stringify(parameters)).digest("base64");
      const tablename = `${cat}_${name}_${hash
        .replace(/\+/g, "X")
        .replace(/\=/g, "Y")
        .replace(/\-/g, "Z")
        .replace(/\//g, "V")}`;
      apps.push({ cat, name, tablename, parameters });
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
