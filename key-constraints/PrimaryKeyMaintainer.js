"use strict";
var CollectionMetaData = require("./CollectionMetaData");
var DataCollection = require("../db-collections/DataCollection");
/* PrimaryKeyMaintainer - helper for DataCollection
 * @author TeamworkGuy2
 */
var PrimaryKeyMaintainer = /** @class */ (function () {
    /**
     * @param metaDataCollectionName the name of the collection being managed
     * @param reloadAll whether to re-calculate all primary key meta-data based on collection data
     * @param dataSrc the database containing the collection
     * @param modelDefs group of collection models containing the model for 'metaDataCollectionName'
     * @param modelKeys the key manager to keep track of the primary key meta-data whenever items are added to the collection
     */
    function PrimaryKeyMaintainer(metaDataCollectionName, reloadAll, dataSrc, modelDefs, modelKeys) {
        this.metaDataColl = null;
        this.metaDataCollectionModel = {
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
        this.metaDataModelFuncs = {
            copyFunc: function copyCollectionMetaData(obj) {
                return {
                    collectionName: obj.collectionName,
                    autoGeneratedKeys: obj.autoGeneratedKeys,
                    primaryKeys: obj.primaryKeys,
                };
            }
        };
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
    PrimaryKeyMaintainer.prototype.manageKeys = function (collectionName, docs, addGeneratedKeys) {
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
    };
    /** Load meta data about item primary/auto-generated keys from a data collection */
    PrimaryKeyMaintainer.loadCollectionMetaData = function (dbInst, collectionName, dataModel) {
        var collMetaData = new CollectionMetaData(collectionName, dataModel ? dataModel.primaryKeys : [], dataModel ? dataModel.autoGeneratedKeys : []);
        var coll = dbInst.getCollection(collectionName);
        if (coll == null) {
            throw new Error("cannot find database collection '" + collectionName + "'");
        }
        var items = coll.find();
        if (items && items.length > 0) {
            // find the largest auto-generated properties
            var largestValues = PrimaryKeyMaintainer.findLargestProps(items, collMetaData.autoGeneratedKeys.map(function (s) { return s.name; }));
            // save largest values to collection meta data object
            for (var i = 0, size = largestValues.length; i < size; i++) {
                collMetaData.autoGeneratedKeys[i].largestKey = largestValues[i];
            }
        }
        return collMetaData;
    };
    /** Reconcile existing primary/auto-generated key meta-data with a data collection model.
     * Remove keys that no longer exist on the model and calculate key data that does not exist on the existing meta-data object.
     */
    PrimaryKeyMaintainer.updateCollectionMetaData = function (dbInst, collectionName, storedData, modelData, reloadAll) {
        var storedInfos = storedData.autoGeneratedKeys;
        var modelKeys = modelData.autoGeneratedKeys;
        var removedKeys = [];
        for (var i = 0, size = storedInfos.length; i < size; i++) {
            if (modelKeys.indexOf(storedInfos[i].name) === -1) {
                removedKeys.push(storedInfos[i].name);
            }
        }
        var newAutoGenInfos = new Array(modelKeys.length);
        var addedKeys = [];
        var addIndices = [];
        // search by key name and don't recalculate existing key meta-data
        // keep track of the names and indices of keys that need calculating
        for (var i = 0, size = modelKeys.length; i < size; i++) {
            var modelKey = modelKeys[i];
            if (!reloadAll) {
                var found = null;
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
        var coll = dbInst.getCollection(collectionName);
        if (coll == null) {
            throw new Error("cannot find database collection '" + collectionName + "'");
        }
        var items = coll.find();
        var largestValues = PrimaryKeyMaintainer.findLargestProps(items, addedKeys);
        for (var i = 0, size = addedKeys.length; i < size; i++) {
            newAutoGenInfos[addIndices[i]] = {
                name: addedKeys[i],
                largestKey: largestValues[i]
            };
        }
        storedData.autoGeneratedKeys = newAutoGenInfos;
        return storedData;
    };
    /** Given an array of objects and array of property names, find the largest property for each property name in the array of objects.
     * For example: findLargestProps([{ key: 3, weight: 55.4 }, { key: 5, weight: 12 }, { key: 0, weight: 42 }], ["key"])
     * returns: [5, 55.4]
     */
    PrimaryKeyMaintainer.findLargestProps = function (items, props) {
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
    };
    /** creates an DataCollection if 'dataColl' is null, otherwise returns 'dataColl' unmodified */
    PrimaryKeyMaintainer.initMetaDataCollection = function (dataColl, collectionName, dataModel, modelFuncs, dbDataInst) {
        if (dataColl == null) {
            var collModel = dbDataInst.getModelDefinitions().addModel(collectionName, dataModel, modelFuncs);
            return new DataCollection(collectionName, collModel.modelDef, collModel.modelFuncs, dbDataInst);
        }
        return dataColl;
    };
    return PrimaryKeyMaintainer;
}());
module.exports = PrimaryKeyMaintainer;
