/// <reference types="chai" />
/// <reference types="mocha" />
/// <reference path="../db-collections/mem-db.d.ts" />
import chai = require("chai");
import Arrays = require("../../ts-mortar/utils/Arrays");
import Objects = require("../../ts-mortar/utils/Objects");
import Collection = require("../db-collections/Collection");
import InMemDbImpl = require("../db-collections/InMemDbImpl");
import DataCollection = require("../db-collections/DataCollection");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
import DummyDataPersister = require("./DummyDataPersister");
import M = require("./TestModels");

var asr = chai.assert;


function rebuildDb() {
    var metaDataCollName = "collection_meta_data";
    var dbInst = new InMemDbImpl("mem-collections-test", { readAllow: true, writeAllow: true, compressLocalStores: false }, "for-in-if",
        metaDataCollName, false, ModelDefinitionsSet.fromCollectionModels(M.dataModelsMap),
        function createCollectionSettingsFunc(collectionName: string) {
            var settings = {
            };
            if (collectionName === "coll_b") {
                settings["unique"] = ["userId"];
            }
            return settings;
        },
        function modelKeysFunc(obj, coll, dataModel) {
            var keys = Object.keys(obj);
            Arrays.fastRemove(keys, "$loki");
            Arrays.fastRemove(keys, "meta");
            return <(keyof typeof obj)[]>keys;
        }
    );

    var modelA = dbInst.getModelDefinitions().getModel("coll_a");
    var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
    var modelB = dbInst.getModelDefinitions().getModel("coll_b");
    var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");

    return {
        dbInst: dbInst,
        collA: new DataCollection<M.MdA, M.PkA>("coll_a", modelA, modelFuncsA, dbInst),
        collB: new DataCollection<M.MdB, M.PkB>("coll_b", modelB, modelFuncsB, dbInst),
        getMetaDataCollection: () => <MemDbCollection<any>>dbInst.getCollection(metaDataCollName, false)
    };
}


function createPersister(dbInst: InMemDb) {
    return new DummyDataPersister(() => dbInst.listCollections(), InMemDbImpl.cloneForInIf, null);
}


function createSorter<T extends string>(prop: T) {
    return function sorter(a: { [K in T]: any; }, b: { [K in T]: any }) {
        return a[prop] > b[prop] ? 1 : (a[prop] == b[prop] ? 0 : -1);
    }
}


suite("InMemDbImpl", function LokiDbImplTest() {

    test("new InMemDbImpl()", function newLokiDbImplTest() {
        M.rebuildItems();
        var db = rebuildDb();

        asr.deepEqual(db.dbInst.listCollections().map((c) => c.name), ["coll_a", "coll_b"]);
    });


    test("collection settings", function collectionSettingsTest() {
        var db = rebuildDb();
        asr.deepEqual(Object.keys(db.collB.collection.constraints.unique), ["userId"]);
        asr.equal(db.collB.collection.name, "coll_b");
    });


    test("add/remove", function addRemoveTest() {
        var db = rebuildDb();
        var collA = db.collA;
        var collB = db.collB;
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


    test("data/find/first/lookup/single", function dataFindFirstLookupSingleTest() {
        M.rebuildItems();
        var db = rebuildDb();
        var collB = db.collB;

        collB.addAll([M.itemB1, M.itemB2, M.itemB3]);

        asr.throws(() => collB.add(M.itemB1)); // can't add an object to a collection twice

        var res1 = collB.data({ userId: M.itemB2.userId })[0];
        asr.equal(res1, M.itemB2);

        var res2 = collB.find({ lastModified: M.itemB1.lastModified }).data();
        asr.equal(res2.length, 2);

        var res3 = collB.data({ lastModified: M.itemB1.lastModified, note: M.itemB1.note })[0];
        asr.equal(res3, M.itemB1);

        var res4 = collB.first({ lastModified: M.itemB2.lastModified, note: M.itemB2.note });
        asr.equal(res4, M.itemB2);

        var res5 = collB.lookup(M.itemB3.userId);
        asr.equal(res5, M.itemB3);

        asr.throws(() => collB.single({ userId: "null" }));
        asr.throws(() => collB.lookup("null"));
        asr.isTrue(collB.lookup("null", false) == null);

        var res6 = collB.single({ userId: M.itemB3.userId });
        asr.equal(res6, M.itemB3);

        asr.throws(() => collB.single({ userId: { $in: [M.itemB1.userId, M.itemB2.userId] } }));

        var sortUserId = createSorter("userId");
        var res7 = collB.data({ userId: { $in: [M.itemB1.userId, M.itemB2.userId] } });
        asr.deepEqual(res7.sort(sortUserId), [M.itemB1, M.itemB2].sort(sortUserId));
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