const { parse: parsesql, deparse } = require("pgsql-parser");
const jp = require("jsonpath");
const crypto = require("crypto");
const { getDuckDBType } = require("./util.js");
const util = require("util");

/**
 * Go through top 100 rows and get all key/value pairs.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns Array<[string, string]>
 */
function getAllColumns(rows) {
  if (!Array.isArray(rows)) throw new Error("rows is not an Array");
  const columns = new Map();
  rows
    .map((row) => {
      Object.entries(row)
        .splice(0, 100)
        .map((pair) => {
          if (!pair[0] || pair[0].length <= 0) return;
          if (!columns.has(pair[0])) columns.set(pair[0], getDuckDBType(pair[1]));
        });
    })
    .filter((k) => !!k);
  return [...columns];
}

function getRowColumns(row) {
  return Object.keys(row).map((k) => `"${k.toLowerCase()}"`);
}

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

function getCreateTableFromJSON(rows, tableName, dropFirst = true) {
  const columns = getAllColumns(rows);
  // CREATE TABLE people(id INTEGER, name VARCHAR);
  let stmt = "";
  if (dropFirst) stmt += `DROP TABLE IF EXISTS ${tableName};`;
  stmt = `CREATE TABLE IF NOT EXISTS ${tableName}(`;
  let first = true;
  columns.map((pair) => {
    stmt += `${first ? "" : ", "}${pair[0]} ${pair[1]}`;
    first = false;
  });
  stmt += ");";
  return stmt;
}

// FIXME: Pick only columns that are in the table!
function getInsertsFromJSON(rows, tableName) {
  // INSERT INTO people VALUES (1, 'Mark'), (2, 'Hannes'), (3, 'Bob');
  return rows.map((row) => {
    const columns = getRowColumns(row);
    let stmt = `INSERT INTO ${tableName} (${columns}) VALUES (`;
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
  jp.apply(stmts, "$..fromClause", (fromClauses) => {
    return fromClauses.map((fromClause) => {
      const func = fromClause?.RangeFunction?.functions[0]?.List?.items[0]?.FuncCall;
      let cat = func?.funcname[0]?.String?.str ?? fromClause?.RangeVar?.catalogname;
      let schema = func?.funcname[1]?.String?.str ?? fromClause?.RangeVar?.schemaname ?? "";
      let name = func?.funcname[2]?.String?.str ?? fromClause?.RangeVar?.relname;
      // console.log(`${cat}.${schema}.${name}`);
      const parameters = func?.args?.map((a) => {
        if (a.A_Const?.val?.String) return a.A_Const?.val?.String?.str;
        if (a.A_Const?.val?.Integer) return a.A_Const?.val?.Integer.ival;
        if (a.ColumnRef?.fields[0]?.String?.str) return a.ColumnRef.fields.map((f) => f?.String?.str).join(".");
        return null;
      });
      if (cat === "apps" && schema) {
        const prefix = `${cat}_${schema}${name ? "_" : ""}${name ? name : ""}`;
        const hash = crypto
          .createHash("sha1")
          .update(JSON.stringify(parameters ?? name ?? schema))
          .update(prefix)
          .digest("base64");
        const tablename = `${prefix.substring(0, 35)}_${hash
          .replace(/\+/g, "X")
          .replace(/\=/g, "Y")
          .replace(/\-/g, "Z")
          .replace(/\//g, "V")}`.substring(0, 63);
        apps.push({ cat, schema, name, tablename, parameters });
        const rf = { ...fromClause?.RangeFunction };
        delete rf?.functions;
        const rv = { ...fromClause?.RangeVar };
        delete rv?.catalogname;
        delete rv?.schemaname;
        delete rv?.relname;
        const simpleFrom = {
          RangeVar: { ...rv, ...rf, relname: tablename },
        };
        return simpleFrom;
      }
      return fromClause;
    });
  });
  const deparsed = deparse(stmts).replace(/\n/g, " ");
  return { deparsed, apps };
}

module.exports = {
  getCreateTableFromJSON,
  getInsertsFromJSON,
  getBoilingAppCalls,
  createTableWithDataFromJSON,
};
