﻿import CollectionMetaData = require("./CollectionMetaData");
import DataCollection = require("../db-collections/DataCollection");

/* PrimaryKeyMaintainer - helper for DataCollection
 * @author TeamworkGuy2
 */
class PrimaryKeyMaintainer {
    private metaDataCollectionName: string;
    private metaDataColl: DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel> = null;
    private manageKeysCallCount: number;
    private reloadAll: boolean;
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
                type: { typeName: "{ name: string; }", arrayDimensions: 1 },
                server: { name: "primaryKeys", type: { typeName: "{ name: string; }", arrayDimensions: 1 } },
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


    /**
     * @param metaDataCollectionName the name of the collection being managed
     * @param reloadAll whether to re-calculate all primary key meta-data based on collection data
     * @param dataSrc the database containing the collection
     * @param modelDefs group of collection models containing the model for 'metaDataCollectionName'
     * @param modelKeys the key manager to keep track of the primary key meta-data whenever items are added to the collection
     */
    constructor(metaDataCollectionName: string, reloadAll: boolean, dataSrc: InMemDb, modelDefs: ModelDefinitions, modelKeys: ModelKeys) {
        this.metaDataCollectionName = metaDataCollectionName;
        this.dataSrc = dataSrc;
        this.modelDefs = modelDefs;
        this.modelKeys = modelKeys;
        this.manageKeysCallCount = 0;
        this.reloadAll = reloadAll;
    }


    /** Manage (add/track) unique IDs for objects added to data collections
     * @param collectionName: the collection name (lower underscore case)
     * @param docs: the list of objects being added to the 'collectionName' collection
     * @param addGeneratedKeys: true to generate unique IDs for properties that use
     * auto-generated keys, false to just track newly added items to ensure unique IDs are maintained
     */
    public manageKeys<T>(collectionName: string, docs: T[], addGeneratedKeys: boolean): void {
        this.metaDataColl = PrimaryKeyMaintainer.initMetaDataCollection(this.metaDataColl, this.metaDataCollectionName, this.metaDataCollectionModel, this.metaDataModelFuncs, this.dataSrc);
        var collModel = this.modelDefs.getModel(collectionName);

        if (collModel && collModel.autoGeneratedKeys.length > 0) {
            var collectionInfo = this.metaDataColl.data({ collectionName: collectionName })[0];

            if (collectionInfo == null) {
                collectionInfo = PrimaryKeyMaintainer.loadCollectionMetaData(this.dataSrc, collectionName, collModel);
                this.metaDataColl.add(collectionInfo);
            }
            else if (this.manageKeysCallCount === 0) {
                collectionInfo = PrimaryKeyMaintainer.updateCollectionMetaData(this.dataSrc, collectionName, collectionInfo, collModel, this.reloadAll);
            }

            // use the add or track function depending on whether the docs are being added with or without existing unique IDs
            var autoGenKeyInfos = collectionInfo.autoGeneratedKeys;
            for (var i = 0, size = docs.length; i < size; i++) {
                var doc = docs[i];
                if (addGeneratedKeys) {
                    this.modelKeys.addGeneratedIds(autoGenKeyInfos, doc);
                }
                else {
                    this.modelKeys.trackGeneratedIds(autoGenKeyInfos, doc);
                }
            }

            this.metaDataColl.update(collectionInfo);
        }

        this.manageKeysCallCount++;
    }


    /** Load meta data about item primary/auto-generated keys from a data collection */
    private static loadCollectionMetaData(dbInst: InMemDb, collectionName: string, dataModel: DataCollectionModel<any>): CollectionMetaData {
        var collMetaData = new CollectionMetaData(collectionName, dataModel ? dataModel.primaryKeys : [], dataModel ? dataModel.autoGeneratedKeys : []);
        var items = dbInst.getCollection(collectionName).find();

        if (items && items.length > 0) {
            // find the largest auto-generated properties
            var largestValues = PrimaryKeyMaintainer.findLargestProps(items, collMetaData.autoGeneratedKeys.map((s) => s.name));
            // save largest values to collection meta data object
            for (var i = 0, size = largestValues.length; i < size; i++) {
                collMetaData.autoGeneratedKeys[i].largestKey = largestValues[i];
            }
        }
        return collMetaData;
    }


