﻿import CollectionMetaData = require("./CollectionMetaData");
import DataCollectionImpl = require("../db-collections/DataCollectionImpl");

/* PrimaryKeyMaintainer - helper for {@link DataCollection}
 * @author TeamworkGuy2
 */
class PrimaryKeyMaintainer {
    private metaDataCollectionName: string;
    private metaDataColl: DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel> = null;
    private dataSrc: InMemDb;
    private modelDefs: ModelDefinitions;
    private modelKeys: ModelKeys;
    private metaDataCollectionModel: DtoModel = {
        properties: {
            collectionName: {
                type: { typeName: "string" },
                server: { name: "collectionName", type: { typeName: "string" } },
                toLocal: null,
                toService: null
            },
            autoGeneratedKeys: {
                type: { typeName: "{ name: string; largestKey: number; }", arrayDimensions: 1 },
                server: { name: "autoGeneratedKeys", type: { typeName: "{ name: string; largestKey: number; }", arrayDimensions: 1 } },
                toLocal: null,
                toService: null
            },
            primaryKeys: {
                type: { typeName: "{ name: string }", arrayDimensions: 1 },
                server: { name: "primaryKeys", type: { typeName: "{ name: string }", arrayDimensions: 1 } },
                toLocal: null,
                toService: null
            },
        },
    };
    private metaDataModelFuncs: DtoFuncs<CollectionMetaData> = {
        copyFunc: function copyCollectionMetaData(obj) {
            return {
                collectionName: obj.collectionName,
                autoGeneratedKeys: obj.autoGeneratedKeys,
                primaryKeys: obj.primaryKeys,
            }
        }
    };


    constructor(collectionName: string, dataSrc: InMemDb, modelDefs: ModelDefinitions, modelKeys: ModelKeys) {
        this.metaDataCollectionName = collectionName;
        this.dataSrc = dataSrc;
        this.modelDefs = modelDefs;
        this.modelKeys = modelKeys;
    }


    /** Manage (add/track) unique IDs for objects added to data collections
     * @param {string} collectionName: the collection name (lower underscore case)
     * @param {any[]} docs: the list of objects being added to the 'collectionName' collection
     * @param {boolean} addGeneratedKeys: true to generate unique IDs for properties that use
     * auto-generated keys, false to just track newly added items to ensure unique IDs are maintained
     */
    public manageKeys<T>(collectionName: string, docs: T[], addGeneratedKeys: boolean): void {
        this.metaDataColl = PrimaryKeyMaintainer.initMetaDataCollection(this.metaDataColl, this.metaDataCollectionName, this.metaDataCollectionModel, this.metaDataModelFuncs, this.dataSrc);
        var collDataModel = this.modelDefs.getDataModel(collectionName);
        var generatedIdNames = collDataModel ? collDataModel.autoGeneratedKeys : [];

        if (generatedIdNames.length > 0) {
            var collectionInfo = this.metaDataColl.data({ collectionName: collectionName })[0];

            if (collectionInfo == null) {
                collectionInfo = PrimaryKeyMaintainer.loadCollectionMetaData(this.dataSrc, this.modelDefs, collectionName);
                this.metaDataColl.add(collectionInfo);
            }
            var collGeneratedKeyInfos = collectionInfo.autoGeneratedKeys;
            // use the add or track function depending on whether the docs are being added with or without existing unique IDs
            for (var i = 0, size = docs.length; i < size; i++) {
                var doc = docs[i];
                if (addGeneratedKeys) {
                    this.modelKeys.addGeneratedIds(collGeneratedKeyInfos, doc);
                }
                else {
                    this.modelKeys.trackGeneratedIds(collGeneratedKeyInfos, doc);
                }
            }
            this.metaDataColl.update(collectionInfo);
        }
    }


    // Load meta data about item primary/auto-generated keys from a data collection
    private static loadCollectionMetaData(dbInst: InMemDb, modelDefs: ModelDefinitions, collectionName: string): CollectionMetaData {
        var dataModel = modelDefs.getDataModel(collectionName);
        var collMetaData = new CollectionMetaData(collectionName, dataModel ? dataModel.primaryKeys : [], dataModel ? dataModel.autoGeneratedKeys : []);
        var items = dbInst.getCollection(collectionName).find();

        if (items && items.length > 0) {
            // get the list of auto-generated property names
            var autoGeneratedKeyNames = collMetaData.autoGeneratedKeys.map((d) => d.name);
            var agKeyCount = autoGeneratedKeyNames.length;
            var largestAgKeyValues = new Array(agKeyCount);
            // search each item for each of the auto-generated properties and save the largest ones
            // first loop initializing the array of largest auto-generated values using item[0]
            for (var ii = 0; ii < agKeyCount; ii++) {
                largestAgKeyValues[ii] = items[0][autoGeneratedKeyNames[ii]];
            }
            for (var i = 1, size = items.length; i < size; i++) {
                for (var ii = 0; ii < agKeyCount; ii++) {
                    if (largestAgKeyValues[ii] > items[i][autoGeneratedKeyNames[ii]]) {
                        largestAgKeyValues[ii] = items[i][autoGeneratedKeyNames[ii]];
                    }
                }
            }
        }
        return collMetaData;
    }


    // creates an {@link DataCollection} if {@code dataColl} is null, otherwise returns {@code dataColl} unmodified
    private static initMetaDataCollection(dataColl: DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel>,
            collectionName: string, dataModel: DtoModel, modelFuncs: DtoFuncs<any> | DtoAllFuncs<any, any>, dbDataInst: InMemDb): DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel> {
        if (dataColl == null) {
            var collModel = dbDataInst.getModelDefinitions().addModel(collectionName, dataModel, modelFuncs);
            return new DataCollectionImpl<CollectionMetaData, CollectionMetaData.OptionalModel>(collectionName, collModel.modelDef, collModel.modelFuncs, dbDataInst);
        }
        return dataColl;
    }

}

export = PrimaryKeyMaintainer;
