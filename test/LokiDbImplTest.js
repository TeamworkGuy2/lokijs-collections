"use strict";
/// <reference path="../../definitions/chai/chai.d.ts" />
/// <reference path="../../definitions/mocha/mocha.d.ts" />
var chai = require("chai");
var Objects = require("../../ts-mortar/utils/Objects");
var DtoPropertyConverter = require("../../ts-code-generator/code-types/DtoPropertyConverter");
var TypeConverter = require("../../ts-code-generator/code-types/TypeConverter");
var LokiDbImpl = require("../db-collections/LokiDbImpl");
var DataCollection = require("../db-collections/DataCollection");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
var DummyDataPersister = require("./DummyDataPersister");
var as = chai.assert;
var global;
var now = new Date();
var dataTypes = null;
var dataModels = {
    "coll_a": {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<String>" } },
        }, function (t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); }, function (t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: function (a) { return { id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }; },
    },
    "coll_b": {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        }, function (t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); }, function (t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: function (a) { return { userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }; },
    }
};
var aItem1 = {
    id: null,
    name: "Alfred",
    styles: ["color: #F0F0F0", "font-size: 12px"]
};
var aItem2 = {
    id: null,
    name: "Billy",
    styles: ["color: #33AACC", "font-size: 10px"]
};
var bItem1 = {
    userId: "A0281",
    note: "the fabled warrior",
    token: "C8A33B1-3B8EA7D7F89",
    timestamp: null,
};
var bItem2 = {
    userId: "B0751",
    note: "the quiet monk",
    token: "89A324D-3B883283C22",
    timestamp: null,
};
var dataModelsMap = dataModels;
suite("LokiDbImpl", function LokiDbImplTest() {
    test("new LokiDbImpl()", function newLokiDbImplTest() {
        var persister;
        var dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if", "collection_meta_data", ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes), function createPersister(dbInst) {
            persister = new DummyDataPersister(function () { return dbInst.getCollections(); }, LokiDbImpl.cloneForInIf, null);
            return persister;
        });
        dbInst.initializeDb({});
        var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
        var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
        var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
        var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");
        global = {
            dbInst: dbInst,
            collA: new DataCollection("coll_a", modelA, modelFuncsA, dbInst),
            collB: new DataCollection("coll_b", modelB, modelFuncsB, dbInst)
        };
        as.deepEqual(global.dbInst.getCollections().map(function (c) { return c.name; }), ["coll_a", "coll_b"]);
    });
    test("add/remove", function addRemoveTest() {
        var collA = global.collA;
        var collB = global.collB;
        var now = new Date();
        var aItem1Add = collA.add(aItem1);
        var aItem2Add = collA.add(aItem2);
        as.deepEqual(Objects.cloneDeep(aItem1), aItem1);
        as.equal(collA.data().length, 2);
        collA.removeWhere({ id: aItem1Add.id });
        as.equal(collA.data().length, 1);
        collA.remove(aItem2Add);
        as.equal(collA.data().length, 0);
        collB.addAll([bItem1, bItem2]);
        var _a = collB.data(), bItem1Add = _a[0], bItem2Add = _a[1];
        as.deepEqual(Objects.cloneDeep(bItem1), bItem1);
        as.equal(collB.data().length, 2);
        collB.clearCollection();
        as.equal(collB.data().length, 0);
    });
});
