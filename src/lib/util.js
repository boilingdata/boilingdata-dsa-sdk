function getDuckDBType(t) {
  // unsigned integer
  return typeof t === "number" ? "LONG" : "STRING";
}

module.exports = {
  getDuckDBType,
};
