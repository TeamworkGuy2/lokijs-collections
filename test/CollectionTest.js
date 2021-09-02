"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="../db-collections/mem-db.d.ts" />
var chai = require("chai");
var Collection = require("../db-collections/Collection");
var M = require("./TestModels");
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
