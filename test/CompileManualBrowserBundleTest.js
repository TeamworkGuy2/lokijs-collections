/// <reference path="../node_modules/ts-bundlify/ts-bundlify-types.d.ts" />
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var chai = require("chai");
var browserPack = require("browser-pack");
var depsSort = require("deps-sort");
var moduleDeps = require("module-deps");
var insertModuleGlobals = require("insert-module-globals");
var FileUtil = require("ts-bundlify/utils/FileUtil");
var BundleBuilder = require("ts-bundlify/bundlers/BundleBuilder");
var TsBrowserify = require("ts-bundlify/bundlers/browser/TsBrowserify");
var asr = chai.assert;
suite("CompileManualBrowserBundle", function CompileManualBrowserBundleTest() {
    var doCleanup = false;
    test("bundleLokijsCollections", function bundleLokijsCollectionsTest(done) {
        this.timeout(3000);
        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };
        var bundleBldr = BundleBuilder.buildBundler(function (opts) { return new TsBrowserify(opts); }, /*watchify*/ null, {
            debug: true,
            rebuild: false,
            verbose: true,
            browserPack: browserPack,
            depsSort: depsSort,
            moduleDeps: moduleDeps,
            insertModuleGlobals: insertModuleGlobals,
        }, BundleBuilder.compileBundle)
            .setBundleListeners({
            finishAll: function () {
                var bundleMap;
                asr.doesNotThrow(function () {
                    bundleMap = JSON.parse(fs.readFileSync("./test/tmp/bundle.js.map", { encoding: "utf8" }));
                    if (doCleanup) {
                        asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js"));
                        asr.isTrue(FileUtil.existsFileSync("./test/tmp/bundle.js.map"));
                        fs.unlinkSync("./test/tmp/bundle.js");
                        fs.unlinkSync("./test/tmp/bundle.js.map");
                    }
                });
                done();
            },
        })
            .compileBundle({
            entryFile: "./test/CollectionsBrowserTestBase.js",
            dstDir: "./test/tmp/",
            srcPaths: ["./"],
            projectRoot: process.cwd()
        }, {
            dstFileName: "bundle.js"
        });
    });
});
