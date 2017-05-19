﻿/// <reference types="chai" />
/// <reference types="mocha" />
/// <reference path="../../definitions/lokijs/lokijs.d.ts" />
import chai = require("chai");
import Loki = require("lokijs");
import Arrays = require("../../ts-mortar/utils/Arrays");
import Objects = require("../../ts-mortar/utils/Objects");
import InMemDbImpl = require("../db-collections/InMemDbImpl");
import DataCollection = require("../db-collections/DataCollection");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
import DummyDataPersister = require("./DummyDataPersister");
import M = require("./TestModels");

var asr = chai.assert;

var global: {
    dbInst: InMemDbImpl;
    collA: DataCollection<M.MdA, M.PkA>;
    collB: DataCollection<M.MdB, M.PkB>;
    getMetaDataCollection: () => LokiCollection<any>
};

var now = new Date();

var dataTypes = null;


function rebuildDb() {
    var persister: DummyDataPersister;
    var metaDataCollName = "collection_meta_data";
    var dbInst = new InMemDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if",
        metaDataCollName, false, ModelDefinitionsSet.fromCollectionModels(M.dataModelsMap, dataTypes),
        function createDb(dbName: string) {
            var lokiDb = new Loki(dbName, {});
            return {
                addCollection: (name, opts) => lokiDb.addCollection(name, opts),
                getCollection: (name) => lokiDb.getCollection(name),
                getName: () => lokiDb.getName(),
                listCollections: () => lokiDb.collections,
                removeCollection: (name) => lokiDb.removeCollection(name)
            };
        },
        function createPersister(dbInst: InMemDb) {
            persister = new DummyDataPersister(() => dbInst.getCollections(), InMemDbImpl.cloneForInIf, null);
            return persister;
        },
        function createCollectionSettingsFunc(collectionName: string) {
            var settings = {
                asyncListeners: false // lokijs async listeners cause performance issues (2015-1)
            };
            return settings;
        },
        function modelKeysFunc(obj, coll, dataModel) {
            var keys = Object.keys(obj);
            Arrays.fastRemove(keys, "$loki");
            Arrays.fastRemove(keys, "meta");
            return keys;
        }
    );
    dbInst.initializeDb();

    var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
    var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
    var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
    var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");

    global = {
        dbInst: dbInst,
        collA: new DataCollection<M.MdA, M.PkA>("coll_a", modelA, modelFuncsA, dbInst),
        collB: new DataCollection<M.MdB, M.PkB>("coll_b", modelB, modelFuncsB, dbInst),
        getMetaDataCollection: () => dbInst.getCollection(metaDataCollName, false)
    };

    return global;
}


suite("InMemDbImpl", function LokiDbImplTest() {

    test("new InMemDbImpl()", function newLokiDbImplTest() {
        M.rebuildItems();
        rebuildDb();

        asr.deepEqual(global.dbInst.getCollections().map((c) => c.name), ["coll_a", "coll_b"]);
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
        var [bItem1Add, bItem2Add] = collB.data();

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