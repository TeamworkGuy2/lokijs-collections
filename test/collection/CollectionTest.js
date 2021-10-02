"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="../../db-collections/mem-db.d.ts" />
var chai = require("chai");
var Collection = require("../../db-collections/Collection");
var M = require("../TestModels");
var asr = chai.assert;
suite("Collection", function CollectionTest() {
    test("constructor", function () {
        var coll = new Collection("ct1", { indices: ["id"] });
        asr.equal("ct1", coll.name);
        asr.isNotNull(coll.binaryIndices["id"]);
        asr.isEmpty(coll.constraints.exact);
        asr.isEmpty(coll.constraints.unique);
    });
    test("findOne", function () {
        M.rebuildItems();
        var coll = new Collection("ct1", { indices: ["id"] });
        coll.insert(M.itemA1);
        coll.insert(M.itemA2);
        asr.equal(coll.count(), 2);
        asr.equal(coll.findOne({ id: 11 }), M.itemA1);
        asr.isNull(coll.findOne({ id: 99 }));
    });
    test("update", function () {
        M.rebuildItems();
        var coll = new Collection("ct1", { indices: ["id"] });
        asr.isTrue(coll.dirty);
        coll.dirty = false;
        coll.insert(M.itemA1);
        coll.insert(M.itemA2);
        asr.isTrue(coll.dirty);
        coll.dirty = false;
        M.itemA1.styles = ["abc"];
        asr.isFalse(coll.dirty);
        coll.update(M.itemA1);
        asr.isTrue(coll.dirty);
    });
    test("binaryIndex", function () {
        M.rebuildItems();
        var coll = new Collection("ct1", { indices: ["id"] });
        coll.insert(M.itemA3);
        coll.insert(M.itemA2);
        asr.hasAllKeys(coll.binaryIndices, ["id"]);
        asr.deepEqual(coll.data.map(function (d) { return d.id; }), [20, 12]);
    });
});
suite("collection", function () {
    //test("collection rename works", function () {
    //    var db = M.createDb("test.db");
    //    var coll = db.addCollection("coll1");
    //
    //    var result = <Exclude<MemDbCollection<any>, null>>db.getCollection("coll1");
    //    asr.equal(result.name, "coll1");
    //
    //    db.renameCollection("coll1", "coll2");
    //    var result1 = db.getCollection("coll1");
    //    asr.isNull(result1);
    //    var result2 = db.getCollection("coll2");
    //    asr.equal(result2.name, "coll2");
    //});
    //test("works", function () {
    //    function SubclassedCollection() {
    //        Collection.apply(this, Array.prototype.slice.call(arguments));
    //    }
    //    SubclassedCollection.prototype = M.createDb.Collection;
    //    SubclassedCollection.prototype.extendedMethod = function () {
    //        return this.name.toUpperCase();
    //    }
    //    var coll = new SubclassedCollection("users", {});
    //
    //    asr.isTrue(coll != null);
    //    asr.equal("users".toUpperCase(), coll.extendedMethod());
    //
    //    coll.insert({ name: "joe" });
    //    asr.equal(coll.data.length, 1);
    //});
    test("findAndUpdate works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        coll.findAndUpdate(function (obj) { return obj.a === 6; }, function (obj) {
            obj.b += 1;
            return obj;
        });
        var result = coll.chain().find({ a: 6 }).simplesort("b").data();
        asr.equal(result.length, 2);
        asr.equal(result[0].b, 5);
        asr.equal(result[1].b, 8);
    });
    test("findAndRemove works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        coll.removeWhere({ a: 6 });
        asr.equal(coll.data.length, 3);
        var result = coll.chain().find().simplesort("b").data();
        asr.equal(result.length, 3);
        asr.equal(result[0].b, 2);
        asr.equal(result[1].b, 3);
        asr.equal(result[2].b, 8);
    });
    test("removeWhere works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        coll.removeWhere(function (obj) {
            return obj.a === 6;
        });
        asr.equal(coll.data.length, 3);
        var result = coll.chain().find().simplesort("b").data();
        asr.equal(result.length, 3);
        asr.equal(result[0].b, 2);
        asr.equal(result[1].b, 3);
        asr.equal(result[2].b, 8);
    });
    test("removeBatch works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        // remove by sending array of docs to remove()
        var results = coll.find({ a: 6 });
        asr.equal(results.length, 2);
        coll.remove(results);
        asr.equal(coll.data.length, 3);
        results = coll.chain().find().simplesort("b").data();
        asr.equal(results.length, 3);
        asr.equal(results[0].b, 2);
        asr.equal(results[1].b, 3);
        asr.equal(results[2].b, 8);
        // now repeat but send $loki id array to remove()
        coll.clear();
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        results = coll.find({ a: 6 }).map(function (obj) { return obj.$loki; });
        asr.equal(results.length, 2);
        coll.remove(results);
        results = coll.chain().find().simplesort("b").data();
        asr.equal(results.length, 3);
        asr.equal(results[0].b, 2);
        asr.equal(results[1].b, 3);
        asr.equal(results[2].b, 8);
    });
    test("updateWhere works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        // guess we need to return object for this to work
        coll.findAndUpdate(function (fobj) { return fobj.a === 6; }, function (obj) {
            obj.b += 1;
            return obj;
        });
        var result = coll.chain().find({ a: 6 }).simplesort("b").data();
        asr.equal(result.length, 2);
        asr.equal(result[0].b, 5);
        asr.equal(result[1].b, 8);
    });
    // coll.mode(property) should return single value of property which occurs most in collection
    // if more than one value "ties" it will just pick one
    test("mode works", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 6, b: 4 }]);
        // seems mode returns string so loose equality
        var result = coll.mode("a") == 6;
        asr.isTrue(result);
    });
    test("single inserts emit with meta when async listeners false", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        // listen for insert events to validate objects
        coll.events.on("insert", function (obj) {
            asr.isTrue(obj.hasOwnProperty("a"));
            asr.isTrue([3, 6, 1, 7, 5].indexOf(obj.a) > -1);
            switch (obj.a) {
                case 3:
                    asr.equal(obj.b, 3);
                    break;
                case 6:
                    asr.equal(obj.b, 7);
                    break;
                case 1:
                    asr.equal(obj.b, 2);
                    break;
                case 7:
                    asr.equal(obj.b, 8);
                    break;
                case 5:
                    asr.equal(obj.b, 4);
                    break;
            }
            asr.isTrue(obj.hasOwnProperty("$loki"));
            asr.isTrue(obj.hasOwnProperty("meta"));
            asr.equal(obj.meta.revision, 0);
            asr.isTrue(obj.meta.created > 0);
        });
        coll.insert({ a: 3, b: 3 });
        coll.insert({ a: 6, b: 7 });
        coll.insert({ a: 1, b: 2 });
        coll.insert({ a: 7, b: 8 });
        coll.insert({ a: 5, b: 4 });
    });
    test("single inserts (with clone) emit meta and return instances correctly", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll", { clone: true });
        // listen for insert events to validate objects
        coll.events.on("insert", function (obj) {
            asr.isTrue(obj.hasOwnProperty("a"));
            asr.isTrue([3, 6, 1, 7, 5].indexOf(obj.a) > -1);
            switch (obj.a) {
                case 3:
                    asr.equal(obj.b, 3);
                    break;
                case 6:
                    asr.equal(obj.b, 7);
                    break;
                case 1:
                    asr.equal(obj.b, 2);
                    break;
                case 7:
                    asr.equal(obj.b, 8);
                    break;
                case 5:
                    asr.equal(obj.b, 4);
                    break;
            }
            asr.isTrue(obj.hasOwnProperty("$loki"));
            asr.isTrue(obj.hasOwnProperty("meta"));
            asr.equal(obj.meta.revision, 0);
            asr.isTrue(obj.meta.created > 0);
        });
        var i1 = { a: 3, b: 3 };
        coll.insert(i1);
        coll.insert({ a: 6, b: 7 });
        coll.insert({ a: 1, b: 2 });
        coll.insert({ a: 7, b: 8 });
        coll.insert({ a: 5, b: 4 });
        // verify that the objects returned from an insert are clones by tampering with values
        i1.b = 9;
        var result = coll.findOne({ a: 3 });
        asr.equal(result.b, 3);
    });
    test("batch inserts emit with meta", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll");
        var cnt = 0;
        // listen for insert events to validate objects
        coll.events.on("insert", function (obj) {
            asr.isTrue(obj.hasOwnProperty("$loki"));
            asr.isTrue(obj.hasOwnProperty("meta"));
            asr.equal(obj.meta.revision, 0);
            asr.isTrue(obj.meta.created > 0);
            switch (cnt) {
                case 0:
                    asr.equal(obj.b, 3);
                    break;
                case 1:
                    asr.equal(obj.b, 7);
                    break;
                case 2:
                    asr.equal(obj.b, 2);
                    break;
                case 3:
                    asr.equal(obj.b, 8);
                    break;
                case 4:
                    asr.equal(obj.b, 4);
                    break;
            }
            cnt++;
        });
        coll.insert([{ a: 3, b: 3 }, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 5, b: 4 }]);
        asr.equal(cnt, 5);
    });
    test("batch inserts emit with meta and return clones", function () {
        var db = M.createDb("test.db");
        var coll = db.addCollection("testcoll", { clone: true });
        var cnt = 0;
        // listen for insert events to validate objects
        coll.events.on("insert", function (obj) {
            asr.isTrue(obj.hasOwnProperty("$loki"));
            asr.isTrue(obj.hasOwnProperty("meta"));
            asr.equal(obj.meta.revision, 0);
            asr.isTrue(obj.meta.created > 0);
            switch (cnt) {
                case 0:
                    asr.equal(obj.b, 3);
                    break;
                case 1:
                    asr.equal(obj.b, 7);
                    break;
                case 2:
                    asr.equal(obj.b, 2);
                    break;
                case 3:
                    asr.equal(obj.b, 8);
                    break;
                case 4:
                    asr.equal(obj.b, 4);
                    break;
            }
            cnt++;
        });
        var obj1 = { a: 3, b: 3 };
        var result = coll.insert([obj1, { a: 6, b: 7 }, { a: 1, b: 2 }, { a: 7, b: 8 }, { a: 5, b: 4 }]);
        asr.equal(cnt, 5);
        asr.isTrue(Array.isArray(result));
        // tamper original (after insert)
        obj1.b = 99;
        // returned values should have been clones of original
        asr.equal(result[0].b, 3);
        // internal data references should have benn clones of original
        var obj = coll.findOne({ a: 3 });
        asr.equal(obj.b, 3);
    });
});
