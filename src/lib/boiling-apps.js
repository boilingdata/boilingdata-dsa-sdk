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
  const appCalls = getBoilingAppCalls(sql);
  const appTemplates = appCalls.apps.map((app) => {
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
    let parameters = {};
    const aliasParams = foundApp.aliases.find((d) => d.aliasTableName.toLowerCase() === appNameLower)?.fixedParameters;
    foundApp?.parameters?.forEach((p, i) =>
      Object.assign(parameters, {
        [p.name]: app.parameters && app.parameters.length >= i ? app.parameters[i] : aliasParams[i],
      })
    );
    return { ...app, ...foundApp, parameters };
  });
  return renderBoilingApps(appTemplates);
}

module.exports = {
  getBoilingApps,
};
