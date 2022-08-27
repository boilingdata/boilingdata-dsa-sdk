const parse = require("json-templates");
const { getBoilingAppCalls } = require("./sql-helpers");

function renderBoilingApps(apps) {
  return apps.map((app) => {
    const template = parse(app.funcTemplate);
    const functionString = template(app.parameters);
    return { ...app, functionString };
  });
}

function getBoilingApps(sql, appsLib) {
  const { deparsed, apps: appCalls } = getBoilingAppCalls(sql, appsLib);
  const appTemplates = appCalls.map((app) => {
    console.log(app);
    const schemaNameLower = app.schema.toLowerCase();
    const appNameLower = app.name?.toLowerCase();
    const foundApp = appsLib
      .filter(
        (d) =>
          d.appName.toLowerCase() === schemaNameLower ||
          d.aliases.some((a) => a.aliasTableName?.toLowerCase() === schemaNameLower)
      )
      .pop();
    if (!foundApp) {
      throw new Error(`Boiling App not found (${app.schema})`);
    }
    const foundAlias = foundApp.aliases.find((d) => d.aliasTableName.toLowerCase() === appNameLower);
    let aliasParams = foundAlias?.fixedParameters;
    if (foundAlias?.parameters) {
      let aliasParameters = {};
      foundAlias.parameters.forEach((p, i) => {
        Object.assign(aliasParameters, {
          [p.name]: app.parameters[i],
        });
      });
      app.parameters = undefined; // Must not mix alias defined parameters with the main app params
      aliasParams = aliasParams.map((p) => {
        const template = parse(p);
        return template(aliasParameters);
      });
    }
    console.log(aliasParams);
    let parameters = {};
    foundApp?.parameters?.forEach((p, i) =>
      Object.assign(parameters, {
        [p.name]: app.parameters && app.parameters.length >= i ? app.parameters[i] : aliasParams[i],
      })
    );
    console.log("--- parameters:\n", parameters);
    return { ...app, ...foundApp, parameters };
  });
  return { deparsed, apps: renderBoilingApps(appTemplates) };
}

module.exports = {
  getBoilingApps,
};
