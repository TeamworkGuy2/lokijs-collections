"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var Resultset = require("../../db-collections/Resultset");
var M = require("../TestModels");
var asr = chai.assert;
suite("DynamicView", function () {
    var testRecords;
    setup(function () {
        testRecords = [
            { name: "mjolnir", owner: "thor", maker: "dwarves" },
            { name: "gungnir", owner: "odin", maker: "elves" },
            { name: "tyrfing", owner: "Svafrlami", maker: "dwarves" },
            { name: "draupnir", owner: "odin", maker: "elves" }
        ];
    });
    test("empty filter across changes", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        items.insert(testRecords);
        var dv = M.addDynamicView(items, "usersDv");
        // with no filter, results should be all documents
        var results = dv.data();
        asr.equal(results.length, 4);
        // find and update a document which will notify view to re-evaluate
        var gungnir = items.findOne({ name: "gungnir" });
        asr.equal(gungnir.owner, "odin");
        gungnir.maker = "dvalin";
        items.update(gungnir);
        results = dv.data();
        asr.equal(results.length, 4);
    });
    test("dynamic view batch removes work as expected", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        var dv = M.addDynamicView(items, "dv");
        dv.applyFind({ a: 1 });
        items.insert([
            { a: 0, b: 1 },
            { a: 1, b: 2 },
            { a: 0, b: 3 },
            { a: 1, b: 4 },
            { a: 0, b: 5 },
            { a: 1, b: 6 },
            { a: 1, b: 7 },
            { a: 1, b: 8 },
            { a: 0, b: 9 }
        ]);
        asr.equal(dv.data().length, 5);
        items.removeWhere({ b: { $lt: 7 } });
        asr.equal(dv.data().length, 2);
        var results = dv.branchResultset().simplesort("b").data();
        asr.equal(results[0].b, 7);
        asr.equal(results[1].b, 8);
    });
    test("dynamic (persistent/sorted) view batch removes work as expected", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        var dv = M.addDynamicView(items, "dv");
        dv.applyFind({ a: 1 });
        dv.applySimpleSort("b");
        items.insert([
            { a: 0, b: 1 },
            { a: 1, b: 2 },
            { a: 0, b: 3 },
            { a: 1, b: 4 },
            { a: 0, b: 5 },
            { a: 1, b: 6 },
            { a: 1, b: 7 },
            { a: 1, b: 8 },
            { a: 0, b: 9 }
        ]);
        asr.equal(dv.data().length, 5);
        items.removeWhere({ b: { $lt: 7 } });
        var results = dv.data();
        asr.equal(results.length, 2);
        asr.equal(results[0].b, 7);
        asr.equal(results[1].b, 8);
    });
    test("dynamic (persistent/sorted/indexed) view batch removes work as expected", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users", { indices: ["b"] });
        var dv = M.addDynamicView(items, "dv");
        dv.applyFind({ a: 1 });
        dv.applySimpleSort("b");
        items.insert([
            { a: 0, b: 1 },
            { a: 1, b: 2 },
            { a: 0, b: 3 },
            { a: 1, b: 4 },
            { a: 0, b: 5 },
            { a: 1, b: 6 },
            { a: 1, b: 7 },
            { a: 1, b: 8 },
            { a: 0, b: 9 }
        ]);
        asr.equal(dv.data().length, 5);
        items.removeWhere({ b: { $lt: 7 } });
        var results = dv.data();
        asr.equal(results.length, 2);
        asr.equal(results[0].b, 7);
        asr.equal(results[1].b, 8);
    });
    test("dynamic view rematerialize works as expected", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        items.insert(testRecords);
        var dv = M.addDynamicView(items, "usersDv");
        dv.applyFind({ "owner": "odin" });
        dv.applyWhere(function (obj) { return obj.maker === "elves"; });
        asr.equal(dv.data().length, 2);
        asr.equal(dv.filterPipeline.length, 2);
        dv.rematerialize({ removeWhereFilters: true });
        asr.equal(dv.data().length, 2);
        asr.equal(dv.filterPipeline.length, 1);
    });
    test("dynamic view toJSON does not circularly reference", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        items.insert(testRecords);
        var dv = M.addDynamicView(items, "usersDv");
        var obj = dv.toJSON();
        asr.isNull(obj.collection);
    });
    test("dynamic view removeFilters works as expected", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        items.insert(testRecords);
        var dv = M.addDynamicView(items, "ownr");
        dv.applyFind({ "owner": "odin" });
        dv.applyWhere(function (obj) { return obj.maker === "elves"; });
        asr.equal(dv.filterPipeline.length, 2);
        asr.equal(dv.data().length, 2);
        dv.filterPipeline = [];
        dv.rematerialize(); //dv.removeFilters();
        asr.equal(dv.filterPipeline.length, 0);
        asr.equal(dv.count(), 4);
    });
    test("removeDynamicView works correctly", function () {
        var db = M.createDb("dvtest");
        var items = db.addCollection("users");
        items.insert(testRecords);
        var dv = M.addDynamicView(items, "ownr");
        dv.applyFind({ "owner": "odin" });
        dv.applyWhere(function (obj) {
            return (obj.maker === "elves");
        });
        asr.equal(items.dynamicViews.length, 1);
        items.removeDynamicView("ownr");
        asr.equal(items.dynamicViews.length, 0);
    });
    test("removeDynamicView works correctly (2)", function () {
        var _a, _b, _c, _d;
        var db = M.createDb("test.db");
        var coll = db.addCollection("coll");
        M.addDynamicView(coll, "dv1");
        M.addDynamicView(coll, "dv2");
        M.addDynamicView(coll, "dv3");
        M.addDynamicView(coll, "dv4");
        M.addDynamicView(coll, "dv5");
        asr.equal(coll.dynamicViews.length, 5);
        coll.removeDynamicView("dv3");
        asr.equal(coll.dynamicViews.length, 4);
        asr.equal((_a = coll.getDynamicView("dv1")) === null || _a === void 0 ? void 0 : _a.name, "dv1");
        asr.equal((_b = coll.getDynamicView("dv2")) === null || _b === void 0 ? void 0 : _b.name, "dv2");
        asr.isNull(coll.getDynamicView("dv3"));
        asr.equal((_c = coll.getDynamicView("dv4")) === null || _c === void 0 ? void 0 : _c.name, "dv4");
        asr.equal((_d = coll.getDynamicView("dv5")) === null || _d === void 0 ? void 0 : _d.name, "dv5");
    });
    test("dynamic view simplesort options work correctly", function () {
        var db = M.createDb("dvtest.db");
        var coll = db.addCollection("colltest", { indices: ["a", "b"] });
        // add basic dv with filter on a and basic simplesort on b
        var dv = M.addDynamicView(coll, "dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b");
        // data only needs to be inserted once since we are leaving collection intact while
        // building up and tearing down dynamic views within it
        coll.insert([{ a: 1, b: 11 }, { a: 2, b: 9 }, { a: 8, b: 3 }, { a: 6, b: 7 }, { a: 2, b: 14 }, { a: 22, b: 1 }]);
        // test whether results are valid
        var results = dv.data();
        asr.equal(results.length, 5);
        for (var idx = 0; idx < results.length - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["b"], results[idx + 1]["b"]));
        }
        // remove dynamic view
        coll.removeDynamicView("dvtest");
        // add basic dv with filter on a and simplesort (with js fallback) on b
        dv = M.addDynamicView(coll, "dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b");
        // test whether results are valid
        // for our simple integer datatypes javascript sorting is same as loki sorting
        var results = dv.data();
        asr.equal(results.length, 5);
        for (var idx = 0; idx < results.length - 1; idx++) {
            asr.isTrue(results[idx]["b"] <= results[idx + 1]["b"]);
        }
        // remove dynamic view
        coll.removeDynamicView("dvtest");
        // add basic dv with filter on a and simplesort (forced js sort) on b
        dv = M.addDynamicView(coll, "dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b");
        // test whether results are valid
        var results = dv.data();
        asr.equal(results.length, 5);
        for (var idx = 0; idx < results.length - 1; idx++) {
            asr.isTrue(results[idx]["b"] <= results[idx + 1]["b"]);
        }
        // remove dynamic view
        coll.removeDynamicView("dvtest");
        // add basic dv with filter on a and simplesort (forced loki sort) on b
        dv = M.addDynamicView(coll, "dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b");
        // test whether results are valid
        var results = dv.data();
        asr.equal(results.length, 5);
        for (var idx = 0; idx < results.length - 1; idx++) {
            asr.isTrue(Resultset.LokiOps.$lte(results[idx]["b"], results[idx + 1]["b"]));
        }
    });
    test("querying branched result set - finds first result with firstOnly: true", function () {
        var _a = setupElves(), elves = _a.elves, db = _a.db;
        var resultset = elves.branchResultset();
        var result = resultset.find({ name: { $ne: "thor" } }, true).data();
        asr.equal(result.length, 1);
        asr.equal(result[0].name, "gungnir");
    });
    test("querying branched result set - finds first result with firstOnly: true and empty query", function () {
        var _a = setupElves(), elves = _a.elves, db = _a.db;
        var resultset = elves.branchResultset();
        var result = resultset.find({}, true).data();
        asr.equal(result.length, 1);
        asr.equal(result[0].name, "gungnir");
    });
});
function setupElves() {
    var db = M.createDb("firstonly.db");
    var items = db.addCollection("items");
    items.insert({ name: "mjolnir", owner: "thor", maker: "dwarves" });
    items.insert({ name: "gungnir", owner: "odin", maker: "elves" });
    items.insert({ name: "tyrfing", owner: "Svafrlami", maker: "dwarves" });
    items.insert({ name: "draupnir", owner: "odin", maker: "elves" });
    var elves = M.addDynamicView(items, "elves-Dv");
    elves.applyFind({ maker: "elves" });
    return { elves: elves, db: db };
}
