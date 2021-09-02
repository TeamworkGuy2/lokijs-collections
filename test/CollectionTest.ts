/// <reference path="../db-collections/mem-db.d.ts" />
import chai = require("chai");
import Collection = require("../db-collections/Collection");
import M = require("./TestModels");

var asr = chai.assert;

suite("Collection", function CollectionTest() {

    test("constructor", function () {
        var coll = new Collection<M.MdA>("ct1", { indices: ["id"] });

        asr.equal("ct1", coll.name);
        asr.isNotNull(coll.binaryIndices["id"]);
        asr.isEmpty(coll.constraints.exact);
        asr.isEmpty(coll.constraints.unique);
    });


    test("findOne", function () {
        M.rebuildItems();
        var coll = new Collection<M.MdA>("ct1", { indices: ["id"] });

        coll.insert(M.itemA1);
        coll.insert(M.itemA2);

        asr.equal(coll.count(), 2);
        asr.equal(coll.findOne({ id: 11 }), <any>M.itemA1);
        asr.isNull(coll.findOne({ id: 99 }));
    });


    test("update", function () {
        M.rebuildItems();
        var coll = new Collection<M.MdA>("ct1", { indices: ["id"] });

        asr.isTrue(coll.dirty);

        coll.dirty = false;
        coll.insert(M.itemA1);
        coll.insert(M.itemA2);

        asr.isTrue(coll.dirty);

        coll.dirty = false;
        M.itemA1.styles = ["abc"];

        asr.isFalse(coll.dirty);

        coll.update(<any>M.itemA1);

        asr.isTrue(coll.dirty);
    });


    test("binaryIndex", function () {
        M.rebuildItems();
        var coll = new Collection<M.MdA>("ct1", { indices: ["id"] });

        coll.insert(M.itemA3);
        coll.insert(M.itemA2);

        asr.hasAllKeys(coll.binaryIndices, ["id"]);
        asr.deepEqual(coll.data.map((d) => d.id), [20, 12]);
    });

});