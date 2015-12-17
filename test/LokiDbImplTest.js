"use strict";
var Objects = require("../lib/ts-mortar/utils/Objects");
var LokiDbImpl = require("../db-collections/LokiDbImpl");
var DataCollectionImpl = require("../db-collections/DataCollectionImpl");
var CollectionDataModelImpl = require("../data-models/CollectionDataModelImpl");
var DummyDataPersister = require("./DummyDataPersister");
var globalDbInst;
var dataTypes = null;
var dataModels = {
    "coll_a": {
        properties: {
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<string>" } },
        },
        toServiceNameConverter: null,
        copyFunc: function (a) { return { id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }; },
    },
    "coll_b": {
        properties: {
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        },
        toServiceNameConverter: null,
        copyFunc: function (a) { return { userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }; },
    }
};
var dataModelsMap = dataModels;
QUnit.module("LokiDbImpl", {});
QUnit.test("new LokiDbImpl", function LokiDbImplTest(sr) {
    var now = new Date();
    var persister = new DummyDataPersister(true);
    globalDbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "collection_meta_data", new CollectionDataModelImpl(dataModelsMap, dataTypes), function createPersister(dbInst) { return persister; });
    //var collARaw = globalDbInst.getCollection("coll_a", true);
    var collA = new DataCollectionImpl("coll_a", globalDbInst.getModelDefinitions().getDataModel("coll_a"), globalDbInst);
    var aItem1 = {
        id: null,
        name: "Alfred",
        styles: ["color: #F0F0F0", "font-size: 12px"]
    };
    var aItem1Added = collA.add(aItem1);
    sr.deepEqual(Objects.cloneDeep(aItem1), aItem1);
    sr.equal(collA.data().length, 1);
    collA.removeWhere({ id: aItem1Added.id });
    sr.equal(collA.data().length, 0);
    //var collBRaw = globalDbInst.getCollection("coll_b", true);
    var collB = new DataCollectionImpl("coll_b", globalDbInst.getModelDefinitions().getDataModel("coll_b"), globalDbInst);
    var bItem1 = {
        userId: "A0281",
        note: "the fabled warrior",
        token: "C8A33B1-3B8EA7D7F89",
        timestamp: now,
    };
    var bItem1Added = collB.add(bItem1);
    sr.deepEqual(Objects.cloneDeep(bItem1), bItem1);
    sr.equal(collB.data().length, 1);
    collB.remove(bItem1Added);
    sr.equal(collB.data().length, 0);
});
