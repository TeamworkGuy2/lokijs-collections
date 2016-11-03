"use strict";
/// <reference path="../../definitions/chai/chai.d.ts" />
/// <reference path="../../definitions/mocha/mocha.d.ts" />
var chai = require("chai");
var Loki = require("lokijs");
var Arrays = require("../../ts-mortar/utils/Arrays");
var Objects = require("../../ts-mortar/utils/Objects");
var DtoPropertyConverter = require("../../ts-code-generator/code-types/DtoPropertyConverter");
var TypeConverter = require("../../ts-code-generator/code-types/TypeConverter");
var LokiDbImpl = require("../db-collections/LokiDbImpl");
var DataCollection = require("../db-collections/DataCollection");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
var DummyDataPersister = require("./DummyDataPersister");
var asr = chai.assert;
var global;
var now = new Date();
var dataTypes = null;
var dataModels = {
    "coll_a": {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<String>" } },
        }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); }, function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: function (a) { return ({ id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }); },
    },
    "coll_b": {
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); }, function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: function (a) { return ({ userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }); },
    }
};
var itemA1;
var itemA2;
var itemA3;
var itemB1;
var itemB2;
var dataModelsMap = dataModels;
function rebuildItems() {
    itemA1 = {
        id: null,
        name: "Alfred",
        styles: ["color: #F0F0F0", "font-size: 12px"]
    };
    itemA2 = {
        id: null,
        name: "Billy",
        styles: ["color: #33AACC", "font-size: 10px"]
    };
    itemA3 = {
        id: null,
        name: "Charlie",
        styles: ["color: #CCBBAA", "font-size: 8px"]
    };
    itemB1 = {
        userId: "A0281",
        note: "the fabled warrior",
        token: "C8A33B1-3B8EA7D7F89",
        timestamp: null,
    };
    itemB2 = {
        userId: "B0751",
        note: "the quiet monk",
        token: "89A324D-3B883283C22",
        timestamp: null,
    };
}
function rebuildDb() {
    var persister;
    var metaDataCollName = "collection_meta_data";
    var dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if", metaDataCollName, false, ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes), function createDb(dbName) {
        return new Loki(dbName, {});
    }, function createPersister(dbInst) {
        persister = new DummyDataPersister(function () { return dbInst.getCollections(); }, LokiDbImpl.cloneForInIf, null);
        return persister;
    });
    dbInst.initializeDb();
    var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
    var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
    var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
    var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");
    global = {
        dbInst: dbInst,
        collA: new DataCollection("coll_a", modelA, modelFuncsA, dbInst),
        collB: new DataCollection("coll_b", modelB, modelFuncsB, dbInst),
        getMetaDataCollection: function () { return dbInst.getCollection(metaDataCollName, false); }
    };
    return global;
}
suite("LokiDbImpl", function LokiDbImplTest() {
    test("new LokiDbImpl()", function newLokiDbImplTest() {
        rebuildItems();
        rebuildDb();
        asr.deepEqual(global.dbInst.getCollections().map(function (c) { return c.name; }), ["coll_a", "coll_b"]);
    });
    test("add/remove", function addRemoveTest() {
        var collA = global.collA;
        var collB = global.collB;
        var now = new Date();
        var aItem1Add = collA.add(itemA1);
        var aItem2Add = collA.add(itemA2);
        asr.deepEqual(Objects.cloneDeep(itemA1), itemA1);
        asr.equal(collA.data().length, 2);
        collA.removeWhere({ id: aItem1Add.id });
        asr.equal(collA.data().length, 1);
        collA.remove(aItem2Add);
        asr.equal(collA.data().length, 0);
        collB.addAll([itemB1, itemB2]);
        var _a = collB.data(), bItem1Add = _a[0], bItem2Add = _a[1];
        asr.deepEqual(Objects.cloneDeep(itemB1), itemB1);
        asr.equal(collB.data().length, 2);
        collB.clearCollection();
        asr.equal(collB.data().length, 0);
    });
    test("primary key meta-data", function primaryKeyMetaDataTest() {
        rebuildItems();
        var db = rebuildDb();
        db.collA.addAll([itemA2, itemA3]);
        db.collA.remove(itemA2);
        db.collA.remove(itemA3);
        asr.equal(db.collA.data().length, 0, "expected collA to be empty");
        //asr.isTrue(itemA3["meta"] == null, JSON.stringify(itemA3));
        db.collA.add(itemA2);
        db.collA.addAll([itemA1, itemA3]);
        var metaDataAry = db.getMetaDataCollection().data;
        var collAMetaData = Arrays.firstProp(metaDataAry, "collectionName", "coll_a");
        asr.deepEqual(collAMetaData.autoGeneratedKeys, [{ name: "id", largestKey: 5 }]);
    });
});
