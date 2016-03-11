"use strict";
import Objects = require("../lib/ts-mortar/utils/Objects");
import LokiDbImpl = require("../db-collections/LokiDbImpl");
import DataCollectionImpl = require("../db-collections/DataCollectionImpl");
import ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
import DummyDataPersister = require("./DummyDataPersister");


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
    "coll_a": <CollectionModelDef<any>>{
        properties: {
            "id": { primaryKey: true, autoGenerate: true, type: "number", server: { type: "long" } },
            "name": { type: "string", server: { type: "string" } },
            "styles": { type: "string[]", server: { type: "IList<string>" } },
        },

        toServiceNameConverter: null,
        copyFunc: (a) => { return { id: a.id, name: a.name, styles: Array.prototype.slice.call(a.style || []) }; },
    },
    "coll_b": <CollectionModelDef<any>>{
        properties: {
            "userId": { type: "string" },
            "token": { type: "string" },
            "note": { type: "string" },
            "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
        },
        toServiceNameConverter: null,
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

var dataModelsMap = <StringMap<CollectionModelDef<any>>><any>dataModels;




QUnit.module("LokiDbImpl", {
});


QUnit.test("new LokiDbImpl", function LokiDbImplTest(sr) {
    var persister: DummyDataPersister;
    var dbInst = new LokiDbImpl("lokijs-collections-test", { readAllow: true, writeAllow: true }, { compressLocalStores: false },
        "collection_meta_data", ModelDefinitionsSet.fromCollectionModels(dataModelsMap, dataTypes),
        function createPersister(dbInst: InMemDb) {
            persister = new DummyDataPersister(() => dbInst.getCollections(), LokiDbImpl.stripMetaData, null);
            return persister;
        }
    );
    dbInst.initializeLokijsDb({});

    var modelA = dbInst.getModelDefinitions().getDataModel("coll_a");
    var modelFuncsA = dbInst.getModelDefinitions().getDataModelFuncs("coll_a");
    var modelB = dbInst.getModelDefinitions().getDataModel("coll_b");
    var modelFuncsB = dbInst.getModelDefinitions().getDataModelFuncs("coll_b");

    global = {
        dbInst: dbInst,
        collA: new DataCollectionImpl<MdA, MdAOpt>("coll_a", modelA, modelFuncsA, dbInst),
        collB: new DataCollectionImpl<MdB, MdBOpt>("coll_b", modelB, modelFuncsB, dbInst)
    };

    sr.deepEqual(global.dbInst.getCollections().map((c) => c.name), ["coll_a", "coll_b"]);
});


QUnit.test("add/remove", function addRemoveTest(sr) {
    var collA = global.collA;
    var collB = global.collB;
    var now = new Date();

    var aItem1Add = collA.add(aItem1);
    var aItem2Add = collA.add(aItem2);

    sr.deepEqual(Objects.cloneDeep(aItem1), aItem1);
    sr.equal(collA.data().length, 2);

    collA.removeWhere({ id: aItem1Add.id });
    sr.equal(collA.data().length, 1);

    collA.remove(aItem2Add);
    sr.equal(collA.data().length, 0);


    collB.addAll([bItem1, bItem2]);
    var [bItem1Add, bItem2Add] = collB.data();

    sr.deepEqual(Objects.cloneDeep(bItem1), bItem1);
    sr.equal(collB.data().length, 2);

    collB.clearCollection();
    sr.equal(collB.data().length, 0);
});