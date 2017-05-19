"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="chai" />
/// <reference types="mocha" />
/// <reference path="../../definitions/lokijs/lokijs.d.ts" />
var chai = require("chai");
var Loki = require("lokijs");
var Arrays = require("../../ts-mortar/utils/Arrays");
var Objects = require("../../ts-mortar/utils/Objects");
var InMemDbImpl = require("../db-collections/InMemDbImpl");
var DataCollection = require("../db-collections/DataCollection");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
var DummyDataPersister = require("./DummyDataPersister");
var M = require("./TestModels");
var asr = chai.assert;
var global;
var now = new Date();
var dataTypes = null;
function rebuildDb() {
    var persister;
    var metaDataCollName = "collection_meta_data";
    var dbInst = new InMemDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if", metaDataCollName, false, ModelDefinitionsSet.fromCollectionModels(M.dataModelsMap, dataTypes), function createDb(dbName) {
        var lokiDb = new Loki(dbName, {});
        return {
            addCollection: function (name, opts) { return lokiDb.addCollection(name, opts); },
            getCollection: function (name) { return lokiDb.getCollection(name); },
            getName: function () { return lokiDb.getName(); },
            listCollections: function () { return lokiDb.collections; },
            removeCollection: function (name) { return lokiDb.removeCollection(name); }
        };
    }, function createPersister(dbInst) {
        persister = new DummyDataPersister(function () { return dbInst.getCollections(); }, InMemDbImpl.cloneForInIf, null);
        return persister;
    }, function createCollectionSettingsFunc(collectionName) {
        var settings = {
            asyncListeners: false // lokijs async listeners cause performance issues (2015-1)
        };
        return settings;
    }, function modelKeysFunc(obj, coll, dataModel) {
        var keys = Object.keys(obj);
        Arrays.fastRemove(keys, "$loki");
        Arrays.fastRemove(keys, "meta");
        return keys;
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
suite("InMemDbImpl", function LokiDbImplTest() {
    test("new InMemDbImpl()", function newLokiDbImplTest() {
        M.rebuildItems();
        rebuildDb();
        asr.deepEqual(global.dbInst.getCollections().map(function (c) { return c.name; }), ["coll_a", "coll_b"]);
    });
    test("add/remove", function addRemoveTest() {
        var collA = global.collA;
        var collB = global.collB;
        var now = new Date();
        var aItem1Add = collA.add(M.itemA1);
        var aItem2Add = collA.add(M.itemA2);
        asr.deepEqual(Objects.cloneDeep(M.itemA1), M.itemA1);
        asr.equal(collA.data().length, 2);
        collA.removeWhere({ id: aItem1Add.id });
        asr.equal(collA.data().length, 1);
        collA.remove(aItem2Add);
        asr.equal(collA.data().length, 0);
        collB.addAll([M.itemB1, M.itemB2]);
        var _a = collB.data(), bItem1Add = _a[0], bItem2Add = _a[1];
        asr.deepEqual(Objects.cloneDeep(M.itemB1), M.itemB1);
        asr.equal(collB.data().length, 2);
        collB.clearCollection();
        asr.equal(collB.data().length, 0);
    });
    test("updateWhere", function updateWhereTest() {
        M.rebuildItems();
        var db = rebuildDb();
        var collA = db.collA;
        collA.add(M.itemA1);
        collA.add(M.itemA2);
        collA.add(M.itemA3);
        var oldName = M.itemA3.name;
        var newName = oldName + " Brown";
        collA.updateWhere({ id: M.itemA3.id }, { name: newName });
        var itemA3New = collA.find({ id: M.itemA3.id }).limit(1).data()[0];
        asr.equal(itemA3New.name, newName);
        var newStyle = ["text-align: center"];
        collA.updateWhere({ name: { $regex: { test: function (str) { console.log("testing: " + str); return /(Billy|Charlie).*/.test(str); } } } }, { styles: newStyle });
        var itms = collA.data({ name: { $regex: { test: function (str) { console.log("testing: " + str); return /(Billy|Charlie).*/.test(str); } } } });
        asr.equal(itms.length, 2);
        asr.deepEqual(itms[0].styles, newStyle);
        asr.deepEqual(itms[1].styles, newStyle);
    });
    test("primary key meta-data", function primaryKeyMetaDataTest() {
        M.rebuildItems();
        var db = rebuildDb();
        db.collA.addAll([M.itemA2, M.itemA3]);
        db.collA.remove(M.itemA2);
        db.collA.remove(M.itemA3);
        asr.equal(db.collA.data().length, 0, "expected collA to be empty");
        //asr.isTrue(itemA3["meta"] == null, JSON.stringify(itemA3));
        db.collA.add(M.itemA2);
        db.collA.addAll([M.itemA1, M.itemA3]);
        var metaDataAry = db.getMetaDataCollection().data;
        var collAMetaData = Arrays.firstProp(metaDataAry, "collectionName", "coll_a");
        asr.deepEqual(collAMetaData.autoGeneratedKeys, [{ name: "id", largestKey: 5 }]);
    });
});
