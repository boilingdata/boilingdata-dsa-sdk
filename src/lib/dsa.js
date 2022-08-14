const parse = require("json-templates");

function getDSAsForApps(apps, dsaLib) {
  return {
    ...apps,
    dsas: apps.dsas.map((dsa) => {
      const foundDsa = dsaLib.filter((d) => d.name === dsa.name).pop();
      if (!foundDsa || foundDsa.parameters.length != dsa.parameters.length) {
        throw new Error(`DSA parameter count mismatch (${foundDsa.name})`);
      }
      let parameters = {};
      foundDsa.parameters.forEach((p, i) => Object.assign(parameters, { [p.name]: dsa.parameters[i] }));
      return { ...dsa, ...foundDsa, parameters };
    }),
  };
}

function renderDSAFuncTemplates(dsas) {
  return {
    ...dsas,
    dsas: dsas.dsas.map((dsa) => {
      const template = parse(dsa.funcTemplate);
      const functionString = template(dsa.parameters);
      return { ...dsa, functionString };
    }),
  };
}

module.exports = {
  getDSAsForApps,
  renderDSAFuncTemplates,
};
