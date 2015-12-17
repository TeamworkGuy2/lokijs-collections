/// <reference path="./definitions/node/node.d.ts" />
/// <reference path="./definitions/node/node-modules-custom.d.ts" />
/// <reference path="./definitions/lib/qunit.d.ts" />
var gutil = require("gulp-util");
var testRunner = require("qunit");
function callback() {
    //gutil.log("done a test: " + JSON.stringify(arguments));
}
testRunner.setup({
    log: {
        errors: true,
        tests: true,
        summary: true,
        globalSummary: true,
        coverage: true,
        globalCoverage: true,
        testing: true
    }
});
testRunner.run({
    code: "./db-collections/LokiDbImpl",
    tests: "./test/LokiDbImplTest.js"
}, callback);
