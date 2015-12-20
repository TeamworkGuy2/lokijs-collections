"use strict";
var Objects = require("../lib/ts-mortar/utils/Objects");
var LokiDbImpl = require("../db-collections/LokiDbImpl");
var DataCollectionImpl = require("../db-collections/DataCollectionImpl");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
var DummyDataPersister = require("./DummyDataPersister");
var global = {
    dbInst: null,
    collA: null,
    collB: null,
};
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
    var persister;
    global.dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "collection_meta_data", ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes), function createPersister(dbInst) {
        persister = new DummyDataPersister(function () { return dbInst.getCollections(); }, LokiDbImpl.stripMetaData, null);
        return persister;
    });
    global.dbInst.initializeLokijsDb({});
    global.collA = new DataCollectionImpl("coll_a", global.dbInst.getModelDefinitions().getDataModel("coll_a"), global.dbInst);
    global.collB = new DataCollectionImpl("coll_b", global.dbInst.getModelDefinitions().getDataModel("coll_b"), global.dbInst);
    sr.deepEqual(global.dbInst.getCollections().map(function (c) { return c.name; }), ["coll_a", "coll_b"]);
});
QUnit.test("add/remove", function addRemoveTest(sr) {
    var now = new Date();
    var aItem1 = {
        id: null,
        name: "Alfred",
        styles: ["color: #F0F0F0", "font-size: 12px"]
    };
    var aItem1Added = global.collA.add(aItem1);
    sr.deepEqual(Objects.cloneDeep(aItem1), aItem1);
    sr.equal(global.collA.data().length, 1);
    global.collA.removeWhere({ id: aItem1Added.id });
    sr.equal(global.collA.data().length, 0);
    var bItem1 = {
        userId: "A0281",
        note: "the fabled warrior",
        token: "C8A33B1-3B8EA7D7F89",
        timestamp: now,
    };
    var bItem1Added = global.collB.add(bItem1);
    sr.deepEqual(Objects.cloneDeep(bItem1), bItem1);
    sr.equal(global.collB.data().length, 1);
    global.collB.remove(bItem1Added);
    sr.equal(global.collB.data().length, 0);
});
