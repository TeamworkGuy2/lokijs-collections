"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai = require("chai");
var M = require("../TestModels");
var asr = chai.assert;
suite("binary indices", function () {
    var testRecords;
    setup(function () {
        testRecords = [
            { name: "mjolnir", owner: "thor", maker: "dwarves" },
            { name: "gungnir", owner: "odin", maker: "elves" },
            { name: "tyrfing", owner: "Svafrlami", maker: "dwarves" },
            { name: "draupnir", owner: "odin", maker: "elves" }
        ];
    });
    test("collection.clear affects binary indices correctly", function () {
        var db = M.createDb("idxtest");
        var t2 = JSON.parse(JSON.stringify(testRecords));
        var items = db.addCollection("users", { indices: ["name"] });
        items.insert(testRecords);
        asr.isTrue(items.binaryIndices.hasOwnProperty("name"));
        //asr.equal(items.binaryIndices.name.values.length, 4); // only applies with new 'adaptiveBinaryIndices' behavior
        asr.isTrue(items.binaryIndices.name.dirty);
        items.clear();
        asr.isTrue(items.binaryIndices.hasOwnProperty("name"));
        asr.isFalse(items.binaryIndices.name.dirty);
        asr.equal(items.binaryIndices.name.values.length, 0);
        items.insert(t2);
        //asr.equal(items.binaryIndices.name.values.length, 4);
        asr.isTrue(items.binaryIndices.name.dirty);
        items.find({ name: "mjolnir" }); // query that will trigger a build of the index
        asr.equal(items.binaryIndices.name.values.length, 4);
        items.clear();
        asr.isTrue(items.binaryIndices.hasOwnProperty("name"));
    });
    test("binary index loosly but reliably works across datatypes", function () {
        var db = M.createDb("ugly.db");
        // Add a collection to the database
        var dirtydata = db.addCollection("dirtydata", { indices: ["b"] });
        // Add some documents to the collection
        dirtydata.insert({ a: 0 });
        var b4 = { a: 1, b: 4 };
        dirtydata.insert(b4);
        dirtydata.insert({ a: 2, b: undefined });
        dirtydata.insert({ a: 3, b: 3.14 });
        dirtydata.insert({ a: 4, b: new Date() });
        dirtydata.insert({ a: 5, b: false });
        dirtydata.insert({ a: 6, b: true });
        dirtydata.insert({ a: 7, b: null });
        dirtydata.insert({ a: 8, b: "0" });
        dirtydata.insert({ a: 9, b: 0 });
        dirtydata.insert({ a: 10, b: 3 });
        dirtydata.insert({ a: 11, b: "3" });
        dirtydata.insert({ a: 12, b: "4" });
    });
    test("index maintained across inserts", function () {
        var db = M.createDb("idxtest");
        var items = db.addCollection("users", { indices: ["name"] });
        items.insert(testRecords);
        // force index build
        items.find({ name: "mjolnir" });
        var bi = items.binaryIndices.name;
        asr.equal(bi.values.length, 4);
        asr.equal(bi.values[0], 3);
        asr.equal(bi.values[1], 1);
        asr.equal(bi.values[2], 0);
        asr.equal(bi.values[3], 2);
        items.insert({ name: "gjallarhorn", owner: "heimdallr", maker: "Gjöll" });
        // force index build
        items.find({ name: "mjolnir" });
        // reaquire values array
        bi = items.binaryIndices.name;
        asr.equal(bi.values[0], 3);
        asr.equal(bi.values[1], 4);
        asr.equal(bi.values[2], 1);
        asr.equal(bi.values[3], 0);
        asr.equal(bi.values[4], 2);
    });
    test("index maintained across removes", function () {
        var db = M.createDb("idxtest");
        var items = db.addCollection("users", { indices: ["name"] });
        items.insert(testRecords);
        // force index build
        items.find({ name: "mjolnir" });
        var bi = items.binaryIndices.name;
        asr.equal(bi.values.length, 4);
        asr.equal(bi.values[0], 3);
        asr.equal(bi.values[1], 1);
        asr.equal(bi.values[2], 0);
        asr.equal(bi.values[3], 2);
        var tyrfing = items.findOne({ name: "tyrfing" });
        asr.isNotNull(tyrfing);
        if (tyrfing != null) {
            items.remove(tyrfing);
        }
        // force index build
        items.find({ name: "mjolnir" });
        // reaquire values array
        bi = items.binaryIndices.name;
        // values are data array positions which should be collapsed, decrementing all index positions after the deleted 
        asr.equal(bi.values[0], 2);
        asr.equal(bi.values[1], 1);
        asr.equal(bi.values[2], 0);
    });
    //test("index maintained across batch removes", function () {
    //    var db = M.createDb("batch-removes");
    //    var items = db.addCollection("items", { indices: ["b"] });
    //
    //    for (var idx = 0; idx < 100; idx++) {
    //        var a = Math.floor(Math.random() * 1000);
    //        var b = Math.floor(Math.random() * 1000);
    //        items.insert({ "a": a, "b": b });
    //    }
    //
    //    var result = items.find({ a: { $between: [300, 700] } });
    //
    //    items.removeWhere({ a: { $between: [300, 700] } });
    //
    //    asr.isTrue(items.checkIndex("b"));
    //
    //    asr.equal(items.find().length, 100 - result.length);
    //});
    test("index maintained across updates", function () {
        var db = M.createDb("idxtest");
        var items = db.addCollection("users", { indices: ["name"] });
        items.insert(testRecords);
        // force index build
        items.find({ name: "mjolnir" });
        var bi = items.binaryIndices.name;
        asr.equal(bi.values.length, 4);
        asr.equal(bi.values[0], 3);
        asr.equal(bi.values[1], 1);
        asr.equal(bi.values[2], 0);
        asr.equal(bi.values[3], 2);
        var tyrfing = items.findOne({ name: "tyrfing" });
        asr.isNotNull(tyrfing);
        if (tyrfing != null) {
            tyrfing.name = "etyrfing";
            items.update(tyrfing);
        }
        // force index build
        items.find({ name: "mjolnir" });
        // reaquire values array
        bi = items.binaryIndices.name;
        asr.equal(bi.values[0], 3);
        asr.equal(bi.values[1], 2);
        asr.equal(bi.values[2], 1);
        asr.equal(bi.values[3], 0);
    });
    test("positional lookup using get works", function () {
        // Since we use coll.get"s ability to do a positional lookup of a loki id during adaptive indexing we will test it here
        // let's base this off of our 'remove' test so data is more meaningful
        var db = M.createDb("idxtest");
        var items = db.addCollection("users", { indices: ["name"] });
        items.insert(testRecords);
        // force index build
        items.find({ name: "mjolnir" });
        var item = items.findOne({ name: "tyrfing" });
        asr.isNotNull(item);
        if (item == null) {
            throw new Error();
        }
        items.remove(item);
        item = items.findOne({ name: "draupnir" });
        asr.isNotNull(item);
        if (item == null) {
            throw new Error();
        }
        var dataPosition = items.get(item.$loki, true);
        asr.equal(dataPosition[1], 2);
        item = items.findOne({ name: "gungnir" });
        asr.isNotNull(item);
        if (item == null) {
            throw new Error();
        }
        dataPosition = items.get(item.$loki, true);
        asr.equal(dataPosition[1], 1);
        item = items.findOne({ name: "mjolnir" });
        asr.isNotNull(item);
        if (item == null) {
            throw new Error();
        }
        dataPosition = items.get(item.$loki, true);
        asr.equal(dataPosition[1], 0);
    });
    //test("positional index lookup using getBinaryIndexPosition works", function () {
    //    // Since our indexes contain -not loki id values- but coll.data[] positions
    //    // we shall verify our getBinaryIndexPosition method"s ability to look up an 
    //    // index value based on data array position function (obtained via get)
    //    var db = M.createDb("idxtest");
    //    var items = db.addCollection("users", { indices: ["name"] });
    //    items.insert(testRecords);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    // tyrfing should be in coll.data[2] since it was third added item and we have not deleted yet
    //    var pos = items.getBinaryIndexPosition(2, "name");
    //    // yet in our index it should be fourth (array index 3) since sorted alphabetically
    //    asr.equal(pos, 3);
    //
    //    // now remove draupnir
    //    var draupnir = items.findOne({ name: "draupnir" });
    //    items.remove(draupnir);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    // tyrfing should be in coll.data[2] since it was third added item and we have not deleted yet
    //    var pos = items.getBinaryIndexPosition(2, "name");
    //    // yet in our index it should be now be third (array index 2) 
    //    asr.equal(pos, 2);
    //});
    //test("calculateRangeStart works for inserts", function () {
    //    // calculateRangeStart is helper function for adaptive inserts/updates
    //    // we will use it to find position within index where (new) nonexistent value should be inserted into index
    //    var db = M.createDb("idxtest");
    //    var items = db.addCollection("users", { indices: ["name"] });
    //    items.insert(testRecords);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    var pos = items.calculateRangeStart("name", "fff", true);
    //    asr.equal(pos, 1);
    //
    //    var pos = items.calculateRangeStart("name", "zzz", true);
    //    asr.equal(pos, 4);
    //
    //    var pos = items.calculateRangeStart("name", "aaa", true);
    //    asr.equal(pos, 0);
    //
    //    var pos = items.calculateRangeStart("name", "gungnir", true);
    //    asr.equal(pos, 1);
    //});
    //test("adaptiveBinaryIndexInsert works", function () {
    //    // Since we use coll.get"s ability to do a positional lookup of a loki id during adaptive indexing we will test it here
    //    // let's base this off of our 'remove' test so data is more meaningful
    //    var db = M.createDb("idxtest");
    //    var items = db.addCollection("users", {
    //        //adaptiveBinaryIndices: false,
    //        indices: ["name"]
    //    });
    //    items.insert(testRecords);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    // we know this will go in coll.data[4] as fifth document
    //    items.insert({
    //        name: "fff"
    //    });
    //
    //    items.adaptiveBinaryIndexInsert(4, "name");
    //
    //    asr.equal(items.binaryIndices.name.values[0], 3);  // draupnir at index position 0 and data[] position 3 (same as old)
    //    asr.equal(items.binaryIndices.name.values[1], 4);  // fff at index position 1 and data[] position 4 (now)
    //    asr.equal(items.binaryIndices.name.values[2], 1);  // gungnir at index position 2 (now) and data[] position 1
    //    asr.equal(items.binaryIndices.name.values[3], 0);  // mjolnir at index position 3 (now) and data[] position 0 
    //    asr.equal(items.binaryIndices.name.values[4], 2);  // tyrfing at index position 4 (now) and data[] position 2
    //});
    //test("adaptiveBinaryIndexUpdate works", function () {
    //    var db = M.createDb("idxtest");
    //    var items = db.addCollection("users", {
    //        adaptiveBinaryIndices: false, // we are doing utility function testing
    //        indices: ["name"]
    //    });
    //
    //    items.insert(testRecords);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    asr.equal(items.binaryIndices.name.values[0], 3);
    //    asr.equal(items.binaryIndices.name.values[1], 1);
    //    asr.equal(items.binaryIndices.name.values[2], 0);
    //    asr.equal(items.binaryIndices.name.values[3], 2);
    //
    //    // for this test, just update gungnir directly in collection.data
    //    items.data[1].name = "ygungnir";
    //
    //    // renegotiate index position of 2nd data element (ygungnir) within name index
    //    items.adaptiveBinaryIndexUpdate(1, "name");
    //
    //    asr.equal(items.binaryIndices.name.values[0], 3);
    //    asr.equal(items.binaryIndices.name.values[1], 0);
    //    asr.equal(items.binaryIndices.name.values[2], 2);
    //    asr.equal(items.binaryIndices.name.values[3], 1);
    //});
    test("adaptiveBinaryIndex batch updates work", function () {
        var db = M.createDb("idxtest");
        var items = db.addCollection("items", {
            //adaptiveBinaryIndices: true,
            indices: ["b"]
        });
        // init 4 docs with bool "b" all false
        var docs = [{ a: 8000, b: false }, { a: 6000, b: false }, { a: 4000, b: false }, { a: 2000, b: false }];
        items.insert(docs);
        // update two docs to have "b" true
        var results = items.find({ a: { $in: [8000, 6000] } });
        results.forEach(function (obj) {
            obj.b = true;
        });
        items.update(results);
        // should be 2 of each
        asr.equal(items.find({ b: true }).length, 2);
        asr.equal(items.find({ b: false }).length, 2);
        // reset all bool "b" props to false
        results = items.find({ b: true });
        results.forEach(function (obj) {
            obj.b = false;
        });
        items.update(results);
        // should be no true and 4 false
        asr.equal(items.find({ b: true }).length, 0);
        asr.equal(items.find({ b: false }).length, 4);
        // update different 2 to be true
        results = items.find({ a: { $in: [8000, 2000] } });
        results.forEach(function (obj) {
            obj.b = true;
        });
        items.update(results);
        // should be 2 true and 2 false
        asr.equal(items.find({ b: true }).length, 2);
        asr.equal(items.find({ b: false }).length, 2);
    });
    //test("adaptiveBinaryIndexRemove works", function () {
    //    // Since we use coll.get's ability to do a positional lookup of a loki id during adaptive indexing we will test it here
    //    // let's base this off of our 'remove' test so data is more meaningful
    //
    //    var db = M.createDb("idxtest");
    //    var items = db.addCollection("users", { indices: ["name"] });
    //    items.insert(testRecords);
    //
    //    // force index build
    //    items.find({ name: "mjolnir" });
    //
    //    // at this point lets break convention and use internal method directly, without calling higher level remove() to remove
    //    // from both data[] and index[].  We are not even removing from data we are just testing adaptiveBinaryIndexRemove as if we did/will.
    //
    //    // lets "remove" gungnir (which is in data array position 1) from our "name" index
    //    items.adaptiveBinaryIndexRemove(1, "name");
    //
    //    // should only be three index array elements now (ordered by name)
    //    asr.equal(items.binaryIndices.name.values[0], 2);  // draupnir at index position 0 and data[] position 2 (now)
    //    asr.equal(items.binaryIndices.name.values[1], 0);  // mjolnir at index position 1 and data[] position 0
    //    asr.equal(items.binaryIndices.name.values[2], 1);  // tyrfing at index position 2 and data[] position 1 (now)
    //});
    test("adaptiveBinaryIndex high level operability test", function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        var db = M.createDb("idxtest");
        var coll = db.addCollection("users", {
            //adaptiveBinaryIndices: true,
            indices: ["customIdx"]
        });
        // add 1000 records
        for (var idx = 0; idx < 1000; idx++) {
            coll.insert({
                customIdx: idx,
                originalIdx: idx,
                desc: "inserted doc with customIdx of " + idx
            });
        }
        // update 1000 records causing index to move first in ordered list to last, one at a time
        // when finding each document we are also verifying it gave us back the correct document
        for (var idx = 0; idx < 1000; idx++) {
            var result = coll.findOne({ customIdx: idx });
            asr.isNotNull(result);
            if (result == null) {
                throw new Error();
            }
            asr.equal(result.customIdx, idx);
            result.customIdx += 1000;
            coll.update(result);
        }
        // find each document again (by its new customIdx), verify it is who we thought it was, then remove it
        for (var idx = 0; idx < 1000; idx++) {
            var result = coll.findOne({ customIdx: idx + 1000 });
            asr.isNotNull(result);
            if (result == null) {
                throw new Error();
            }
            asr.equal(result.customIdx, idx + 1000);
            coll.remove(result);
        }
        // all documents should be gone
        asr.equal(coll.count(), 0);
        // with empty collection , insert some records
        var one = coll.insert({ customIdx: 100 });
        var two = coll.insert({ customIdx: 200 });
        var three = coll.insert({ customIdx: 300 });
        var four = coll.insert({ customIdx: 400 });
        var five = coll.insert({ customIdx: 500 });
        // intersperse more records before and after previous each element
        coll.insert({ customIdx: 7 });
        coll.insert({ customIdx: 123 });
        coll.insert({ customIdx: 234 });
        coll.insert({ customIdx: 345 });
        coll.insert({ customIdx: 567 });
        // verify some sampling returns correct objects
        asr.equal((_a = coll.findOne({ customIdx: 300 })) === null || _a === void 0 ? void 0 : _a.customIdx, 300);
        asr.equal((_b = coll.findOne({ customIdx: 234 })) === null || _b === void 0 ? void 0 : _b.customIdx, 234);
        asr.equal((_c = coll.findOne({ customIdx: 7 })) === null || _c === void 0 ? void 0 : _c.customIdx, 7);
        asr.equal((_d = coll.findOne({ customIdx: 567 })) === null || _d === void 0 ? void 0 : _d.customIdx, 567);
        // remove 4 records at various positions, forcing indices to be inserted and removed
        coll.remove(notNull(coll.findOne({ customIdx: 567 })));
        coll.remove(notNull(coll.findOne({ customIdx: 234 })));
        coll.remove(notNull(coll.findOne({ customIdx: 7 })));
        coll.remove(notNull(coll.findOne({ customIdx: 300 })));
        // verify find() returns correct document or null for all previously added customIdx"s
        asr.equal((_e = coll.findOne({ customIdx: 100 })) === null || _e === void 0 ? void 0 : _e.customIdx, 100);
        asr.equal((_f = coll.findOne({ customIdx: 200 })) === null || _f === void 0 ? void 0 : _f.customIdx, 200);
        asr.isNull(coll.findOne({ customIdx: 300 }));
        asr.equal((_g = coll.findOne({ customIdx: 400 })) === null || _g === void 0 ? void 0 : _g.customIdx, 400);
        asr.equal((_h = coll.findOne({ customIdx: 500 })) === null || _h === void 0 ? void 0 : _h.customIdx, 500);
        asr.isNull(coll.findOne({ customIdx: 7 }));
        asr.equal((_j = coll.findOne({ customIdx: 123 })) === null || _j === void 0 ? void 0 : _j.customIdx, 123);
        asr.isNull(coll.findOne({ customIdx: 234 }));
        asr.equal((_k = coll.findOne({ customIdx: 345 })) === null || _k === void 0 ? void 0 : _k.customIdx, 345);
        asr.isNull(coll.findOne({ customIdx: 567 }));
    });
    test("adaptiveBinaryIndex high level random stress test", function () {
        var db = M.createDb("idxtest");
        var coll = db.addCollection("users", {
            //adaptiveBinaryIndices: true,
            indices: ["customIdx"]
        });
        var minVal = 1, maxVal = 1000;
        var idVector = [];
        // add 1000 records
        for (var idx = 0; idx < 1000; idx++) {
            var curId = Math.floor(Math.random() * (maxVal - minVal) + minVal);
            coll.insert({
                customIdx: curId,
                sequence: idx,
                desc: "inserted doc with sequence of " + idx
            });
            idVector.push(curId);
        }
        // update 1000 records causing index to move first in ordered list to last, one at a time
        // when finding each document we are also verifying it gave us back the correct document
        for (var idx = 0; idx < 1000; idx++) {
            var currId = idVector.pop();
            var result = coll.findOne({ customIdx: currId });
            asr.isNotNull(result);
            asr.deepEqual(result === null || result === void 0 ? void 0 : result.customIdx, currId);
        }
    });
    //test("adaptiveBinaryIndex collection serializes correctly", function () {
    //    var db = M.createDb("idxtest");
    //    var coll = db.addCollection("users", {
    //        //adaptiveBinaryIndices: true,
    //        indices: ["customIdx"]
    //    });
    //    coll.insert({ customIdx: 1 });
    //
    //    var jsonString = db.serialize();
    //
    //    var newDatabase = M.createDb("idxtest");
    //    newDatabase.loadJSON(jsonString);
    //
    //    asr.isTrue(newDatabase.getCollection("users").adaptiveBinaryIndices);
    //
    //    // repeat without option set
    //    db = M.createDb("idxtest");
    //    coll = db.addCollection("users", {
    //        //adaptiveBinaryIndices: false,
    //        indices: ["customIdx"]
    //    });
    //    coll.insert({ customIdx: 1 });
    //
    //    jsonString = db.serialize();
    //    newDatabase = M.createDb("idxtest");
    //    newDatabase.loadJSON(jsonString);
    //
    //    asr.isFalse(newDatabase.getCollection("users").adaptiveBinaryIndices);
    //});
    //test("checkIndex works", function () {
    //    var db = M.createDb("bitest.db");
    //    var coll = db.addCollection("bitest", { indices: ["a"] });
    //    coll.insert([{ a: 9 }, { a: 3 }, { a: 7 }, { a: 0 }, { a: 1 }]);
    //
    //    // verify our initial order is valid
    //    asr.isTrue(coll.checkIndex("a"));
    //
    //    // now force index corruption by tampering with it
    //    coll.binaryIndices["a"].values.reverse();
    //
    //    // verify out index is now invalid
    //    asr.isFalse(coll.checkIndex("a"));
    //
    //    // also verify our test of all indices reports false
    //    var result = coll.checkAllIndexes();
    //    asr.equal(result.length, 1);
    //    asr.equal(result[0], "a");
    //
    //    // let"s just make sure that random sampling doesn"t throw error
    //    coll.checkIndex("a", { randomSampling: true, randomSamplingFactor: .5 });
    //
    //    // now have checkindex repair the index
    //    // also expect it to report that it was invalid before fixing
    //    asr.isFalse(coll.checkIndex("a", { repair: true }));
    //
    //    // now expect it to report that the index is valid
    //    asr.isTrue(coll.checkIndex("a"));
    //
    //    // now leave index ordering valid but remove the last value (from index)
    //    coll.binaryIndices["a"].values.pop();
    //
    //    // expect checkIndex to report index to be invalid
    //    asr.isFalse(coll.checkIndex("a"));
    //
    //    // now have checkindex repair the index
    //    // also expect it to report that it was invalid before fixing
    //    asr.isFalse(coll.checkIndex("a", { repair: true }));
    //
    //    // now expect it to report that the index is valid
    //    asr.isTrue(coll.checkIndex("a"));
    //
    //    // verify the check all indexes function returns empty array
    //    asr.equal(coll.checkAllIndexes().length, 0);
    //});
});
function notNull(value) {
    asr.isNotNull(value);
    return value;
}