    /** Reconcile existing primary/auto-generated key meta-data with a data collection model.
     * Remove keys that no longer exist on the model and calculate key data that does not exist on the existing meta-data object.
     */
    private static updateCollectionMetaData(dbInst: InMemDb, collectionName: string, storedData: CollectionMetaData, modelData: DataCollectionModel<any>, reloadAll: boolean): CollectionMetaData {
        var storedInfos = storedData.autoGeneratedKeys;
        var modelKeys = modelData.autoGeneratedKeys;

        var removedKeys: string[] = [];
        for (var i = 0, size = storedInfos.length; i < size; i++) {
            if (modelKeys.indexOf(storedInfos[i].name) === -1) {
                removedKeys.push(storedInfos[i].name);
            }
        }

        var newAutoGenInfos: { name: string; largestKey: number; }[] = new Array(modelKeys.length);
        var addedKeys: string[] = [];
        var addIndices: number[] = [];

        // search by key name and don't recalculate existing key meta-data
        // keep track of the names and indices of keys that need calculating
        for (var i = 0, size = modelKeys.length; i < size; i++) {
            var modelKey = modelKeys[i];
            if (!reloadAll) {
                var found: { name: string; largestKey: number; } = null;
                for (var ii = 0, sizeI = storedInfos.length; ii < sizeI; ii++) {
                    if (storedInfos[i].name === modelKey) {
                        found = storedInfos[i];
                        break;
                    }
                }
                if (found == null) {
                    addedKeys.push(modelKey);
                    addIndices.push(i);
                }
                else {
                    newAutoGenInfos[i] = found;
                }
            }
            else {
                addedKeys.push(modelKey);
                addIndices.push(i);
            }
        }

        // calculate key meta-data for new keys
        var items = dbInst.getCollection(collectionName).find();
        var largestValues = PrimaryKeyMaintainer.findLargestProps(items, addedKeys);
        for (var i = 0, size = addedKeys.length; i < size; i++) {
            newAutoGenInfos[addIndices[i]] = {
                name: addedKeys[i],
                largestKey: largestValues[i]
            };
        }
        storedData.autoGeneratedKeys = newAutoGenInfos;

        return storedData;
    }


    /** Given an array of objects and array of property names, find the largest property for each property name in the array of objects.
     * For example: findLargestProps([{ key: 3, weight: 55.4 }, { key: 5, weight: 12 }, { key: 0, weight: 42 }], ["key"])
     * returns: [5, 55.4]
     */
    public static findLargestProps<T>(items: T[], props: string[]): any[] {
        var propCount = props.length;
        var largestValues = new Array(propCount);
        // search each item for each of the auto-generated properties and save the largest ones
        // first loop initializing the array of largest auto-generated values using item[0]
        for (var ii = 0; ii < propCount; ii++) {
            largestValues[ii] = items[0][props[ii]];
        }
        for (var i = 1, size = items.length; i < size; i++) {
            var item = items[i];
            for (var ii = 0; ii < propCount; ii++) {
                var keyName = props[ii];
                if (largestValues[ii] > item[keyName]) {
                    largestValues[ii] = item[keyName];
                }
            }
        }
        return largestValues;
    }


    /** creates an DataCollection if 'dataColl' is null, otherwise returns 'dataColl' unmodified */
    private static initMetaDataCollection(dataColl: DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel>,
            collectionName: string, dataModel: DtoModel, modelFuncs: DtoFuncs<any> | DtoAllFuncs<any, any>, dbDataInst: InMemDb): DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel> {
        if (dataColl == null) {
            var collModel = dbDataInst.getModelDefinitions().addModel(collectionName, dataModel, modelFuncs);
            return new DataCollection<CollectionMetaData, CollectionMetaData.OptionalModel>(collectionName, collModel.modelDef, collModel.modelFuncs, dbDataInst);
        }
        return dataColl;
    }

}

export = PrimaryKeyMaintainer;
