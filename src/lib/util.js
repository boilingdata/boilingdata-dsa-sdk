function getDuckDBType(t) {
  return typeof t === "number" ? "INTEGER" : "STRING";
}

module.exports = {
  getDuckDBType,
};
