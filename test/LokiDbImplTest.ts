/// <reference path="../../definitions/chai/chai.d.ts" />
/// <reference path="../../definitions/mocha/mocha.d.ts" />
import chai = require("chai");
import Loki = require("lokijs");
import Arrays = require("../../ts-mortar/utils/Arrays");
import Objects = require("../../ts-mortar/utils/Objects");
import DtoPropertyConverter = require("../../ts-code-generator/code-types/DtoPropertyConverter");
import TypeConverter = require("../../ts-code-generator/code-types/TypeConverter");
import LokiDbImpl = require("../db-collections/LokiDbImpl");
import DataCollection = require("../db-collections/DataCollection");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
import DummyDataPersister = require("./DummyDataPersister");

var asr = chai.assert;

interface MdA {
    id: number;
    name: string;
    styles: string[];
}

interface MdAOpt {
    id?: number;
    name?: string;
    styles?: string[];
}

interface MdB {
    userId: string;
    token: string;
    note: string;
    timestamp: Date;
}

interface MdBOpt {
    userId?: string;
    token?: string;
    note?: string;
    timestamp?: Date;
}


var global: { dbInst: LokiDbImpl; collA: DataCollection<MdA, MdAOpt>; collB: DataCollection<MdB, MdBOpt>; getMetaDataCollection: () => LokiCollection<any> };

var now = new Date();

var dataTypes = null;

var dataModels = {
    "coll_a": <DtoModel & DtoFuncs<any>>{
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<String>" } },
        }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); },
            function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: (a) => ({ id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }),
    },
    "coll_b": <DtoModel & DtoFuncs<any>>{
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); },
            function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
        copyFunc: (a) => ({ userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }),
    }
};

var itemA1: MdA;

var itemA2: MdA;

var itemA3: MdA;

var itemB1: MdB;

var itemB2: MdB;

var dataModelsMap = <StringMap<DtoModel & DtoFuncs<any>>><any>dataModels;


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
    var persister: DummyDataPersister;
    var metaDataCollName = "collection_meta_data";
    var dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if",
        metaDataCollName, false, ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes),
        function createDb(dbName: string) {
            return new Loki(dbName, {});
        },
        function createPersister(dbInst: InMemDb) {
            persister = new DummyDataPersister(() => dbInst.getCollections(), LokiDbImpl.cloneForInIf, null);
            return persister;
        }
    );
    dbInst.initializeDb();

    var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
    var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
    var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
    var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");

    global = {
        dbInst: dbInst,
        collA: new DataCollection<MdA, MdAOpt>("coll_a", modelA, modelFuncsA, dbInst),
        collB: new DataCollection<MdB, MdBOpt>("coll_b", modelB, modelFuncsB, dbInst),
        getMetaDataCollection: () => dbInst.getCollection(metaDataCollName, false)
    };

    return global;
}



suite("LokiDbImpl", function LokiDbImplTest() {

    test("new LokiDbImpl()", function newLokiDbImplTest() {
        rebuildItems();
        rebuildDb();

        asr.deepEqual(global.dbInst.getCollections().map((c) => c.name), ["coll_a", "coll_b"]);
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
        var [bItem1Add, bItem2Add] = collB.data();

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