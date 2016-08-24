/// <reference path="../../definitions/chai/chai.d.ts" />
/// <reference path="../../definitions/mocha/mocha.d.ts" />
import chai = require("chai");
import Objects = require("../../ts-mortar/utils/Objects");
import DtoPropertyConverter = require("../../ts-code-generator/code-types/DtoPropertyConverter");
import TypeConverter = require("../../ts-code-generator/code-types/TypeConverter");
import LokiDbImpl = require("../db-collections/LokiDbImpl");
import DataCollection = require("../db-collections/DataCollection");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
import DummyDataPersister = require("./DummyDataPersister");

var as = chai.assert;

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


var global: { dbInst: LokiDbImpl; collA: DataCollection<MdA, MdAOpt>; collB: DataCollection<MdB, MdBOpt>; };

var now = new Date();

var dataTypes = null;

var dataModels = {
    "coll_a": <DtoModel & DtoFuncs<any>>{
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<String>" } },
        }, (t) => TypeConverter.TypeScript.parseTypeTemplate(t, true), (t) => (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t)),
        copyFunc: (a) => { return { id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }; },
    },
    "coll_b": <DtoModel & DtoFuncs<any>>{
        properties: DtoPropertyConverter.parseAndConvertTemplateMap({
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        }, (t) => TypeConverter.TypeScript.parseTypeTemplate(t, true), (t) => (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t)),
        copyFunc: (a) => { return { userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }; },
    }
};

var aItem1: MdA = {
    id: null,
    name: "Alfred",
    styles: ["color: #F0F0F0", "font-size: 12px"]
};

var aItem2: MdA = {
    id: null,
    name: "Billy",
    styles: ["color: #33AACC", "font-size: 10px"]
};

var bItem1: MdB = {
    userId: "A0281",
    note: "the fabled warrior",
    token: "C8A33B1-3B8EA7D7F89",
    timestamp: null,
};

var bItem2: MdB = {
    userId: "B0751",
    note: "the quiet monk",
    token: "89A324D-3B883283C22",
    timestamp: null,
};

var dataModelsMap = <StringMap<DtoModel & DtoFuncs<any>>><any>dataModels;




suite("LokiDbImpl", function LokiDbImplTest() {

    test("new LokiDbImpl()", function newLokiDbImplTest() {
        var persister: DummyDataPersister;
        var dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false }, "for-in-if",
            "collection_meta_data", ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes),
            function createPersister(dbInst: InMemDb) {
                persister = new DummyDataPersister(() => dbInst.getCollections(), LokiDbImpl.cloneForInIf, null);
                return persister;
            }
        );
        dbInst.initializeDb({});

        var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
        var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
        var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
        var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");

        global = {
            dbInst: dbInst,
            collA: new DataCollection<MdA, MdAOpt>("coll_a", modelA, modelFuncsA, dbInst),
            collB: new DataCollection<MdB, MdBOpt>("coll_b", modelB, modelFuncsB, dbInst)
        };

        as.deepEqual(global.dbInst.getCollections().map((c) => c.name), ["coll_a", "coll_b"]);
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
        var [bItem1Add, bItem2Add] = collB.data();

        as.deepEqual(Objects.cloneDeep(bItem1), bItem1);
        as.equal(collB.data().length, 2);

        collB.clearCollection();
        as.equal(collB.data().length, 0);
    });

});