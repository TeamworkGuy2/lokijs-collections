"use strict";
var Arrays = require("ts-mortar/utils/Arrays");
var DtoPropertyConverter = require("@twg2/ts-twg-ast-codegen/code-types/DtoPropertyConverter");
var TypeConverter = require("@twg2/ts-twg-ast-codegen/code-types/TypeConverter");
var ModelDefinitionsSet = require("../data-models/ModelDefinitionsSet");
var MemDbImpl = require("../db-collections/MemDbImpl");
var DynamicView = require("../db-collections/DynamicView");
var TestModels;
(function (TestModels) {
    function createDb(dbName) {
        if (dbName === void 0) { dbName = "collections-test"; }
        return new MemDbImpl(dbName, { readAllow: true, writeAllow: true, compressLocalStores: false }, "for-in-if", "collection_meta_data", false, ModelDefinitionsSet.fromCollectionModels(TestModels.dataModelsMap), function createCollectionSettings(collectionName) {
            var settings = {};
            if (collectionName === "coll_b") {
                settings["unique"] = ["userId"];
            }
            return settings;
        }, function modelKeys(obj, coll, dataModel) {
            var keys = Object.keys(obj);
            Arrays.fastRemove(keys, "$loki");
            Arrays.fastRemove(keys, "meta");
            return keys;
        });
    }
    TestModels.createDb = createDb;
    function addDynamicView(coll, name) {
        var dv = new DynamicView(coll, name);
        coll.addDynamicView(dv);
        return dv;
    }
    TestModels.addDynamicView = addDynamicView;
    TestModels.dataModels = {
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
                "userId": { type: "string", primaryKey: true },
                "token": { type: "string" },
                "note": { type: "string" },
                "lastModified": { type: "string" },
                "timestamp": { autoGenerate: true, type: "Date", server: { type: "DateTime" } },
            }, function typeConverter(t) { return TypeConverter.TypeScript.parseTypeTemplate(t, true); }, function serverTypeConverter(t) { return (typeof t === "string" ? TypeConverter.parseTypeTemplate(t) : t); }),
            copyFunc: function (a) { return ({ userId: a.userId, token: a.token, note: a.note, timestamp: a.timestamp }); },
        }
    };
    TestModels.dataModelsMap = TestModels.dataModels;
    function rebuildItems() {
        var now = new Date();
        TestModels.itemA1 = {
            id: 11,
            name: "Alfred",
            styles: ["color: #F0F0F0", "font-size: 12px"]
        };
        TestModels.itemA2 = {
            id: 12,
            name: "Billy",
            styles: ["color: #33AACC", "font-size: 10px"]
        };
        TestModels.itemA3 = {
            id: 20,
            name: "Charlie",
            styles: ["color: #CCBBAA", "font-size: 8px"]
        };
        TestModels.itemB1 = {
            userId: "A0281",
            note: "the fabled warrior",
            token: "C8A33B1-3B8EA7D7F89",
            lastModified: now.toISOString(),
            timestamp: null,
        };
        TestModels.itemB2 = {
            userId: "B0751",
            note: "the quiet monk",
            token: "89A324D-3B883283C22",
            lastModified: now.toISOString(),
            timestamp: null,
        };
        var yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        TestModels.itemB3 = {
            userId: "C2204",
            note: "the quiet monk",
            token: "LL28VMN-28A946T3B28",
            lastModified: yesterday.toISOString(),
            timestamp: null,
        };
    }
    TestModels.rebuildItems = rebuildItems;
})(TestModels || (TestModels = {}));
module.exports = TestModels;
