"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var M = require("../TestModels");
var asr = chai.assert;
suite("transforms", function () {
    var db;
    var items;
    setup(function () {
        db = M.createDb("transformTest");
        items = db.addCollection("items");
        items.insert({ name: "mjolnir", owner: "thor", maker: "dwarves" });
        items.insert({ name: "gungnir", owner: "odin", maker: "elves" });
        items.insert({ name: "tyrfing", owner: "Svafrlami", maker: "dwarves" });
        items.insert({ name: "draupnir", owner: "odin", maker: "elves" });
    });
    test("basic find transform", function () {
        var results = items.chain().find({ owner: "odin" }).data();
        asr.equal(results.length, 2);
    });
    test("basic multi-step transform", function () {
        var results = items.chain().find({ owner: "odin" }).where(function (obj) { return obj.name.indexOf("drau") !== -1; }).data();
        asr.equal(results.length, 1);
    });
    test("parameterized find", function () {
        var results = items.chain().find({ owner: "odin" }).data();
        asr.equal(results.length, 2);
    });
    test("parameterized find with $and/$or", function () {
        var resultsor = items.chain().find({ $or: [{ owner: "thor" }, { owner: "thor" }] }).data();
        asr.equal(resultsor.length, 1);
        resultsor = items.chain().find({ $or: [{ owner: "odin" }, { owner: undefined }] }).data();
        asr.equal(resultsor.length, 2);
        var resultsand = items.chain().find({ $and: [{ owner: "thor" }, { name: "mjolnir" }] }).data();
        asr.equal(resultsand.length, 1);
        resultsand = items.chain().find({ $and: [{ owner: "odin" }, { name: "gungnir" }] }).data();
        asr.equal(resultsand.length, 1);
    });
    //test("parameterized transform with non-serializable non-params", function () {
    //    var db = M.createDb("tx.db");
    //
    //    var items = db.addCollection("items");
    //
    //    items.insert({ name: "mjolnir", age: 5 });
    //    items.insert({ name: "tyrfing", age: 9 });
    //
    //    function mapper(item: any) { return item.age; }
    //
    //    function averageReduceFunction(values: any[]) {
    //        var sum = 0;
    //
    //        values.forEach(function (i) {
    //            sum += i;
    //        });
    //
    //        return sum / values.length;
    //    }
    //
    //    // so ideally, transform params are useful for 
    //    // - extracting values that will change across multiple executions, and also
    //    // - extracting values which are not serializable so that the transform can be 
    //    //   named and serialized along with the database.
    //    // 
    //    // The transform used here is not serializable so this test is just to verify 
    //    // that our parameter substitution method does not have problem with 
    //    // non-serializable transforms.
    //
    //    var tx1 = [{
    //        type: "mapReduce",
    //        mapFunction: mapper,
    //        reduceFunction: averageReduceFunction
    //    }];
    //
    //    var tx2 = [{
    //        type: "find",
    //        value: {
    //            age: {
    //                "$gt": "[%lktxp]minimumAge"
    //            },
    //        }
    //    }, {
    //        type: "mapReduce",
    //        mapFunction: mapper,
    //        reduceFunction: averageReduceFunction
    //    }];
    //
    //    // no data() call needed to mapReduce
    //    asr.equal(items.chain(tx1), 7);
    //    asr.equal(items.chain(tx1, { foo: 5 }), 7);
    //    // params will cause a recursive shallow clone of objects before substitution 
    //    asr.equal(items.chain(tx2, { minimumAge: 4 }), 7);
    //    // make sure original transform is unchanged
    //    asr.equal(tx2[0].type, "find");
    //    asr.equal(tx2[0].value.age.$gt, "[%lktxp]minimumAge");
    //    asr.equal(tx2[1].type, "mapReduce");
    //    asr.equal(typeof tx2[1].mapFunction, "function");
    //    asr.equal(typeof tx2[1].reduceFunction, "function");
    //});
    test("parameterized where", function () {
        var results = items.chain().where(function (obj) { return obj.name.indexOf("nir") !== -1; }).data();
        asr.equal(results.length, 3);
    });
    test("dynamic view named transform", function () {
        var testColl = db.addCollection("test");
        testColl.insert({ a: "first", b: 1 });
        testColl.insert({ a: "second", b: 2 });
        testColl.insert({ a: "third", b: 3 });
        testColl.insert({ a: "fourth", b: 4 });
        testColl.insert({ a: "fifth", b: 5 });
        testColl.insert({ a: "sixth", b: 6 });
        testColl.insert({ a: "seventh", b: 7 });
        testColl.insert({ a: "eighth", b: 8 });
        // our view should allow only first 4 test records
        var dv = M.addDynamicView(testColl, "lower");
        dv.applyFind({ b: { $lte: 4 } });
        // our transform will desc sort string column as "third", "second", "fourth", "first",
        // and then limit to first two
        asr.equal(dv.branchResultset().simplesort("a", true).limit(2).data().length, 2);
        // now store as named (collection) transform and run off dynamic view
        //testColl.addTransform("desc4limit2", tx);
        //
        //var results = dv.branchResultset("desc4limit2").data();
        //
        //asr.equal(results.length, 2);
        //asr.equal(results[0].a, "third");
        //asr.equal(results[1].a, "second");
    });
    test("map step with dataOptions works", function () {
        var db1 = M.createDb("testJoins");
        var c1 = db1.addCollection("c1");
        c1.insert([{ a: 1, b: 9 }, { a: 2, b: 8 }, { a: 3, b: 7 }, { a: 4, b: 6 }]);
        // only safe because our "removeMeta" option will clone objects passed in
        function graftMap(obj) {
            obj.c = obj.b - obj.a;
            return obj;
        }
        var results = c1.chain().map(graftMap, { clone: true }).data();
        asr.equal(results.length, 4);
        asr.equal(results[0].a, 1);
        asr.equal(results[0].b, 9);
        asr.equal(results[0].c, 8);
        asr.equal(results[3].a, 4);
        asr.equal(results[3].b, 6);
        asr.equal(results[3].c, 2);
        // lokijs Resultset.map() supports disableMeta, but lokijs-collection doesn't yet
        //results.forEach(function (obj) {
        //    asr.equal(Object.keys(obj).length, 3);
        //});
    });
});
