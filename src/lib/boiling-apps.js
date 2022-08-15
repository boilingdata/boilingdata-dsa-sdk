const parse = require("json-templates");
const { getBoilingAppCalls } = require("./sql-helpers");

function renderBoilingApps(apps) {
  return {
    ...apps,
    apps: apps.apps.map((app) => {
      const template = parse(app.funcTemplate);
      const functionString = template(app.parameters);
      return { ...app, functionString };
    }),
  };
}

function getBoilingApps(sql, appsLib) {
  const appCalls = getBoilingAppCalls(sql);
  const appTemplates = {
    ...appCalls,
    apps: appCalls.apps.map((app) => {
      const foundApp = appsLib.filter((d) => d.name === app.name).pop();
      if (!foundApp || foundApp.parameters.length != app.parameters.length) {
        throw new Error(`Boiling App parameter count mismatch (${foundApp.name})`);
      }
      let parameters = {};
      foundApp.parameters.forEach((p, i) => Object.assign(parameters, { [p.name]: app.parameters[i] }));
      return { ...app, ...foundApp, parameters };
    }),
  };
  return renderBoilingApps(appTemplates);
}

module.exports = {
  getBoilingApps,
};
