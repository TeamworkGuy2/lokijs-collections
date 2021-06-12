/// <reference path="../node_modules/ts-bundlify/ts-bundlify-types.d.ts" />
import fs = require("fs");
import chai = require("chai");
import mocha = require("mocha");
import browserPack = require("browser-pack");
import depsSort = require("deps-sort");
import moduleDeps = require("module-deps");
import insertModuleGlobals = require("insert-module-globals");
import FileUtil = require("ts-bundlify/utils/FileUtil");
import BundleBuilder = require("ts-bundlify/bundlers/BundleBuilder");
import TsBrowserify = require("ts-bundlify/bundlers/browser/TsBrowserify");

var asr = chai.assert;

suite("CompileManualBrowserBundle", function CompileManualBrowserBundleTest() {
    var doCleanup = true;


    test("bundleLokijsCollections", function bundleLokijsCollectionsTest(done) {
        this.timeout(3000);

        TsBrowserify.builtins = {
            fs: require.resolve("fs"),
        };

        var bundleBldr = BundleBuilder.buildBundler((opts: TsBrowserify.Options) => new TsBrowserify(opts), /*watchify*/null, {
            debug: true,
            rebuild: false,
            verbose: true,
            browserPack,
            depsSort,
            moduleDeps,
            insertModuleGlobals,
        }, BundleBuilder.compileBundle)
        .setBundleListeners({
            finishAll: () => {
                var bundleMap: any;

                asr.doesNotThrow(() => {
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